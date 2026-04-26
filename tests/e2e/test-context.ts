/**
 * Shared constants & helpers for e2e tests.
 *
 * The test user is provisioned in global-setup.ts and torn down in
 * global-teardown.ts. We pin the email so a previously-leaked test row
 * gets reused (and cleaned) rather than accumulating.
 */
export const TEST_USER_EMAIL = "tradelog-e2e@tradelog.test";
export const TEST_USER_PASSWORD = "Tradelog-E2E-Password!123";
export const TEST_USER_NAME = "E2E Test User";
