import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Only allow same-origin relative redirects. `next=//evil.com` is the
 * classic protocol-relative trick that browsers normalize to `https://evil.com`,
 * so we explicitly reject anything that doesn't start with `/` followed by a
 * non-slash, non-backslash character.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!/^\/[^/\\]/.test(raw)) return "/dashboard";
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${url.origin}/login?error=auth`);
  }

  // Build the response up front so the Supabase client can attach Set-Cookie
  // headers directly to it. Writing to `cookies()` from next/headers does not
  // reliably propagate to a manually-constructed redirect response in Next 14.
  const response = NextResponse.redirect(`${url.origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${url.origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const displayName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null;
    const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

    try {
      await prisma.user.upsert({
        where: { id: user.id },
        update: { email: user.email ?? "", displayName, avatarUrl },
        create: {
          id: user.id,
          email: user.email ?? "",
          displayName,
          avatarUrl,
        },
      });
    } catch (err) {
      // `users.email` is unique and there is no FK between auth.users and
      // public.users, so an auth account deleted outside the app's Settings
      // flow strands a row that collides with the next signup on that
      // address. Open signup makes that reachable by strangers, and the
      // uncaught version surfaces as the "Something broke" boundary on
      // /dashboard. Fail back to /login with a message instead.
      console.error("[auth/callback] user upsert failed", err);
      return NextResponse.redirect(`${url.origin}/login?error=account_conflict`);
    }
  }

  return response;
}
