import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  clearStoredNavigationDestination,
  createNavigationDestinationRecord,
  hasBurialNavigationCoordinates,
  readStoredNavigationDestination,
  writeStoredNavigationDestination,
} from "../src/features/map/mapNavigationDestination";

const originalWindow = globalThis.window;
let localStorageItems;

const installMockWindow = () => {
  localStorageItems = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => localStorageItems.get(key) ?? null,
      removeItem: (key) => {
        localStorageItems.delete(key);
      },
      setItem: (key, value) => {
        localStorageItems.set(key, String(value));
      },
    },
  };
};

const restoreWindow = () => {
  if (originalWindow === undefined) {
    delete globalThis.window;
    return;
  }

  globalThis.window = originalWindow;
};

describe("mapNavigationDestination", () => {
  beforeEach(() => {
    installMockWindow();
  });

  afterEach(() => {
    restoreWindow();
  });

  test("recognizes burial records with numeric coordinates", () => {
    expect(hasBurialNavigationCoordinates({
      coordinates: ["-73.741", "42.652"],
    })).toBe(true);
    expect(hasBurialNavigationCoordinates({ coordinates: ["", "42.652"] })).toBe(false);
    expect(hasBurialNavigationCoordinates({ coordinates: null })).toBe(false);
  });

  test("normalizes a burial into the saved navigation destination shape", () => {
    const destination = createNavigationDestinationRecord({
      id: "burial-1",
      source: "burial",
      First_Name: "Ada",
      Last_Name: "Lovelace",
      Section: "5",
      Lot: "12",
      coordinates: ["-73.741", "42.652"],
      savedAt: 171000,
    });

    expect(destination).toMatchObject({
      id: "burial-1",
      source: "burial",
      displayName: "Ada Lovelace",
      label: "Ada Lovelace",
      fullName: "Ada Lovelace",
      Section: "5",
      Lot: "12",
      coordinates: [-73.741, 42.652],
      savedAt: 171000,
    });
  });

  test("persists, restores, and clears the saved navigation destination", () => {
    const destination = writeStoredNavigationDestination({
      displayName: "Saved person",
      coordinates: [-73.741, 42.652],
      savedAt: 171000,
    });

    expect(destination).toMatchObject({
      displayName: "Saved person",
      coordinates: [-73.741, 42.652],
    });
    expect(readStoredNavigationDestination()).toMatchObject({
      displayName: "Saved person",
      coordinates: [-73.741, 42.652],
    });

    clearStoredNavigationDestination();

    expect(readStoredNavigationDestination()).toBeNull();
  });
});
