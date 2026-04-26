/**
 * Signs the test user in via the gated /api/test/login endpoint and
 * persists the auth cookies to tests/e2e/.auth/user.json. Other test
 * projects load that storage state so individual specs start authenticated.
 */
import { test as setup, expect } from "@playwright/test";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./test-context";

const STORAGE_STATE = "tests/e2e/.auth/user.json";

setup("authenticate test user", async ({ page, request, baseURL }) => {
  const testSecret = process.env.TEST_AUTH_SECRET;
  if (!testSecret) {
    throw new Error("TEST_AUTH_SECRET missing — set it in .env.local");
  }

  const res = await request.post(`${baseURL}/api/test/login`, {
    data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
    headers: { "x-test-secret": testSecret, "content-type": "application/json" },
  });
  expect(res.ok(), `test login failed: ${await res.text()}`).toBeTruthy();

  // Verify the cookies actually authenticate by hitting a protected page.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
