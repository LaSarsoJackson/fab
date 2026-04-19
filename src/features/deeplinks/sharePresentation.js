import { formatBrowseResultName } from "../browse/browseResults";

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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
