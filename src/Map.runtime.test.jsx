/** @jest-environment jsdom */

import {
  resolveSectionInputEventNames,
  shouldRefreshStaleRouteLocation,
  shouldUpdateRoutingOrigin,
} from "./Map";

describe("map runtime performance guards", () => {
  test("uses one pointer event family when PointerEvent is supported", () => {
    expect(resolveSectionInputEventNames(true)).toEqual({
      leave: "pointerleave",
      move: "pointermove",
      start: "pointerdown",
    });
    expect(resolveSectionInputEventNames(false)).toEqual({
      leave: "mouseleave",
      move: "mousemove",
      start: "touchstart",
    });
  });

  test("polls only when both watch and fallback readings are stale", () => {
    const now = 100000;
    const staleAfterMs = 15000;

    expect(shouldRefreshStaleRouteLocation({
      lastWatchUpdateAt: now - 5000,
      now,
      staleAfterMs,
    })).toBe(false);
    expect(shouldRefreshStaleRouteLocation({
      lastFallbackRequestAt: now - 5000,
      lastWatchUpdateAt: now - 20000,
      now,
      staleAfterMs,
    })).toBe(false);
    expect(shouldRefreshStaleRouteLocation({
      lastFallbackRequestAt: now - 20000,
      lastWatchUpdateAt: now - 20000,
      now,
      staleAfterMs,
    })).toBe(true);
  });

  test("holds route origin through GPS jitter and updates after meaningful movement", () => {
    const currentOrigin = [42.70418, -73.73198];

    expect(shouldUpdateRoutingOrigin({
      currentOrigin,
      nextLocation: {
        latitude: 42.70419,
        longitude: -73.73198,
      },
    })).toBe(false);
    expect(shouldUpdateRoutingOrigin({
      currentOrigin,
      nextLocation: {
        latitude: 42.70423,
        longitude: -73.73198,
      },
    })).toBe(true);
    expect(shouldUpdateRoutingOrigin({
      currentOrigin: null,
      nextLocation: {
        latitude: 42.70418,
        longitude: -73.73198,
      },
    })).toBe(true);
  });
});
