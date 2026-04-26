/**
 * Deletes the e2e test user. Cascades to their trades via
 * onDelete: Cascade in the schema.
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { TEST_USER_EMAIL } from "./test-context";

export default async function globalTeardown() {
  loadEnv({ path: path.resolve(__dirname, "../../.env.local") });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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
