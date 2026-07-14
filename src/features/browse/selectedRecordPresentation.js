import { cleanRecordValue } from "../map/mapRecordPresentation";

export const DEFAULT_SELECTED_PLACE_DETAIL_ROW_LIMIT = 4;
const DETAIL_ROW_EXCLUDE_LABELS = ["Location", "Born", "Died"];
const SINGLE_SELECTION_PANEL_TITLE = "Selected burial";
const STACK_SELECTION_PANEL_TITLE = "People at this plot";

const formatLocationValue = (value) => {
  const normalized = cleanRecordValue(value);
  return normalized && normalized !== "0" ? normalized : "";
};

export const buildSelectedLocationLabel = (record = {}) => {
  const section = formatLocationValue(record.Section ?? record.section);
  const lot = formatLocationValue(record.Lot ?? record.lot);
  const tier = formatLocationValue(record.Tier ?? record.tier);
  const grave = formatLocationValue(record.Grave ?? record.grave);

  return [
    section ? `Section ${section}` : "",
    lot ? `Lot ${lot}` : "",
    tier ? `Tier ${tier}` : "",
    grave ? `Grave ${grave}` : "",
  ].filter(Boolean).join(" · ");
};

export const buildSelectedBurialLookup = ({
  selectedBurials = [],
} = {}) => {
  const selectedBurialIds = new Set();
  const selectedBurialOrderById = new Map();

  selectedBurials.forEach((burial, index) => {
    if (!burial?.id) {
      return;
    }

    selectedBurialIds.add(burial.id);
    selectedBurialOrderById.set(burial.id, index);
  });

  return {
    selectedBurialCount: selectedBurials.length,
    selectedBurialIds,
    selectedBurialOrderById,
  };
};

export const buildSelectedSummaryPresentation = ({
  activeBurialId = "",
  activeRouteBurialId = "",
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
    ? `${selectedBurials.length} people at this plot`
    : selectionSummaryTitle;
  const selectionSummaryLabel = hasMultipleSelectedBurials
    ? `${selectedBurials.length} burial records share this mapped cemetery location.`
    : "";
  const leadCoordinateGroup = selectedBurialCoordinateGroups.find((group) => (
    group.recordIds.includes(leadBurial.id)
  ));
  const leadStackRecords = leadCoordinateGroup?.records || [];
  const activeStackIndex = leadStackRecords.findIndex((record) => record.id === leadBurial.id);
  const isSingleLocationSelection = leadStackRecords.length === selectedBurials.length;
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
    locationLabel: buildSelectedLocationLabel(leadBurial),
    mobileSelectionSummaryTitle,
    secondarySelectedBurials,
    selectedBurialOrderById,
    selectionSummaryLabel,
    selectionSummaryTitle,
    shouldShowSecondarySelections: secondarySelectedBurials.length > 0
      && !isSingleLocationSelection,
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

export const buildSelectedPlaceDetailPresentation = ({
  detailLinkUrl = "",
  isExpanded = false,
  rows = [],
  visibleRowLimit = DEFAULT_SELECTED_PLACE_DETAIL_ROW_LIMIT,
} = {}) => {
  const allDetailRows = getSelectedPlaceDetailRows(rows);
  const normalizedVisibleRowLimit = Number.isFinite(Number(visibleRowLimit)) && Number(visibleRowLimit) > 0
    ? Number(visibleRowLimit)
    : DEFAULT_SELECTED_PLACE_DETAIL_ROW_LIMIT;
  const hiddenCount = Math.max(0, allDetailRows.length - normalizedVisibleRowLimit);

  return {
    allDetailRows,
    detailLinkUrl: cleanRecordValue(detailLinkUrl),
    hasDetailsContent: allDetailRows.length > 0 || Boolean(cleanRecordValue(detailLinkUrl)),
    hasMoreRows: hiddenCount > 0,
    hiddenCount,
    visibleRows: isExpanded
      ? allDetailRows
      : allDetailRows.slice(0, normalizedVisibleRowLimit),
  };
};

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
