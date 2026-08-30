import { describe, expect, test } from "bun:test";
import {
  APP_VIEWS,
  buildAppUrl,
  FABFG_ROUTE_MESSAGE_TYPE,
  getFabfgUrls,
  postFabfgRouteChange,
  readAppRoute,
} from "./routes";

describe("app route contract", () => {
  test("opens tours by default and accepts the FABFG burial alias", () => {
    expect(readAppRoute("").view).toBe(APP_VIEWS.TOURS);
    expect(readAppRoute("?view=search").view).toBe(APP_VIEWS.LOCATOR);
    expect(readAppRoute("?view=burials&embed=fabfg")).toMatchObject({
      view: APP_VIEWS.LOCATOR,
      embedded: true,
    });
  });

  test("routes record and tour deep links to the map", () => {
    expect(readAppRoute("?record=12").view).toBe(APP_VIEWS.MAP);
    expect(readAppRoute("?tour=Notable").view).toBe(APP_VIEWS.MAP);
  });

  test("restores the selected record from an old packed share link", () => {
    const selectedRecord = { id: "legacy-1", displayName: "Legacy Record" };
    const share = Buffer.from(JSON.stringify({
      activeBurialId: selectedRecord.id,
      selectedRecords: [selectedRecord],
    })).toString("base64url");

    expect(readAppRoute(`?share=${share}`)).toMatchObject({
      view: APP_VIEWS.MAP,
      legacySelection: selectedRecord,
    });
  });

  test("updates one URL contract without dropping the native-shell flag", () => {
    const next = buildAppUrl("https://example.test/fab/?view=tours&embed=fabfg", {
      view: APP_VIEWS.MAP,
      tour: "Notable",
    });
    expect(next).toBe("https://example.test/fab/?view=map&embed=fabfg&tour=Notable");
  });

  test("can leave embedded mode explicitly", () => {
    const next = buildAppUrl("https://example.test/fab/?view=tours&embed=fabfg", {
      embedded: false,
    });
    expect(next).not.toContain("embed=");
  });

  test("provides the three URLs FABFG should own", () => {
    const urls = getFabfgUrls("https://example.test/fab/");
    expect(urls.tours).toContain("view=tours");
    expect(urls.map).toContain("view=map");
    expect(urls.burials).toContain("view=burials");
    Object.values(urls).forEach((url) => expect(url).toContain("embed=fabfg"));
  });

  test("posts the complete embedded route to the native shell", () => {
    const messages = [];
    const posted = postFabfgRouteChange(
      "https://example.test/fab/?view=map&embed=fabfg&tour=Notable&record=tour%3ANotable%3A1",
      { postMessage: (message) => messages.push(JSON.parse(message)) }
    );

    expect(posted).toBe(true);
    expect(messages).toEqual([{
      type: FABFG_ROUTE_MESSAGE_TYPE,
      view: APP_VIEWS.MAP,
      url: "https://example.test/fab/?view=map&embed=fabfg&tour=Notable&record=tour%3ANotable%3A1",
    }]);
  });

  test("does not post routes outside the FABFG embedded contract", () => {
    const messages = [];
    const bridge = { postMessage: (message) => messages.push(message) };

    expect(postFabfgRouteChange("https://example.test/fab/?view=map", bridge)).toBe(false);
    expect(postFabfgRouteChange(
      "https://example.test/fab/?view=map&embed=fabfg",
      undefined
    )).toBe(false);
    expect(postFabfgRouteChange(
      "https://example.test/fab/?view=map&embed=fabfg",
      { postMessage: "not callable" }
    )).toBe(false);
    expect(messages).toEqual([]);
  });
});
