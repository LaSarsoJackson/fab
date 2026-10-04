import { expect, test } from "@playwright/test";

const locations = [
  { i: "fixture-mapped", f: "Jordan", l: "Avery", s: "215", lo: "100A", t: "2", c: [-73.736092, 42.712719] },
  { i: "fixture-unmapped", f: "Taylor", l: "Avery", s: "215", lo: "100A", t: "2", c: null },
  { i: "fixture-other-lot", f: "Casey", l: "Avery", s: "215", lo: "100", t: "2", c: [-73.736092, 42.712719] },
  { i: "fixture-other-tier", f: "Morgan", l: "Avery", s: "215", lo: "100A", t: "20", c: [-73.736092, 42.712719] },
  { i: "fixture-other-section", f: "Riley", l: "Avery", s: "132", lo: "100A", t: "2", c: [-73.7385, 42.705883] },
];

const useLocations = (page) => page.route("**/Search_Burials.json*", (route) => route.fulfill({ json: locations }));

test("a common surname can reach records beyond the first page", async ({ page }, testInfo) => {
  const errors = [];
  const consoleProblems = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleProblems.push(message.text());
  });
  await page.goto("./?view=burials&q=Smith");
  await expect(page).toHaveTitle("Albany Grave Finder");
  await expect(page.getByRole("heading", { name: "Burial Locator", exact: true })).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(page.locator(".record-row")).toHaveCount(80);
  const firstName = await page.locator(".record-row__name").first().innerText();
  await page.getByRole("button", { name: "Show more results", exact: true }).click();
  await expect(page.locator(".record-row")).toHaveCount(160);
  await expect(page.locator(".record-row__name").first()).toHaveText(firstName);
  await expect(page.locator(".record-row").nth(80)).toBeFocused();
  await expect(page.locator(".result-count")).toContainText("160 shown");
  await page.screenshot({ path: testInfo.outputPath("more-surname-results.png") });
  await page.getByLabel("Name", { exact: true }).fill("Brown");
  await expect(page.locator(".record-row")).toHaveCount(80);
  await expect(page.locator(".record-row__name").first()).toContainText("Brown");
  await page.getByLabel("Name", { exact: true }).fill("Smith");
  await expect(page.locator(".record-row")).toHaveCount(80);
  await expect(page.locator(".record-row__name").first()).toContainText("Smith");
  expect(errors).toEqual([]);
  expect(consoleProblems).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("common-surname.png") });
});

test.describe("synthetic burial index", () => {
  test.use({ serviceWorkers: "block" });

  test("lot filters preserve punctuation in recorded identifiers", async ({ page }) => {
    await page.route("**/Search_Burials.json*", (route) => route.fulfill({ json: [
      { ...locations[0], i: "positive-lot", f: "Jordan", lo: "99" },
      { ...locations[0], i: "negative-lot", f: "Taylor", lo: "-99" },
    ] }));
    await page.goto("./?view=burials&section=215&lot=99");
    await expect(page.locator(".record-row")).toHaveCount(1);
    await expect(page.locator(".record-list")).toContainText("Jordan Avery");
    await page.getByLabel("Lot", { exact: true }).fill("-99");
    await expect(page.locator(".record-row")).toHaveCount(1);
    await expect(page.locator(".record-list")).toContainText("Taylor Avery");
    await expect(page.locator(".record-list")).not.toContainText("Jordan Avery");
  });

  for (const width of [320, 1440]) {
    test(`location filters preserve letters, exact tiers, and unmapped records at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 860 });
      await useLocations(page);
      await page.goto("./?view=burials");
      await expect(page.getByLabel("Section", { exact: true })).toHaveAttribute("inputmode", "numeric");
      await page.getByLabel("Section", { exact: true }).fill("215");
      await page.getByLabel("Lot", { exact: true }).fill("100a");
      await page.getByLabel("Tier", { exact: true }).fill("2");
      await expect(page.locator(".record-row")).toHaveCount(2);
      await expect(page.locator(".record-list")).toContainText("Jordan Avery");
      await expect(page.locator(".record-list")).toContainText("Taylor Avery");
      await expect(page.locator(".record-list")).not.toContainText("Morgan Avery");
      await expect(page).toHaveURL(/lot=100a.*tier=2/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      for (const label of ["Section", "Lot", "Tier"]) {
        const box = await page.getByLabel(label, { exact: true }).boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: testInfo.outputPath(`location-filters-${width}.png`) });
      await page.reload();
      await expect(page.getByLabel("Lot", { exact: true })).toHaveValue("100a");
      await expect(page.locator(".record-row")).toHaveCount(2);
      await page.getByRole("button", { name: /Jordan Avery/ }).click();
      await expect(page.getByRole("heading", { name: "Jordan Avery", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Directions", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Burial Locator", exact: true }).click();
      await expect(page.getByLabel("Lot", { exact: true })).toHaveValue("100a");
      await expect(page.getByLabel("Tier", { exact: true })).toHaveValue("2");
      await expect(page.locator(".record-row")).toHaveCount(2);
      await page.getByLabel("Lot", { exact: true }).fill("---");
      await expect(page.locator(".record-row")).toHaveCount(0);
      await expect(page.locator(".locator-results")).toContainText("No burials");
      await page.getByRole("button", { name: "Clear search", exact: true }).click();
      await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
      await expect(page.getByLabel("Section", { exact: true })).toHaveValue("");
      await expect(page.getByLabel("Lot", { exact: true })).toHaveValue("");
      await expect(page.getByLabel("Tier", { exact: true })).toHaveValue("");
      await expect(page.locator(".record-row")).toHaveCount(0);
      await expect(page).not.toHaveURL(/lot=|tier=|section=/);
    });
  }

  test("loading more preserves rows and reaches the last result", async ({ page }) => {
    const rows = Array.from({ length: 85 }, (_, index) => ({
      i: `page-${index}`, f: `Jordan ${String(index).padStart(3, "0")}`, l: "Avery", s: "215", c: [-73.736092, 42.712719],
    }));
    await page.route("**/Search_Burials.json*", (route) => route.fulfill({ json: rows }));
    await page.goto("./?view=burials&q=Avery");
    await expect(page.locator(".record-row")).toHaveCount(80);
    await page.evaluate(() => {
      window.minimumVisibleResults = 80;
      window.searchObserver = new MutationObserver(() => {
        window.minimumVisibleResults = Math.min(window.minimumVisibleResults, document.querySelectorAll(".record-row").length);
      });
      window.searchObserver.observe(document.querySelector(".locator-results"), { childList: true, subtree: true });
    });
    await page.getByRole("button", { name: "Show more results", exact: true }).click();
    await expect(page.locator(".record-row")).toHaveCount(85);
    expect(await page.evaluate(() => {
      window.searchObserver.disconnect();
      return window.minimumVisibleResults;
    })).toBe(80);
    await expect(page.getByRole("button", { name: "Show more results", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /Jordan 084 Avery/ }).click();
    await expect(page.getByRole("heading", { name: "Jordan 084 Avery", exact: true })).toBeVisible();
  });

  test("the native bridge retains location filters in the selected grave route", async ({ page }) => {
    await useLocations(page);
    await page.addInitScript(() => {
      window.fabMessages = [];
      window.ReactNativeWebView = { postMessage: (message) => window.fabMessages.push(JSON.parse(message)) };
    });
    await page.goto("./?view=burials&section=215&lot=100A&tier=2&embed=fabfg");
    await expect(page.locator(".record-row")).toHaveCount(2);
    await page.getByRole("button", { name: /Jordan Avery/ }).click();
    const messages = await page.evaluate(() => window.fabMessages);
    const destination = new URL(messages.findLast((message) => message.view === "map").url);
    expect(destination.searchParams.get("record")).toBe("fixture-mapped");
    expect(destination.searchParams.get("lot")).toBe("100A");
    expect(destination.searchParams.get("tier")).toBe("2");
    expect(destination.searchParams.get("embed")).toBe("fabfg");
  });

  test("choosing a tour clears the previous lot and tier search", async ({ page }) => {
    await useLocations(page);
    await page.goto("./?view=burials&section=215&lot=100A&tier=2");
    await expect(page.locator(".record-row")).toHaveCount(2);
    await page.getByRole("button", { name: "Search Tours", exact: true }).click();
    await page.getByRole("button", { name: /Notables Tour 2020/ }).click();
    await expect(page).toHaveURL(/view=map.*tour=Notable/);
    await expect(page).not.toHaveURL(/lot=|tier=/);
    await page.getByRole("button", { name: "Burial Locator", exact: true }).click();
    await expect(page.getByLabel("Lot", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Tier", { exact: true })).toHaveValue("");
    await expect(page.locator(".locator-empty")).toBeVisible();
  });
});
