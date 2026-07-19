import { test, expect } from "@playwright/test";

// DOM-only checks — the live model run (which hits CoinGecko/Yahoo) is
// covered by the manual checklist in docs/testing.md, not the suite, so CI
// never depends on third-party market data being up.
test.describe("predict page", () => {
  test("loads with form, quick picks, and history section", async ({ page }) => {
    await page.goto("/predict");
    await expect(page.getByRole("heading", { level: 1, name: "Predict" })).toBeVisible();

    // Form controls ("Asset" needs exact — it's a prefix of "Asset type")
    await expect(page.getByLabel("Asset type")).toBeVisible();
    await expect(page.getByLabel("Asset", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Horizon")).toBeVisible();
    await expect(page.getByRole("button", { name: "Predict", exact: true })).toBeVisible();

    // BTC quick-pick is always present (crypto golden path)
    await expect(page.getByRole("button", { name: "BTC", exact: true })).toBeVisible();

    // History card renders (empty state or table)
    await expect(page.getByRole("heading", { name: /prediction history/i })).toBeVisible();
  });

  test("quick-pick chip fills the asset input", async ({ page }) => {
    await page.goto("/predict");
    await page.getByRole("button", { name: "BTC", exact: true }).click();
    await expect(page.getByLabel("Asset", { exact: true })).toHaveValue("BTC");
    // Chip also forces the matching asset type.
    await expect(page.getByLabel("Asset type")).toHaveValue("CRYPTO");
  });

  test("sidebar navigation reaches /predict", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Predict" }).click();
    await expect(page).toHaveURL(/\/predict$/);
    await expect(page.getByRole("heading", { level: 1, name: "Predict" })).toBeVisible();
  });
});
