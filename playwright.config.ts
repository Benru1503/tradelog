import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, ".env.local") });

const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // tests share a single test user account
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 7_000,
    navigationTimeout: 15_000,
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // forward env to the dev server child process
      NODE_ENV: "development",
    },
  },
});
