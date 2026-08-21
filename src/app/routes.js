export const APP_VIEWS = Object.freeze({
  TOURS: "tours",
  MAP: "map",
  LOCATOR: "burials",
});

export const ROUTE_KEYS = Object.freeze({
  view: "view",
  query: "q",
  section: "section",
  tour: "tour",
  record: "record",
  legacyShare: "share",
  embed: "embed",
});

const clean = (value) => String(value || "").trim();

const normalizeView = (value) => {
  const view = clean(value).toLowerCase();
  if (view === "search" || view === "locator" || view === APP_VIEWS.LOCATOR) {
    return APP_VIEWS.LOCATOR;
  }
  if (view === APP_VIEWS.MAP) return APP_VIEWS.MAP;
  return APP_VIEWS.TOURS;
};

const decodeLegacySelection = (value) => {
  const encoded = clean(value);
  if (!encoded) return null;

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
  const hasMapContext = Boolean(record || tour || legacySelection);

  return {
    view: requestedView ? normalizeView(requestedView) : hasMapContext ? APP_VIEWS.MAP : APP_VIEWS.TOURS,
    query: clean(params.get(ROUTE_KEYS.query)),
    section: clean(params.get(ROUTE_KEYS.section)),
    tour,
    record,
    legacySelection,
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

  setOptional(ROUTE_KEYS.query, next.query);
  setOptional(ROUTE_KEYS.section, next.section);
  setOptional(ROUTE_KEYS.tour, next.tour);
  setOptional(ROUTE_KEYS.record, next.record);

  if (changes.record !== undefined || changes.tour !== undefined) {
    url.searchParams.delete(ROUTE_KEYS.legacyShare);
  }
  if (next.embedded) url.searchParams.set(ROUTE_KEYS.embed, "fabfg");
  else url.searchParams.delete(ROUTE_KEYS.embed);

  return url.toString();
};

export const getFabfgUrls = (rootUrl) => ({
  tours: buildAppUrl(rootUrl, { view: APP_VIEWS.TOURS, embedded: true, query: "", section: "", tour: "", record: "" }),
  map: buildAppUrl(rootUrl, { view: APP_VIEWS.MAP, embedded: true, query: "", section: "", tour: "", record: "" }),
  burials: buildAppUrl(rootUrl, { view: APP_VIEWS.LOCATOR, embedded: true, query: "", section: "", tour: "", record: "" }),
});
