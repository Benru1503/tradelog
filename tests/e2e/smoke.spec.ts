import { test, expect } from "@playwright/test";

test.describe("auth gate", () => {
  test("unauthenticated users are sent to /login", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await ctx.close();
  });
});

test.describe("dashboard", () => {
  test("loads with stats cards and equity-curve placeholder", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    // Four stats cards
    await expect(page.getByText(/total p&l/i)).toBeVisible();
    await expect(page.getByText(/win rate/i)).toBeVisible();
    await expect(page.getByText(/best trade/i)).toBeVisible();
    await expect(page.getByText(/worst trade/i)).toBeVisible();
    // Equity curve card title
    await expect(page.getByText(/equity curve/i)).toBeVisible();
  });

  test("New trade CTA navigates to the form", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("link", { name: /new trade/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/trades\/new/);
    await expect(page.getByRole("heading", { name: /new trade/i })).toBeVisible();
  });
});

test.describe("trade CRUD", () => {
  // Generate a unique asset symbol per run so concurrent dev sessions don't collide.
  const assetForRun = () => `E2E${Date.now().toString(36).slice(-5).toUpperCase()}`;

  test("create → view → edit → close → delete", async ({ page }) => {
    const asset = assetForRun();

    // CREATE — open trade
    await page.goto("/trades/new");
    await page.getByLabel("Asset").fill(asset);
    await page.getByLabel("Type").selectOption("STOCK");
    await page.getByLabel("Direction").selectOption("LONG");
    await page.getByLabel("Entry price").fill("100");
    await page.getByLabel("Quantity").fill("10");
    await page.getByLabel("Fees").fill("1");
    // entryDate has a sensible default already
    await page.getByTestId("submit-trade").click();

    // Detail page renders
    await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: new RegExp(asset) })).toBeVisible();
    await expect(page.getByText("OPEN", { exact: true })).toBeVisible();
    await expect(page.getByText("LONG", { exact: true })).toBeVisible();
    // P&L is "—" for an open trade
    const pnlCard = page.locator("text=P&L").first().locator("..");
    await expect(pnlCard).toContainText("—");

    // EDIT → close it
    await page.getByRole("link", { name: /edit/i }).click();
    await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}\/edit$/);
    await page.getByLabel("Exit price").fill("110");
    // Set exit date to "now" via the input's defaultValue trick — re-type the entry date forward
    const entryVal = await page.getByLabel("Entry date").inputValue();
    await page.getByLabel("Exit date").fill(entryVal);
    await page.getByTestId("submit-trade").click();

    // Back on detail — closed and profitable
    await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
    await expect(page.getByText("CLOSED", { exact: true })).toBeVisible();
    // (110-100) * 10 - 1 = 99 -> "+$99.00"
    await expect(page.getByText(/\+\$99\.00/)).toBeVisible();

    // VISIBLE in /trades list
    await page.goto("/trades");
    await expect(page.getByRole("cell", { name: asset, exact: true })).toBeVisible();

    // DELETE — handle the native confirm dialog
    page.once("dialog", (d) => d.accept());
    await page.goto(`/trades/${page.url().split("/").pop()}`).catch(() => {});
    // Reach detail again deterministically by clicking the cell's row
    await page.goto("/trades");
    await page.getByRole("link", { name: new RegExp(`view ${asset} trade`, "i") }).click();
    await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /delete/i }).click();

    // Back on list, no longer present
    await expect(page).toHaveURL(/\/trades$/);
    await expect(page.getByRole("cell", { name: asset, exact: true })).toHaveCount(0);
  });

  test("validation rejects exit-price-without-exit-date", async ({ page }) => {
    await page.goto("/trades/new");
    await page.getByLabel("Asset").fill("VALIDATE");
    await page.getByLabel("Entry price").fill("50");
    await page.getByLabel("Quantity").fill("1");
    await page.getByLabel("Exit price").fill("60"); // no exit date
    await page.getByTestId("submit-trade").click();

    // Stays on the form, error banner shown
    await expect(page).toHaveURL(/\/trades\/new$/);
    await expect(page.getByRole("alert")).toBeVisible();
  });
});

test.describe("trade list — sort & filter", () => {
  test.beforeAll(async ({ browser }) => {
    // Seed three trades so the list has something deterministic to sort.
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/user.json" });
    const page = await ctx.newPage();
    for (const t of [
      { asset: "AAA-SORT", entry: "100", exit: "150" }, // +$50 win
      { asset: "BBB-SORT", entry: "100", exit: "80" }, // -$20 loss
      { asset: "CCC-SORT", entry: "50", exit: "" }, // open
    ]) {
      await page.goto("/trades/new");
      await page.getByLabel("Asset").fill(t.asset);
      await page.getByLabel("Entry price").fill(t.entry);
      await page.getByLabel("Quantity").fill("1");
      if (t.exit) {
        await page.getByLabel("Exit price").fill(t.exit);
        const entryVal = await page.getByLabel("Entry date").inputValue();
        await page.getByLabel("Exit date").fill(entryVal);
      }
      await page.getByTestId("submit-trade").click();
      await page.waitForURL(/\/trades\/[0-9a-f-]{36}$/);
    }
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    // Best-effort cleanup: delete the seeded trades through the UI.
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/user.json" });
    const page = await ctx.newPage();
    for (const asset of ["AAA-SORT", "BBB-SORT", "CCC-SORT"]) {
      await page.goto("/trades");
      const row = page.getByRole("link", { name: new RegExp(`view ${asset} trade`, "i") });
      if ((await row.count()) === 0) continue;
      await row.first().click();
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: /delete/i }).click();
      await page.waitForURL(/\/trades$/);
    }
    await ctx.close();
  });

  test("filter by status=OPEN hides closed trades", async ({ page }) => {
    await page.goto("/trades");
    await page.getByLabel("Status").selectOption("OPEN");
    await expect(page.getByRole("cell", { name: "CCC-SORT", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "AAA-SORT", exact: true })).toHaveCount(0);
  });

  test("sort by P&L descending puts the win first", async ({ page }) => {
    await page.goto("/trades");
    // Click the P&L header twice to ensure descending (default goes desc on first click of new column)
    await page.getByRole("button", { name: /^P&L/i }).click();
    await expect(page).toHaveURL(/sort=pnl/);

    const firstAsset = page.getByTestId("trade-row").first().getByRole("cell").nth(1);
    await expect(firstAsset).toHaveText("AAA-SORT");
  });
});
