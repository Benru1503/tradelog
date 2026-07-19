/**
 * Signs the test user in via the gated /api/test/login endpoint and
 * persists the auth cookies to tests/e2e/.auth/user.json. Other test
 * projects load that storage state so individual specs start authenticated.
 *
 * Calls the endpoint via page.evaluate so the request runs in the browser
 * context — that way Set-Cookie response headers are processed by the
 * browser the same way they would be for a real navigation.
 */
import { test as setup, expect } from "@playwright/test";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./test-context";

const STORAGE_STATE = "tests/e2e/.auth/user.json";

setup("authenticate test user", async ({ page }) => {
  const testSecret = process.env.TEST_AUTH_SECRET;
  if (!testSecret) {
    throw new Error("TEST_AUTH_SECRET missing — set it in .env or .env.local");
  }

  // Initialize the browser context on our origin so subsequent fetch() respects same-origin cookies.
  await page.goto("/login");

  const result = await page.evaluate(
    async ({ email, password, secret }) => {
      const r = await fetch("/api/test/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-test-secret": secret,
        },
        body: JSON.stringify({ email, password }),
      });
      return { status: r.status, body: await r.text() };
    },
    { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD, secret: testSecret },
  );
  expect(result.status, `test login failed (${result.status}): ${result.body}`).toBe(200);

  // Diagnostic: ask the server who it sees us as right after login
  const whoami = await page.evaluate(async (secret) => {
    const r = await fetch("/api/test/whoami", {
      credentials: "include",
      headers: { "x-test-secret": secret },
    });
    return r.json();
  }, testSecret);
  console.log("[e2e] whoami:", JSON.stringify(whoami));

  // Verify the cookies actually authenticate by hitting a protected page.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
