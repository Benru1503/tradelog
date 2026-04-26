import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const displayName =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null;
        const avatarUrl =
          (user.user_metadata?.avatar_url as string | undefined) ?? null;

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
      }
      return NextResponse.redirect(`${url.origin}${next}`);
    }
  }

  return NextResponse.redirect(`${url.origin}/login?error=auth`);
}
