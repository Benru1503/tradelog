/**
 * Deletes the e2e test user: the app's `users` row first (its public-schema
 * FKs cascade to trades/positions/cash flows/etc.), then the Supabase auth
 * user. The two live in different schemas with NO foreign key between them —
 * deleting only the auth user strands an app row whose unique email breaks
 * the next run's requireUser() upsert.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { TEST_USER_EMAIL } from "./test-context";

export default async function globalTeardown() {
  loadEnvConfig(process.cwd());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // App row first (works even when the auth user is already gone).
  const { error: rowErr } = await admin.from("users").delete().eq("email", TEST_USER_EMAIL);
  if (rowErr) {
    console.warn(`[e2e] failed to delete app users row: ${rowErr.message}`);
  }

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email === TEST_USER_EMAIL);
  if (!existing) return;

  const { error } = await admin.auth.admin.deleteUser(existing.id);
  if (error) {
    console.warn(`[e2e] failed to delete test user: ${error.message}`);
  } else {
    console.log(`[e2e] deleted test user ${existing.id}`);
  }
}
