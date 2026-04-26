/**
 * Test-only sign-in endpoint. Gated by:
 *   1. NODE_ENV !== "production"
 *   2. TEST_AUTH_SECRET env var matches the X-Test-Secret header
 *
 * Used by Playwright e2e tests to skip Google OAuth. Never deployed to prod.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
