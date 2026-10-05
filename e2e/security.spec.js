import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test("legacy shares resolve canonical records and discard supplied identity and coordinates", async ({ page }) => {
  await page.route("**/Search_Burials.json*", (route) => route.fulfill({ json: [
    { i: "123", f: "Jordan", l: "Avery", s: "215", c: [-73.736092, 42.712719] },
  ] }));
  const share = Buffer.from(JSON.stringify({ activeBurialId: "burial:123:215:1", selectedRecords: [
    { id: "burial:123:215:1", displayName: "Invented Identity", coordinates: [0, 0] },
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

test("legacy tour shares restore only the canonical tour record", async ({ page }) => {
  const share = Buffer.from(JSON.stringify({ selectedRecords: [
    { id: "tour:Notable:18:24:8", displayName: "Invented Identity", coordinates: [0, 0] },
  ] })).toString("base64url");
  await page.goto(`./?share=${share}`);
  await expect(page.locator(".record-card")).toContainText("Chester A. Arthur");
  await expect(page.locator("body")).not.toContainText("Invented Identity");
});

test("search bursts settle every request and retain concurrent route hydration", async ({ page }) => {
  await page.goto("./?view=tours");
  const responses = await page.evaluate(async () => {
    const worker = new Worker("/fab/src/features/locator/search.worker.js", { type: "module" });
    const replies = [];
    const finished = new Promise((resolve) => {
      worker.onmessage = ({ data }) => {
        replies.push(data);
        if (replies.length === 4) resolve(replies);
      };
    });
    const dataUrl = URL.createObjectURL(new Blob([JSON.stringify([
      { i: "123", f: "Jordan", l: "Avery", s: "215" },
    ])], { type: "application/json" }));
    for (const criteria of [
      { requestId: 1, query: "Jor" }, { requestId: 2, query: "Jordan" },
      { requestId: 3, section: "215", limit: Infinity }, { requestId: 4, recordId: "123", limit: 1 },
    ]) worker.postMessage({ ...criteria, dataUrl });
    const result = await finished;
    worker.terminate();
    URL.revokeObjectURL(dataUrl);
    return result;
  });
  expect(responses.find(({ requestId }) => requestId === 1).cancelled).toBe(true);
  for (const requestId of [2, 3, 4]) {
    expect(responses.find((reply) => reply.requestId === requestId).rows[0].i).toBe("123");
  }
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
