import {
  buildLocationParts,
  formatBrowseResultName,
} from "./browseResults";
import { buildLifeDatesSummary } from "./sidebarPresentation";

const RESULT_LOCATION_SEPARATOR = " \u00b7 ";

export const buildBrowseResultCardPresentation = ({
  result = {},
  scopedSectionLabel = "",
  scopedTourLabel = "",
  tourStyleName = "",
} = {}) => {
  const locationSummary = buildLocationParts(result)
    .filter((part) => !(scopedSectionLabel && part === scopedSectionLabel))
    .join(RESULT_LOCATION_SEPARATOR);
  const resultTourLabel = result.tourName || tourStyleName || "";
  const tourChipLabel = Boolean(resultTourLabel)
    && !(scopedTourLabel && resultTourLabel === scopedTourLabel)
    ? resultTourLabel
    : "";

  return {
    displayName: formatBrowseResultName(result),
    lifeSummary: buildLifeDatesSummary(result),
    locationSummary,
    secondarySummary: locationSummary ? "" : (result.secondaryText || ""),
    tourChipLabel,
  };
};
