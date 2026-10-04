import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test("legacy shares resolve canonical records and discard supplied identity and coordinates", async ({ page }) => {
  await page.route("**/Search_Burials.json*", (route) => route.fulfill({ json: [
    { i: "trusted", f: "Jordan", l: "Avery", s: "215", c: [-73.736092, 42.712719] },
  ] }));
  const share = Buffer.from(JSON.stringify({ activeBurialId: "trusted", selectedRecords: [
    { id: "trusted", displayName: "Invented Identity", coordinates: [0, 0] },
  ] })).toString("base64url");
  await page.goto(`./?share=${share}`);
  await expect(page.locator(".record-card")).toContainText("Jordan Avery");
  await expect(page.locator("body")).not.toContainText("Invented Identity");
  const unknown = Buffer.from(JSON.stringify({ selectedRecords: [
    { id: "unknown", displayName: "Fabricated Grave", coordinates: [0, 0] },
  ] })).toString("base64url");
  await page.goto(`./?share=${unknown}`);
  await expect(page.locator("body")).not.toContainText("Fabricated Grave");
});

test("GPS routes use local map data without requesting provider tiles", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) => { globalThis.locationFix = success; };
  });
  const tiles = [];
  await page.route(/https:\/\/(tile\.openstreetmap\.org|services\.arcgisonline\.com)\//, route => {
    tiles.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64") });
  });
  await page.goto("./?view=map&tour=Notable&record=tour%3ANotable%3A18%3A24%3A8");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.getByRole("button", { name: "Start from my location", exact: true }).click();
  await expect(page.getByText("Local map while using location", {exact:true})).toBeVisible();
  await page.waitForTimeout(1000);
  tiles.length = 0;
  await page.evaluate(() => globalThis.locationFix({ coords: {longitude:-73.72586398734407,latitude:42.709358811485714,accuracy:8},timestamp:Date.now() }));
  await page.waitForTimeout(2000);
  expect(tiles).toEqual([]);
});
