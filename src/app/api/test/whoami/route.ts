/**
 * Test-only diagnostic endpoint. Returns the result of supabase.auth.getUser()
 * for the incoming cookies. Used to debug e2e auth flow.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  if (request.headers.get("x-test-secret") !== process.env.TEST_AUTH_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  const cookieHeader = request.headers.get("cookie") ?? "";
  return NextResponse.json({
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
    error: error?.message ?? null,
    incomingCookieNames: cookieHeader
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter(Boolean),
  });
}
