import { parseFieldPacketValue, SHARED_LINK_QUERY_PARAM } from "./fieldPackets";
import { ROUTING_QUERY_PARAMS } from "../../shared/routing";

const clean = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

/**
 * Decode both the lightweight query-string deep-link params and the packed
 * shared-link payload so callers do not have to duplicate URL parsing rules.
 */
export const parseDeepLinkState = (search = '', tourNames = []) => {
  const query = search.startsWith('?') ? search : `?${search}`;
  const params = new URLSearchParams(query);

  const section = clean(params.get(ROUTING_QUERY_PARAMS.section));
  const view = clean(params.get(ROUTING_QUERY_PARAMS.view)).toLowerCase();
  const textQuery = clean(params.get(ROUTING_QUERY_PARAMS.search));
  const rawTour = clean(params.get(ROUTING_QUERY_PARAMS.tour)).toLowerCase();
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
    showBurialsView: view === 'burials',
    showToursView: view === 'tours',
  };
};
