/**
 * Test-only sign-in endpoint. Gated by:
 *   1. NODE_ENV !== "production"
 *   2. TEST_AUTH_SECRET env var matches the X-Test-Secret header
 *
 * Used by Playwright e2e tests to skip Google OAuth. Never deployed to prod.
 *
 * Cookies are set directly on the NextResponse instance so they reliably
 * propagate to the client — `cookies().set()` from next/headers can be
 * dropped when a Route Handler returns its own NextResponse.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const expected = process.env.TEST_AUTH_SECRET;
  if (!expected || request.headers.get("x-test-secret") !== expected) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "email + password required" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });

  const incomingCookies = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const idx = c.indexOf("=");
      const name = idx === -1 ? c : c.slice(0, idx);
      const value = idx === -1 ? "" : c.slice(idx + 1);
      return { name, value };
    });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return incomingCookies;
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Diagnostic: verify supabase can parse the cookie we just wrote
  const { data: getUserData, error: getUserErr } = await supabase.auth.getUser();
  console.log(
    `[test-login] signed in as ${signInData.user?.email}, post-getUser=${getUserData.user?.email ?? "null"} err=${getUserErr?.message ?? "none"} cookieCount=${response.cookies.getAll().length}`,
  );
  console.log(
    `[test-login] response cookies: ${response.cookies.getAll().map((c) => `${c.name}(len=${c.value.length})`).join(", ")}`,
  );

  return response;
}
