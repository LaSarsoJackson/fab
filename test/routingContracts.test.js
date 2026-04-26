import { describe, expect, test } from "bun:test";

import {
  ADMIN_HASH,
  APP_ROUTE_IDS,
  buildDirectionsLink,
  buildOfflineValhallaWalkingRouteUrl,
  buildValhallaWalkingRouteUrl,
  DEFAULT_LOCAL_VALHALLA_PROXY_PATH,
  DEFAULT_ROUTING_PROVIDER,
  normalizeRoutingProvider,
  navigateToAppRoute,
  ROUTING_QUERY_PARAMS,
  ROUTING_PROVIDERS,
  VALID_ROUTING_PROVIDERS,
  isAdminHash,
} from "../src/shared/routing";

describe("routing contracts", () => {
  test("keeps app route hashes in one registry", () => {
    expect(ADMIN_HASH).toBe("#/admin");
    expect(isAdminHash("#/admin")).toBe(true);
    expect(isAdminHash("#/admin?dataset=burials")).toBe(true);
    expect(isAdminHash("#/map")).toBe(false);
  });

  test("navigates through the same app route registry", () => {
    const location = { hash: "#/admin" };

    expect(navigateToAppRoute(APP_ROUTE_IDS.map, { location })).toBe(true);
    expect(location.hash).toBe("");

    expect(navigateToAppRoute(APP_ROUTE_IDS.admin, { location })).toBe(true);
    expect(location.hash).toBe("#/admin");
  });

  test("centralizes route query keys and provider ids", () => {
    expect(ROUTING_QUERY_PARAMS).toMatchObject({
      mapEngine: "mapEngine",
      routingProvider: "routing",
      search: "q",
      sharedSelection: "share",
    });
    expect(DEFAULT_ROUTING_PROVIDER).toBe(ROUTING_PROVIDERS.api);
    expect(VALID_ROUTING_PROVIDERS).toEqual(["api", "local", "valhalla"]);
    expect(normalizeRoutingProvider(" VALHALLA ")).toBe("valhalla");
    expect(normalizeRoutingProvider("bogus")).toBe("");
  });

  test("builds hosted and offline Valhalla URLs from shared defaults", () => {
    const hostedUrl = new URL(buildValhallaWalkingRouteUrl({
      from: [42.70418, -73.73198],
      to: [42.70911, -73.72154],
      apiUrl: "https://routing.example.test/api",
    }));
    const offlineUrl = new URL(buildOfflineValhallaWalkingRouteUrl({
      from: [42.70418, -73.73198],
      to: [42.70911, -73.72154],
    }), "http://localhost");

    expect(hostedUrl.origin).toBe("https://routing.example.test");
    expect(hostedUrl.pathname).toBe("/api/route");
    expect(offlineUrl.pathname).toBe(`${DEFAULT_LOCAL_VALHALLA_PROXY_PATH}/route`);
  });

  test("builds an Apple Maps link for Apple platforms", () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      label: "Ada Lovelace",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });

    expect(result).toEqual({
      href: "https://maps.apple.com/?daddr=42.710119%2C-73.730294&dirflg=w&q=Ada+Lovelace",
      platform: "apple",
      target: "self",
    });
  });

  test("includes a source location in Apple Maps links when one is provided", () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      label: "Ada Lovelace",
      originLatitude: 42.70418,
      originLongitude: -73.73198,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });

    expect(result).toEqual({
      href: "https://maps.apple.com/?daddr=42.710119%2C-73.730294&dirflg=w&saddr=42.70418%2C-73.73198&q=Ada+Lovelace",
      platform: "apple",
      target: "self",
    });
  });

  test("builds a Google Maps directions link for Android", () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      label: "Ada Lovelace",
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
    });

    expect(result).toEqual({
      href: "https://www.google.com/maps/dir/?api=1&destination=42.710119%2C-73.730294&travelmode=walking",
      platform: "android",
      target: "self",
    });
  });

  test("includes a source location in Google Maps links when one is provided", () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      originLatitude: 42.70418,
      originLongitude: -73.73198,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    expect(result).toEqual({
      href: "https://www.google.com/maps/dir/?api=1&destination=42.710119%2C-73.730294&travelmode=walking&origin=42.70418%2C-73.73198",
      platform: "web",
      target: "_blank",
    });
  });

  test("falls back to a web directions URL on desktop", () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    expect(result).toEqual({
      href: "https://www.google.com/maps/dir/?api=1&destination=42.710119%2C-73.730294&travelmode=walking",
      platform: "web",
      target: "_blank",
    });
  });

  test("returns null for invalid coordinates", () => {
    const result = buildDirectionsLink({
      latitude: 120,
      longitude: -73.730294,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    expect(result).toBeNull();
  });
});
