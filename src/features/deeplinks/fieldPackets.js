import { formatBrowseResultName } from "../browse/browseResults";
import { ROUTING_QUERY_PARAMS } from "../../shared/routing";

export const SHARED_LINK_QUERY_PARAM = ROUTING_QUERY_PARAMS.sharedSelection;

// Packed shared links become the single source of truth in portable URLs, so
// strip the ad-hoc view/query params that would otherwise compete with them.
const FIELD_PACKET_STATE_QUERY_KEYS = [
  ROUTING_QUERY_PARAMS.section,
  ROUTING_QUERY_PARAMS.tour,
  ROUTING_QUERY_PARAMS.view,
  ROUTING_QUERY_PARAMS.search,
  SHARED_LINK_QUERY_PARAM,
];

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeFiniteNumber = (value) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
};

const normalizeCoordinates = (value) => {
  if (!Array.isArray(value) || value.length !== 2) return null;

  const longitude = normalizeFiniteNumber(value[0]);
  const latitude = normalizeFiniteNumber(value[1]);
  if (longitude === null || latitude === null) return null;

  return [longitude, latitude];
};

const normalizeMapBounds = (value) => {
  if (!Array.isArray(value) || value.length !== 2) return null;

  const southWest = Array.isArray(value[0]) ? value[0] : [];
  const northEast = Array.isArray(value[1]) ? value[1] : [];
  if (southWest.length !== 2 || northEast.length !== 2) return null;

  const south = normalizeFiniteNumber(southWest[0]);
  const west = normalizeFiniteNumber(southWest[1]);
  const north = normalizeFiniteNumber(northEast[0]);
  const east = normalizeFiniteNumber(northEast[1]);

  if ([south, west, north, east].some((coordinate) => coordinate === null)) {
    return null;
  }

  return [
    [south, west],
    [north, east],
  ];
};

const encodeBase64Url = (value) => {
  // Tests and build scripts run under Node where Buffer exists, while the
  // deployed app may only have browser base64 APIs.
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  const encodedValue = encodeURIComponent(value).replace(
    /%([0-9A-F]{2})/g,
    (_, hex) => String.fromCharCode(parseInt(hex, 16))
  );

  return window.btoa(encodedValue)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const decodeBase64Url = (value) => {
  const normalizedValue = cleanValue(value)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const paddedValue = normalizedValue.padEnd(
    normalizedValue.length + ((4 - (normalizedValue.length % 4)) % 4),
    "="
  );

  if (typeof Buffer !== "undefined") {
    return Buffer.from(paddedValue, "base64").toString("utf8");
  }

  const binaryValue = window.atob(paddedValue);
  const percentEncoded = Array.from(binaryValue)
    .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`)
    .join("");

  return decodeURIComponent(percentEncoded);
};

const dedupeRecordsById = (records = []) => {
  const seenIds = new Set();

  return records.filter((record) => {
    const recordId = cleanValue(record.id);
    if (!recordId || seenIds.has(recordId)) return false;

    seenIds.add(recordId);
    return true;
  });
};

/**
 * Shared links travel in the URL, so keep only the fields needed to restore a
 * useful offline selection instead of serializing the full record object.
 */
export const createFieldPacketRecordSnapshot = (record = {}) => {
  const snapshot = {
    id: cleanValue(record.id),
    source: cleanValue(record.source) || "burial",
    displayName: cleanValue(record.displayName || formatBrowseResultName(record)),
    label: cleanValue(record.label || record.displayName || formatBrowseResultName(record)),
    fullName: cleanValue(record.fullName || record.displayName || formatBrowseResultName(record)),
    First_Name: cleanValue(record.First_Name),
    Last_Name: cleanValue(record.Last_Name),
    Section: cleanValue(record.Section),
    Lot: cleanValue(record.Lot),
    Tier: cleanValue(record.Tier),
    Grave: cleanValue(record.Grave),
    row: cleanValue(record.row),
    position: cleanValue(record.position),
    Birth: cleanValue(record.Birth),
    Death: cleanValue(record.Death),
    title: cleanValue(record.title),
    tourKey: cleanValue(record.tourKey),
    tourName: cleanValue(record.tourName),
    extraTitle: cleanValue(record.extraTitle || record.Titles),
    matchedBurialId: cleanValue(record.matchedBurialId),
    matchedBurialName: cleanValue(record.matchedBurialName),
    displayAlias: cleanValue(record.displayAlias),
    portraitImageName: cleanValue(record.portraitImageName),
    Bio_Portra: cleanValue(record.Bio_Portra),
    Bio_Portri: cleanValue(record.Bio_Portri),
    Bio_portra: cleanValue(record.Bio_portra),
    Tour_Bio: cleanValue(record.Tour_Bio),
    coordinates: normalizeCoordinates(record.coordinates),
  };

  return Object.fromEntries(
    Object.entries(snapshot).filter(([, value]) => {
      if (value === null || value === "") return false;
      return !Array.isArray(value) || value.length > 0;
    })
  );
};

export const buildDefaultFieldPacketName = ({
  selectedRecords = [],
  sectionFilter = "",
  selectedTour = "",
} = {}) => {
  const recordCount = selectedRecords.length;

  if (selectedTour) {
    return selectedTour;
  }

  if (sectionFilter) {
    return `Section ${sectionFilter}`;
  }

  if (recordCount === 1) {
    return formatBrowseResultName(selectedRecords[0]);
  }

  if (recordCount > 1) {
    return `Shared selection (${recordCount})`;
  }

  return "Shared selection";
};

/**
 * Normalize packet state on both encode and decode so invalid ids, coordinates,
 * and bounds never leak back into the restored map state.
 */
export const buildFieldPacketState = ({
  name = "",
  note = "",
  selectedRecords = [],
  activeBurialId = "",
  sectionFilter = "",
  selectedTour = "",
  mapBounds = null,
} = {}) => {
  const normalizedRecords = dedupeRecordsById(
    selectedRecords.map((record) => createFieldPacketRecordSnapshot(record))
  );
  const normalizedSelectedIds = normalizedRecords.map((record) => record.id);
  const preferredActiveId = cleanValue(activeBurialId);
  const normalizedActiveId = !preferredActiveId
    ? ""
    : (
      normalizedSelectedIds.includes(preferredActiveId)
        ? preferredActiveId
        : (normalizedSelectedIds[0] || "")
    );
  const normalizedSectionFilter = cleanValue(sectionFilter);
  const normalizedSelectedTour = cleanValue(selectedTour);

  return {
    version: 1,
    name: cleanValue(name) || buildDefaultFieldPacketName({
      selectedRecords: normalizedRecords,
      sectionFilter: normalizedSectionFilter,
      selectedTour: normalizedSelectedTour,
    }),
    note: cleanValue(note),
    activeBurialId: normalizedActiveId,
    selectedBurialIds: normalizedSelectedIds,
    selectedRecords: normalizedRecords,
    sectionFilter: normalizedSectionFilter,
    selectedTour: normalizedSelectedTour,
    mapBounds: normalizeMapBounds(mapBounds),
  };
};

export const encodeFieldPacket = (packet = {}) => (
  encodeBase64Url(JSON.stringify(buildFieldPacketState(packet)))
);

// Shared links are optional and user-editable URLs, so decoding stays
// forgiving and simply returns null for malformed payloads.
export const parseFieldPacketValue = (value = "") => {
  const encodedValue = cleanValue(value);
  if (!encodedValue) return null;

  try {
    const decodedValue = decodeBase64Url(encodedValue);
    const parsedValue = JSON.parse(decodedValue);
    return buildFieldPacketState(parsedValue);
  } catch (error) {
    return null;
  }
};

/**
 * Decode both lightweight query-string deep links and the packed shared-link
 * payload so callers do not have to duplicate URL parsing rules.
 */
export const parseDeepLinkState = (search = "", tourNames = []) => {
  const query = search.startsWith("?") ? search : `?${search}`;
  const params = new URLSearchParams(query);

  const section = cleanValue(params.get(ROUTING_QUERY_PARAMS.section));
  const view = cleanValue(params.get(ROUTING_QUERY_PARAMS.view)).toLowerCase();
  const textQuery = cleanValue(params.get(ROUTING_QUERY_PARAMS.search));
  const rawTour = cleanValue(params.get(ROUTING_QUERY_PARAMS.tour)).toLowerCase();
  const fieldPacket = parseFieldPacketValue(params.get(SHARED_LINK_QUERY_PARAM));

  const selectedTourName = rawTour
    ? tourNames.find((tourName) => tourName.toLowerCase().includes(rawTour)) || null
    : null;

  return {
    section,
    query: textQuery,
    view,
    rawTour,
    selectedTourName,
    fieldPacket,
    showBurialsView: view === "burials",
    showToursView: view === "tours",
  };
};

export const buildFieldPacketShareUrl = ({
  packet,
  currentUrl = "",
} = {}) => {
  const packetState = buildFieldPacketState(packet);
  if (packetState.selectedRecords.length === 0 || !cleanValue(currentUrl)) {
    return "";
  }

  const url = new URL(currentUrl);
  // Remove the loose deep-link params first so the receiving client only has to
  // apply one coherent selection payload.
  FIELD_PACKET_STATE_QUERY_KEYS.forEach((key) => {
    url.searchParams.delete(key);
  });
  url.searchParams.set(SHARED_LINK_QUERY_PARAM, encodeFieldPacket(packetState));

  return url.toString();
};

const clampText = (value, maxLength = 160) => {
  const text = cleanValue(value);
  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

export const formatSharedSelectionCountLabel = (count = 0) => {
  const normalizedCount = Number.isFinite(Number(count)) ? Number(count) : 0;
  return `${normalizedCount} selected record${normalizedCount === 1 ? "" : "s"}`;
};

export const buildSharedSelectionPresentation = (packet = {}) => {
  const selectedRecords = Array.isArray(packet.selectedRecords) ? packet.selectedRecords : [];
  const recordCount = selectedRecords.length;
  const sectionFilter = cleanValue(packet.sectionFilter);
  const selectedTour = cleanValue(packet.selectedTour);
  const note = cleanValue(packet.note);
  const explicitName = cleanValue(packet.name);
  const leadRecord = selectedRecords[0] || null;
  const leadName = leadRecord ? cleanValue(formatBrowseResultName(leadRecord)) : "";
  const sectionLabel = sectionFilter ? `Section ${sectionFilter}` : "";
  const countLabel = formatSharedSelectionCountLabel(recordCount);

  const title = explicitName ||
    selectedTour ||
    sectionLabel ||
    leadName ||
    "Shared selection";

  let description = note;

  if (!description && selectedTour && recordCount > 0) {
    description = `${countLabel} on the ${selectedTour}.`;
  } else if (!description && sectionLabel && recordCount > 0) {
    description = `${countLabel} in ${sectionLabel}.`;
  } else if (!description && leadName) {
    description = `Shared map view for ${leadName}${sectionLabel ? ` in ${sectionLabel}` : ""}.`;
  } else if (!description && recordCount > 0) {
    description = `Shared map view for ${countLabel}${sectionLabel ? ` in ${sectionLabel}` : ""}.`;
  } else if (!description) {
    description = "Shared map view for Albany Rural Cemetery.";
  }

  return {
    title,
    description: clampText(description),
    countLabel,
    sectionLabel,
    selectedTour,
    recordCount,
  };
};
