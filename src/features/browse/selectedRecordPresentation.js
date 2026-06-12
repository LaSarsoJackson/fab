import { cleanRecordValue } from "../map/mapRecordPresentation";

const DETAIL_ROW_EXCLUDE_LABELS = ["Location", "Born", "Died"];
const SINGLE_SELECTION_PANEL_TITLE = "Selected grave";
const STACK_SELECTION_PANEL_TITLE = "Graves at this spot";

export const buildSelectedSummaryPresentation = ({
  activeBurialId = "",
  activeRouteBurialId = "",
  isExpanded = false,
  isMobile = false,
  selectedBurialCoordinateGroups = [],
  selectedBurials = [],
} = {}) => {
  const leadBurial = selectedBurials.find((burial) => burial.id === activeBurialId)
    || selectedBurials[0]
    || null;

  if (!leadBurial) {
    return null;
  }

  const secondarySelectedBurials = selectedBurials.filter((burial) => burial.id !== leadBurial.id);
  const selectedBurialOrderById = new Map(selectedBurials.map((burial, index) => [burial.id, index]));
  const leadBurialIndex = selectedBurialOrderById.get(leadBurial.id) ?? 0;
  const hasMultipleSelectedBurials = selectedBurials.length > 1;
  const selectionSummaryTitle = hasMultipleSelectedBurials
    ? STACK_SELECTION_PANEL_TITLE
    : SINGLE_SELECTION_PANEL_TITLE;
  const mobileSelectionSummaryTitle = hasMultipleSelectedBurials
    ? `${selectedBurials.length} graves here`
    : selectionSummaryTitle;
  const selectionSummaryLabel = hasMultipleSelectedBurials
    ? `${selectedBurials.length} graves share this map location.`
    : "";
  const leadCoordinateGroup = selectedBurialCoordinateGroups.find((group) => (
    group.recordIds.includes(leadBurial.id)
  ));
  const leadStackRecords = leadCoordinateGroup?.records || [];
  const activeStackIndex = leadStackRecords.findIndex((record) => record.id === leadBurial.id);
  const leadStackList = isMobile && leadStackRecords.length > 1 && activeStackIndex >= 0
    ? {
        records: leadStackRecords,
        activeRecordId: leadBurial.id,
        description: `${leadStackRecords.length} burial records at this marker`,
      }
    : null;

  return {
    hasMultipleSelectedBurials,
    isLeadBurialActive: leadBurial.id === activeBurialId,
    isRouteActive: activeRouteBurialId === leadBurial.id,
    leadBurial,
    leadBurialIndex,
    leadStackList,
    mobileSelectionSummaryTitle,
    secondarySelectedBurials,
    selectedBurialOrderById,
    selectionSummaryLabel,
    selectionSummaryTitle,
    shouldShowSecondarySelections: secondarySelectedBurials.length > 0 && (!isMobile || isExpanded),
    shouldShowSelectionToggle: isMobile && hasMultipleSelectedBurials,
  };
};

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
