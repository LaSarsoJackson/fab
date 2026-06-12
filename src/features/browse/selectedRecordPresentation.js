import { cleanRecordValue } from "../map/mapRecordPresentation";

const DETAIL_ROW_EXCLUDE_LABELS = ["Location", "Born", "Died"];

export const buildSelectedPlaceInitials = (heading = "") => {
  const words = cleanRecordValue(heading).split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || "AR";
};

export const getSelectedPlaceTypeLabel = (record = {}) => {
  if (record.source === "tour" || cleanRecordValue(record.tourName)) {
    return "Tour stop";
  }

  return "Grave";
};

export const getSelectedPlaceDetailRows = (rows = []) => (
  rows.filter(({ label }) => !DETAIL_ROW_EXCLUDE_LABELS.includes(label))
);

export const hasFieldPacketContent = (fieldPacket) => {
  if (!fieldPacket) {
    return false;
  }

  return Boolean(
    (fieldPacket.selectedRecords?.length ?? 0) > 0 ||
    cleanRecordValue(fieldPacket.name) ||
    cleanRecordValue(fieldPacket.note) ||
    fieldPacket.sectionFilter ||
    fieldPacket.selectedTour ||
    fieldPacket.mapBounds
  );
};
