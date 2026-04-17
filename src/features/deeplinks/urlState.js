import { FIELD_PACKET_QUERY_PARAM, parseFieldPacketValue } from "./fieldPackets";

const clean = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

/**
 * Decode both the lightweight query-string deep-link params and the packed
 * field-packet payload so callers do not have to duplicate URL parsing rules.
 */
export const parseDeepLinkState = (search = '', tourNames = []) => {
  const query = search.startsWith('?') ? search : `?${search}`;
  const params = new URLSearchParams(query);

  const section = clean(params.get('section'));
  const view = clean(params.get('view')).toLowerCase();
  const textQuery = clean(params.get('q'));
  const rawTour = clean(params.get('tour')).toLowerCase();
  const fieldPacket = parseFieldPacketValue(params.get(FIELD_PACKET_QUERY_PARAM));

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
    showBurialsView: view === 'burials',
    showToursView: view === 'tours',
  };
};
