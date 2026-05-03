import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/test/login", "/api/test/whoami"];

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  // Strip any user identity headers attackers might send — we set these ourselves below.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-email");
  requestHeaders.delete("x-user-name");
  requestHeaders.delete("x-user-avatar");

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
    error: getUserErr,
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (process.env.NODE_ENV !== "production" && getUserErr && getUserErr.message !== "Auth session missing!") {
    console.log(`[mw] ${pathname} user=${user?.email ?? "null"} err=${getUserErr.message}`);
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user) {
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-email", user.email ?? "");
    const name =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      "";
    if (name) requestHeaders.set("x-user-name", name);
    const avatar = user.user_metadata?.avatar_url as string | undefined;
    if (avatar) requestHeaders.set("x-user-avatar", avatar);

    // Rebuild the response so the page request sees the updated headers.
    const passthrough = NextResponse.next({
      request: { headers: requestHeaders },
    });
    // Carry over any auth cookies that getUser() may have refreshed.
    supabaseResponse.cookies.getAll().forEach((c) => {
      passthrough.cookies.set(c.name, c.value);
    });
    return passthrough;
  }

  return supabaseResponse;
}
