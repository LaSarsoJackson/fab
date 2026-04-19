import { formatBrowseResultName } from "../browse/browseResults";

export const SHARED_LINK_QUERY_PARAM = "share";
export const LEGACY_FIELD_PACKET_QUERY_PARAM = "packet";

// Packed shared links become the single source of truth in portable URLs, so
// strip the ad-hoc view/query params that would otherwise compete with them.
const FIELD_PACKET_STATE_QUERY_KEYS = [
  "section",
  "tour",
  "view",
  "q",
  SHARED_LINK_QUERY_PARAM,
  LEGACY_FIELD_PACKET_QUERY_PARAM,
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
