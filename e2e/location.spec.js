import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("live GPS follows updates and survives destination changes", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 42.705, longitude: -73.733, accuracy: 8 });
  await page.goto("./?view=map");
  const control = page.locator(".maplibregl-ctrl-geolocate");
  await expect(control).toBeEnabled();
  await control.click();
  const marker = page.locator(".maplibregl-user-location-dot");
  await expect(marker).toBeVisible();
  await expect(page.locator(".maplibregl-user-location-accuracy-circle")).toBeVisible();
  await context.setGeolocation({ latitude: 42.706, longitude: -73.734, accuracy: 12 });
  await expect(control).toHaveClass(/geolocate-active/);
  await control.click();
  await expect(marker).toHaveCount(0);
  await control.click();
  await expect(marker).toBeVisible();
  await page.getByRole("button", { name: "Burial Locator", exact: true }).click();
  await page.getByRole("button", { name: "Cemetery Map", exact: true }).click();
  await expect(marker).toBeVisible();
});

test("denied GPS stays visible with recovery instructions", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.permissions.query = async () => ({ state: "denied" });
  });
  await page.goto("./?view=map&embed=fabfg");
  await expect(page.locator(".maplibregl-ctrl-geolocate")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Location is blocked");
  await page.getByRole("button", { name: "Dismiss location message" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("GPS outside the cemetery explains why no dot appears", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 43, longitude: -74, accuracy: 10 });
  await page.goto("./?view=map");
  await page.locator(".maplibregl-ctrl-geolocate").click();
  await expect(page.getByRole("status")).toContainText("outside the cemetery map area");
  await context.setGeolocation({ latitude: 42.705, longitude: -73.733, accuracy: 10 });
  await expect(page.locator(".maplibregl-user-location-dot")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("GPS feedback clears controls with iPhone safe-area insets", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    navigator.permissions.query = async () => ({ state: "denied" });
  });
  await page.goto("./?view=map&section=24&embed=fabfg");
  // Desktop Chromium has zero safe-area insets. Substitute device values in
  // the real stylesheet to exercise the resulting layout.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")
    .replaceAll("env(safe-area-inset-top)", "47px")
    .replaceAll("env(safe-area-inset-left)", "44px")
    .replaceAll("env(safe-area-inset-right)", "0px");
  const message = page.locator(".map-location-message");
  await expect(message).toBeVisible();
  await page.addStyleTag({ content: css });
  const toolbar = await page.locator(".map-toolbar").boundingBox();
  const banner = await message.boundingBox();
  const section = await page.getByRole("group", { name: "Section 24", exact: true }).boundingBox();
  expect(banner.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height);
  expect(banner.x).toBeGreaterThanOrEqual(44);
  expect(section.y).toBeGreaterThanOrEqual(banner.y + banner.height);
  await page.getByRole("button", { name: "Dismiss location message" }).click();
  await expect(message).toHaveCount(0);
});
