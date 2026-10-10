export const APP_VIEWS = Object.freeze({
  TOURS: "tours",
  MAP: "map",
  LOCATOR: "burials",
});

export const ROUTE_KEYS = Object.freeze({
  view: "view",
  query: "q",
  section: "section",
  lot: "lot",
  tier: "tier",
  tour: "tour",
  record: "record",
  legacyShare: "share",
  embed: "embed",
  tutorial: "tutorial",
});

export const FABFG_ROUTE_MESSAGE_TYPE = "fab.route-change.v1";

const clean = (value) => String(value || "").trim();

const normalizeView = (value) => {
  const view = clean(value).toLowerCase();
  if (view === "search" || view === "locator" || view === APP_VIEWS.LOCATOR) {
    return APP_VIEWS.LOCATOR;
  }
  if (view === APP_VIEWS.TOURS) return APP_VIEWS.TOURS;
  return APP_VIEWS.MAP;
};

const decodeLegacySelection = (value) => {
  const encoded = clean(value);
  if (!encoded || encoded.length > 16384) return null;

  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const packet = JSON.parse(new TextDecoder().decode(bytes));
    const records = Array.isArray(packet?.selectedRecords) ? packet.selectedRecords : [];
    return records.find((record) => record?.id === packet.activeBurialId) || records[0] || null;
  } catch {
    return null;
  }
};

export const readAppRoute = (search = "") => {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const requestedView = clean(params.get(ROUTE_KEYS.view));
  const record = clean(params.get(ROUTE_KEYS.record));
  const tour = clean(params.get(ROUTE_KEYS.tour));
  const legacySelection = decodeLegacySelection(params.get(ROUTE_KEYS.legacyShare));
  const legacyId = clean(legacySelection?.id);
  const legacyBurialId = /^burial:(\d+)(?::|$)/.exec(legacyId)?.[1];
  const legacyTour = /^tour:([^:]+):/.exec(legacyId)?.[1] || "";

  return {
    view: normalizeView(requestedView),
    tutorial: clean(params.get(ROUTE_KEYS.embed)).toLowerCase() !== "fabfg" && params.get(ROUTE_KEYS.tutorial) === "burial-search" ? "burial-search" : "",
    query: params.get(ROUTE_KEYS.query) || "",
    section: clean(params.get(ROUTE_KEYS.section)),
    lot: clean(params.get(ROUTE_KEYS.lot)),
    tier: clean(params.get(ROUTE_KEYS.tier)),
    tour: tour || (!record ? legacyTour : ""),
    record: record || legacyBurialId || legacyId,
    legacySelection: null,
    embedded: clean(params.get(ROUTE_KEYS.embed)).toLowerCase() === "fabfg",
  };
};

export const buildAppUrl = (currentUrl, changes = {}) => {
  const url = new URL(currentUrl);
  const current = readAppRoute(url.search);
  const next = { ...current, ...changes };

  url.searchParams.set(ROUTE_KEYS.view, normalizeView(next.view));

  const setOptional = (key, value) => {
    const normalized = clean(value);
    if (normalized) url.searchParams.set(key, normalized);
    else url.searchParams.delete(key);
  };

  // Keep the space just typed between name parts. Search normalizes its input.
  if (next.query) url.searchParams.set(ROUTE_KEYS.query, String(next.query));
  else url.searchParams.delete(ROUTE_KEYS.query);
  setOptional(ROUTE_KEYS.section, next.section);
  setOptional(ROUTE_KEYS.lot, next.lot);
  setOptional(ROUTE_KEYS.tier, next.tier);
  setOptional(ROUTE_KEYS.tour, next.tour);
  setOptional(ROUTE_KEYS.record, next.record);
  setOptional(ROUTE_KEYS.tutorial, next.embedded ? "" : next.tutorial);

  if (changes.record !== undefined || changes.tour !== undefined) {
    url.searchParams.delete(ROUTE_KEYS.legacyShare);
  }
  if (next.embedded) url.searchParams.set(ROUTE_KEYS.embed, "fabfg");
  else url.searchParams.delete(ROUTE_KEYS.embed);

  return url.toString();
};

export const postFabfgRouteChange = (nextUrl, bridge = globalThis.ReactNativeWebView) => {
  const url = new URL(nextUrl);
  const route = readAppRoute(url.search);
  if (!route.embedded || !bridge?.postMessage) return false;

  try {
    bridge.postMessage(JSON.stringify({
      type: FABFG_ROUTE_MESSAGE_TYPE,
      view: route.view,
      url: url.toString(),
    }));
    return true;
  } catch {
    return false;
  }
};

export const getFabfgUrls = (rootUrl) => ({
  tours: buildAppUrl(rootUrl, { view: APP_VIEWS.TOURS, embedded: true, tutorial: "", query: "", section: "", lot: "", tier: "", tour: "", record: "" }),
  map: buildAppUrl(rootUrl, { view: APP_VIEWS.MAP, embedded: true, tutorial: "", query: "", section: "", lot: "", tier: "", tour: "", record: "" }),
  burials: buildAppUrl(rootUrl, { view: APP_VIEWS.LOCATOR, embedded: true, tutorial: "", query: "", section: "", lot: "", tier: "", tour: "", record: "" }),
});
