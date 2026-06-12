import {
  buildLocationParts,
  formatBrowseResultName,
} from "./browseResults";
import { buildLifeDatesSummary } from "./sidebarPresentation";

const RESULT_METADATA_SEPARATOR = " \u2022 ";

export const buildBrowseResultCardPresentation = ({
  result = {},
  scopedSectionLabel = "",
  scopedTourLabel = "",
  tourStyleName = "",
} = {}) => {
  const locationSummary = buildLocationParts(result)
    .filter((part) => !(scopedSectionLabel && part === scopedSectionLabel))
    .join(", ");
  const shouldShowSectionChip = Boolean(result.Section)
    && `Section ${result.Section}` !== scopedSectionLabel;
  const metadataSummary = [
    shouldShowSectionChip ? `Section ${result.Section}` : "",
    result.Lot ? `Lot ${result.Lot}` : "",
    result.Tier ? `Tier ${result.Tier}` : "",
  ].filter(Boolean).join(RESULT_METADATA_SEPARATOR);
  const resultTourLabel = result.tourName || tourStyleName || "";
  const tourChipLabel = Boolean(resultTourLabel)
    && !(scopedTourLabel && resultTourLabel === scopedTourLabel)
    ? resultTourLabel
    : "";

  return {
    displayName: formatBrowseResultName(result),
    lifeSummary: buildLifeDatesSummary(result),
    locationSummary,
    metadataSummary,
    secondarySummary: locationSummary ? "" : (result.secondaryText || ""),
    tourChipLabel,
  };
};
