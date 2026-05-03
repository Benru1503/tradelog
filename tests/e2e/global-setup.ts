/**
 * Provisions a deterministic test user via the Supabase admin API before the
 * suite runs. Idempotent — if the user already exists from a prior crashed run
 * we reset their password and clean their trades.
 *
 * Skips entirely if SUPABASE_SERVICE_ROLE_KEY isn't configured, so the suite
 * fails fast with a clear error rather than hanging.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_USER_NAME } from "./test-context";

export default async function globalSetup() {
  loadEnvConfig(process.cwd());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testSecret = process.env.TEST_AUTH_SECRET;

  if (!url || !serviceKey) {
    throw new Error(
      "e2e setup: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
    );
  }
  if (!testSecret) {
    throw new Error(
      "e2e setup: TEST_AUTH_SECRET must be set in .env.local. Pick any random string.",
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Try to find an existing test user (paginated; we only need the first page since email is unique).
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;

  const existing = list.users.find((u) => u.email === TEST_USER_EMAIL);

  if (existing) {
    // Reset to known password & metadata, in case a prior run mutated it.
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: TEST_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: TEST_USER_NAME },
    });
    if (updErr) throw updErr;
    console.log(`[e2e] reusing test user ${existing.id}`);
  } else {
    const { data, error: createErr } = await admin.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: TEST_USER_NAME },
    });
    if (createErr) throw createErr;
    console.log(`[e2e] created test user ${data.user?.id}`);
  }
}
