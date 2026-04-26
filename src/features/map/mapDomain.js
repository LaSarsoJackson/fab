import { getGeoJsonBounds, isLatLngBoundsExpressionValid } from "../../shared/geo/geoJsonBounds";

//=============================================================================
// Module Boundary
//=============================================================================

/**
 * Keep pure map business rules in one place.
 *
 * This file owns decisions about:
 * - how selection and pinned-record state stay normalized
 * - how sections group and when their overlays appear
 * - how hover and pointer state behave
 * - how burial and section styles are derived
 * - how geolocation fixes are normalized and filtered
 * - how PMTiles experiment glyphs are shaped
 *
 * It intentionally does not own React state, refs, DOM, or Leaflet/runtime
 * lifecycles. Those stay in the map shell and renderer-specific modules.
 */

//=============================================================================
// Shared Helpers
//=============================================================================

const EARTH_RADIUS_METERS = 6371008.8;
const TOUCH_LIKE_POINTER_TYPES = new Set(["touch", "pen"]);

export const MAP_PRESENTATION_POLICY = Object.freeze({
  sectionOverviewMarkerMinZoom: 13,
  sectionOverviewLabelMinZoom: 15,
  sectionDetailMinZoom: 16,
  sectionBrowseFocusMaxZoom: 17,
  burialFocusMinZoom: 17,
  sectionBurialIndividualMinZoom: 20,
  sectionBurialClusterRadius: 64,
});
export const SECTION_AFFORDANCE_MARKER_SIZE_RANGE = Object.freeze({
  min: 25,
  max: 31,
});

const normalizeSectionValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toRadians = (value) => (Number(value) * Math.PI) / 180;
const toDegrees = (value) => (Number(value) * 180) / Math.PI;

//=============================================================================
// Interaction Rules
//=============================================================================

export const inferPointerType = (event) => {
  const pointerType = event?.pointerType ?? event?.nativeEvent?.pointerType;
  if (pointerType) {
    return String(pointerType).toLowerCase();
  }

  if (typeof event?.type === "string" && event.type.startsWith("touch")) {
    return "touch";
  }

  return "mouse";
};

export const isTouchLikePointerType = (pointerType) => (
  TOUCH_LIKE_POINTER_TYPES.has(String(pointerType || "").toLowerCase())
);

export const shouldHandleSectionHover = ({
  canHover = true,
  recentTouchInteraction = false,
} = {}) => canHover && !recentTouchInteraction;

export const stopMapInteractionPropagation = (event) => {
  if (!event) return;

  if (typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }

  const nativeEvent = event.nativeEvent;
  if (nativeEvent && typeof nativeEvent.stopPropagation === "function") {
    nativeEvent.stopPropagation();
  }
  if (nativeEvent && typeof nativeEvent.stopImmediatePropagation === "function") {
    nativeEvent.stopImmediatePropagation();
  }
};

const normalizeLeafletHoverSectionId = (sectionId) => {
  if (sectionId === null || sectionId === undefined || sectionId === "") {
    return null;
  }

  return String(sectionId);
};

export const createLeafletSectionHoverState = ({
  sectionId = null,
  layer = null,
} = {}) => ({
  sectionId: normalizeLeafletHoverSectionId(sectionId),
  layer: layer || null,
});

export const beginLeafletSectionHover = (currentHoverState, nextHoverState) => {
  const currentState = createLeafletSectionHoverState(currentHoverState);
  const nextState = createLeafletSectionHoverState(nextHoverState);

  return {
    clearedHoverState:
      currentState.layer && currentState.layer !== nextState.layer
        ? currentState
        : null,
    nextHoverState: nextState,
  };
};

export const clearLeafletSectionHover = (currentHoverState) => {
  const currentState = createLeafletSectionHoverState(currentHoverState);

  return {
    clearedHoverState: currentState.layer ? currentState : null,
    nextHoverState: createLeafletSectionHoverState(),
  };
};

export const isLeafletSectionLayerHovered = (currentHoverState, layer) => (
  Boolean(layer) && currentHoverState?.layer === layer
);

export const shouldIgnoreSectionBackgroundSelection = ({
  clickedSection,
  activeSection,
} = {}) => {
  const nextClickedSection = normalizeSectionValue(clickedSection);
  if (!nextClickedSection) {
    return false;
  }

  return nextClickedSection === normalizeSectionValue(activeSection);
};

//=============================================================================
// Selection State Rules
//=============================================================================

const normalizeBurialId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const nextValue = String(value).trim();
  return nextValue || null;
};

const dedupeSelectedBurials = (selectedBurials = []) => {
  const seenIds = new Set();
  const nextSelectedBurials = [];

  selectedBurials.forEach((burial) => {
    const burialId = normalizeBurialId(burial?.id);
    if (!burialId || seenIds.has(burialId)) {
      return;
    }

    seenIds.add(burialId);
    nextSelectedBurials.push(burial);
  });

  return nextSelectedBurials;
};

const upsertSelectedBurial = (selectedBurials = [], burial) => {
  const burialId = normalizeBurialId(burial?.id);
  if (!burialId) {
    return dedupeSelectedBurials(selectedBurials);
  }

  let didReplace = false;
  const nextSelectedBurials = dedupeSelectedBurials(selectedBurials).map((record) => {
    if (record.id !== burialId) {
      return record;
    }

    didReplace = true;
    return burial;
  });

  if (!didReplace) {
    nextSelectedBurials.push(burial);
  }

  return nextSelectedBurials;
};

export const createMapSelectionState = ({
  selectedBurials = [],
  activeBurialId = null,
  hoveredBurialId = null,
} = {}) => {
  const nextSelectedBurials = dedupeSelectedBurials(selectedBurials);
  const selectedBurialIds = new Set(nextSelectedBurials.map((burial) => burial.id));
  const nextActiveBurialId = normalizeBurialId(activeBurialId);
  const activeSelectedBurialId = nextActiveBurialId && selectedBurialIds.has(nextActiveBurialId)
    ? nextActiveBurialId
    : null;
  const nextHoveredBurialId = normalizeBurialId(hoveredBurialId);

  return {
    selectedBurials: nextSelectedBurials,
    activeBurialId: activeSelectedBurialId,
    hoveredBurialId: nextHoveredBurialId !== activeSelectedBurialId
      ? nextHoveredBurialId
      : null,
  };
};

const focusSelectionBurial = (selectionState, burial) => {
  const burialId = normalizeBurialId(burial?.id);
  if (!burialId || !burial) {
    return createMapSelectionState(selectionState);
  }

  return createMapSelectionState({
    ...selectionState,
    selectedBurials: upsertSelectedBurial(selectionState?.selectedBurials, burial),
    activeBurialId: burialId,
    hoveredBurialId: null,
  });
};

const replaceSelectionBurials = (
  selectionState,
  {
    selectedBurials = [],
    activeBurialId = null,
    hoveredBurialId = null,
  } = {}
) => (
  createMapSelectionState({
    ...selectionState,
    selectedBurials,
    activeBurialId,
    hoveredBurialId,
  })
);

const removeSelectionBurial = (selectionState, burialId) => {
  const normalizedBurialId = normalizeBurialId(burialId);
  const nextSelectedBurials = (selectionState?.selectedBurials || [])
    .filter((burial) => burial.id !== normalizedBurialId);

  return createMapSelectionState({
    ...selectionState,
    selectedBurials: nextSelectedBurials,
    activeBurialId: selectionState?.activeBurialId === normalizedBurialId
      ? null
      : selectionState?.activeBurialId,
    hoveredBurialId: selectionState?.hoveredBurialId === normalizedBurialId
      ? null
      : selectionState?.hoveredBurialId,
  });
};

const clearSelectionFocus = (
  selectionState,
  { clearHover = false } = {}
) => (
  createMapSelectionState({
    ...selectionState,
    activeBurialId: null,
    hoveredBurialId: clearHover ? null : selectionState?.hoveredBurialId,
  })
);

const setSelectionHover = (selectionState, hoveredBurialId) => (
  createMapSelectionState({
    ...selectionState,
    hoveredBurialId,
  })
);

const refreshSelectionBurials = (selectionState, getNextBurial) => {
  if (typeof getNextBurial !== "function") {
    return createMapSelectionState(selectionState);
  }

  const nextSelectedBurials = (selectionState?.selectedBurials || []).map((burial) => (
    getNextBurial(burial) || burial
  ));

  return createMapSelectionState({
    ...selectionState,
    selectedBurials: nextSelectedBurials,
  });
};

export const MAP_SELECTION_ACTION_TYPES = Object.freeze({
  CLEAR_FOCUS: "clearFocus",
  CLEAR_FOCUS_FOR_RECORD: "clearFocusForRecord",
  FOCUS_RECORD: "focusRecord",
  REFRESH_RECORDS: "refreshRecords",
  REMOVE_RECORD: "removeRecord",
  REPLACE_RECORDS: "replaceRecords",
  RESET: "reset",
  SET_HOVER: "setHover",
});

export const clearMapSelectionFocus = ({ clearHover = false } = {}) => ({
  type: MAP_SELECTION_ACTION_TYPES.CLEAR_FOCUS,
  clearHover,
});

export const clearMapSelectionFocusForRecord = (recordId) => ({
  type: MAP_SELECTION_ACTION_TYPES.CLEAR_FOCUS_FOR_RECORD,
  recordId,
});

export const focusMapSelectionRecord = (record) => ({
  type: MAP_SELECTION_ACTION_TYPES.FOCUS_RECORD,
  record,
});

export const refreshMapSelectionRecords = (getNextRecord) => ({
  type: MAP_SELECTION_ACTION_TYPES.REFRESH_RECORDS,
  getNextRecord,
});

export const removeMapSelectionRecord = (recordId) => ({
  type: MAP_SELECTION_ACTION_TYPES.REMOVE_RECORD,
  recordId,
});

export const replaceMapSelectionRecords = ({
  activeRecordId = null,
  hoveredRecordId = null,
  records = [],
} = {}) => ({
  type: MAP_SELECTION_ACTION_TYPES.REPLACE_RECORDS,
  activeRecordId,
  hoveredRecordId,
  records,
});

export const resetMapSelection = () => ({
  type: MAP_SELECTION_ACTION_TYPES.RESET,
});

export const setMapSelectionHover = (recordId) => ({
  type: MAP_SELECTION_ACTION_TYPES.SET_HOVER,
  recordId,
});

export const reduceMapSelectionState = (selectionState, action = {}) => {
  switch (action.type) {
    case MAP_SELECTION_ACTION_TYPES.CLEAR_FOCUS:
      return clearSelectionFocus(selectionState, { clearHover: Boolean(action.clearHover) });

    case MAP_SELECTION_ACTION_TYPES.CLEAR_FOCUS_FOR_RECORD:
      return selectionState?.activeBurialId === normalizeBurialId(action.recordId)
        ? clearSelectionFocus(selectionState)
        : createMapSelectionState(selectionState);

    case MAP_SELECTION_ACTION_TYPES.FOCUS_RECORD:
      return focusSelectionBurial(selectionState, action.record);

    case MAP_SELECTION_ACTION_TYPES.REFRESH_RECORDS:
      return refreshSelectionBurials(selectionState, action.getNextRecord);

    case MAP_SELECTION_ACTION_TYPES.REMOVE_RECORD:
      return removeSelectionBurial(selectionState, action.recordId);

    case MAP_SELECTION_ACTION_TYPES.REPLACE_RECORDS:
      return replaceSelectionBurials(selectionState, {
        selectedBurials: action.records,
        activeBurialId: action.activeRecordId,
        hoveredBurialId: action.hoveredRecordId,
      });

    case MAP_SELECTION_ACTION_TYPES.RESET:
      return createMapSelectionState();

    case MAP_SELECTION_ACTION_TYPES.SET_HOVER:
      return setSelectionHover(selectionState, action.recordId);

    default:
      return createMapSelectionState(selectionState);
  }
};

//=============================================================================
// Section Grouping And Overlay Rules
//=============================================================================

const compareSectionValues = (left, right) => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
};

const buildSectionFeatureGroups = (sectionsGeoJson = {}) => {
  const groups = new Map();

  (sectionsGeoJson.features || []).forEach((feature) => {
    const sectionValue = normalizeSectionValue(feature?.properties?.Section);
    if (!sectionValue) {
      return;
    }

    const currentGroup = groups.get(sectionValue);
    if (currentGroup) {
      currentGroup.features.push(feature);
      return;
    }

    groups.set(sectionValue, {
      sectionValue,
      features: [feature],
    });
  });

  return groups;
};

const buildGroupedSectionBounds = (groups) => (
  [...groups.values()]
    .map(({ sectionValue, features }) => {
      const bounds = getGeoJsonBounds({
        type: "FeatureCollection",
        features,
      });

      if (!isLatLngBoundsExpressionValid(bounds)) {
        return null;
      }

      return {
        sectionValue,
        bounds,
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareSectionValues(left.sectionValue, right.sectionValue))
);

export const buildSectionBoundsById = (sectionsGeoJson = {}) => {
  const sectionBounds = buildGroupedSectionBounds(buildSectionFeatureGroups(sectionsGeoJson));
  return new Map(sectionBounds.map(({ sectionValue, bounds }) => [sectionValue, bounds]));
};

export const resolveSectionAffordanceMarkerSize = ({
  count = 0,
  maxCount = 0,
} = {}) => {
  const normalizedCount = Math.max(0, Number(count) || 0);
  const normalizedMaxCount = Math.max(normalizedCount, Number(maxCount) || 0);

  if (normalizedMaxCount <= 0) {
    return SECTION_AFFORDANCE_MARKER_SIZE_RANGE.min;
  }

  const countRatio = Math.sqrt(normalizedCount / normalizedMaxCount);
  const markerSize = SECTION_AFFORDANCE_MARKER_SIZE_RANGE.min + (
    countRatio *
    (SECTION_AFFORDANCE_MARKER_SIZE_RANGE.max - SECTION_AFFORDANCE_MARKER_SIZE_RANGE.min)
  );

  return Number(markerSize.toFixed(1));
};

export const buildSectionAffordanceMarkers = (sectionsGeoJson = {}, sectionCounts = new Map()) => {
  const maxCount = Math.max(
    0,
    ...Array.from(sectionCounts.values())
      .map((value) => Number(value) || 0)
      .filter((value) => value > 0)
  );

  return buildGroupedSectionBounds(buildSectionFeatureGroups(sectionsGeoJson))
    .map(({ sectionValue, bounds }) => {
      const [[south, west], [north, east]] = bounds;
      const count = sectionCounts.get(sectionValue) || 0;

      return {
        id: `section-affordance:${sectionValue}`,
        sectionValue,
        count,
        size: resolveSectionAffordanceMarkerSize({ count, maxCount }),
        lat: (south + north) / 2,
        lng: (west + east) / 2,
        bounds,
      };
    })
    .filter(Boolean);
};

export const buildSectionOverviewMarkers = (sectionsGeoJson = {}, sectionCounts = new Map()) => (
  buildGroupedSectionBounds(buildSectionFeatureGroups(sectionsGeoJson))
    .map(({ sectionValue, bounds }) => {
      const [[south, west], [north, east]] = bounds;
      const count = sectionCounts.get(sectionValue) || 0;

      if (count <= 0) {
        return null;
      }

      return {
        id: `section-overview:${sectionValue}`,
        sectionValue,
        count,
        lat: (south + north) / 2,
        lng: (west + east) / 2,
        bounds,
      };
    })
    .filter(Boolean)
);

export const formatSectionOverviewMarkerLabel = (marker = {}) => {
  const sectionValue = normalizeSectionValue(marker.sectionValue);
  const burialCount = Number(marker.count) || 0;

  if (!sectionValue) {
    return "";
  }

  return `Section ${sectionValue} • ${burialCount.toLocaleString()} burials`;
};

export const resolveSectionOverlayVisibility = ({
  currentZoom = 0,
  preferOverviewMarkers = false,
  sectionDetailMinZoom = MAP_PRESENTATION_POLICY.sectionDetailMinZoom,
  sectionFilter = "",
  sectionOverviewMarkerMinZoom = MAP_PRESENTATION_POLICY.sectionOverviewMarkerMinZoom,
  selectedTour = null,
} = {}) => {
  const hasFocusedContext = Boolean(
    normalizeSectionValue(sectionFilter) ||
    normalizeSectionValue(selectedTour)
  );

  if (!preferOverviewMarkers) {
    return {
      showSectionOverviewMarkers: false,
      showSections: true,
    };
  }

  return {
    showSectionOverviewMarkers: (
      !hasFocusedContext &&
      currentZoom >= sectionOverviewMarkerMinZoom &&
      currentZoom < sectionDetailMinZoom
    ),
    showSections: hasFocusedContext || currentZoom >= sectionDetailMinZoom,
  };
};

export const resolveSectionAffordanceMarkerVisibility = ({
  currentZoom = 0,
  preferOverviewMarkers = false,
  sectionAffordanceMarkerMinZoom = MAP_PRESENTATION_POLICY.sectionOverviewMarkerMinZoom,
  sectionDetailMinZoom = MAP_PRESENTATION_POLICY.sectionDetailMinZoom,
  sectionFilter = "",
  selectedTour = null,
} = {}) => {
  const hasFocusedContext = Boolean(
    normalizeSectionValue(sectionFilter) ||
    normalizeSectionValue(selectedTour)
  );

  if (preferOverviewMarkers) {
    return false;
  }

  return (
    !hasFocusedContext &&
    currentZoom >= sectionAffordanceMarkerMinZoom &&
    currentZoom < sectionDetailMinZoom
  );
};

export const resolveSectionClusterMarkerVisibility = ({
  currentZoom = 0,
  sectionDetailMinZoom = MAP_PRESENTATION_POLICY.sectionDetailMinZoom,
  sectionFilter = "",
  selectedTour = null,
} = {}) => {
  const hasFocusedContext = Boolean(
    normalizeSectionValue(sectionFilter) ||
    normalizeSectionValue(selectedTour)
  );

  return !hasFocusedContext && currentZoom >= sectionDetailMinZoom;
};

export const resolveSectionBurialDisableClusteringZoom = ({
  defaultDisableClusteringZoom = MAP_PRESENTATION_POLICY.sectionBurialIndividualMinZoom,
  maxZoom,
} = {}) => {
  if (!Number.isFinite(maxZoom)) {
    return defaultDisableClusteringZoom;
  }

  return Math.max(0, Math.min(defaultDisableClusteringZoom, Math.floor(maxZoom)));
};

export const resolveClusterExpansionZoom = ({
  disableClusteringAtZoom,
} = {}) => {
  const terminalZoom = Number.isFinite(disableClusteringAtZoom)
    ? disableClusteringAtZoom
    : MAP_PRESENTATION_POLICY.sectionBurialIndividualMinZoom;

  return Math.max(0, terminalZoom);
};

export const resolveRoadOverlayVisibility = ({
  roadOverlayVisible = false,
  hasActiveRoute = false,
  hasTrackedLocation = false,
} = {}) => (
  Boolean(roadOverlayVisible || hasActiveRoute || hasTrackedLocation)
);

export const areRouteLatLngTuplesEquivalent = (left, right) => (
  Array.isArray(left) &&
  Array.isArray(right) &&
  Number(left[0]) === Number(right[0]) &&
  Number(left[1]) === Number(right[1])
);

export const shouldResetRouteGeometryForRequest = ({
  renderedDestination,
  requestedDestination,
} = {}) => !areRouteLatLngTuplesEquivalent(renderedDestination, requestedDestination);

export const resolveMapPresentationPolicy = ({
  currentZoom = 0,
  maxZoom,
  sectionFilter = "",
  selectedTour = null,
  roadOverlayVisible = false,
  hasActiveRoute = false,
  hasTrackedLocation = false,
  preferSectionOverviewMarkers = false,
} = {}) => {
  const sectionVisibility = resolveSectionOverlayVisibility({
    currentZoom,
    preferOverviewMarkers: preferSectionOverviewMarkers,
    sectionDetailMinZoom: MAP_PRESENTATION_POLICY.sectionDetailMinZoom,
    sectionFilter,
    sectionOverviewMarkerMinZoom: MAP_PRESENTATION_POLICY.sectionOverviewMarkerMinZoom,
    selectedTour,
  });
  const sectionBurialDisableClusteringZoom = resolveSectionBurialDisableClusteringZoom({
    maxZoom,
  });

  return {
    ...MAP_PRESENTATION_POLICY,
    ...sectionVisibility,
    showSectionAffordanceMarkers: resolveSectionAffordanceMarkerVisibility({
      currentZoom,
      preferOverviewMarkers: preferSectionOverviewMarkers,
      sectionFilter,
      selectedTour,
    }),
    showSectionClusterMarkers: resolveSectionClusterMarkerVisibility({
      currentZoom,
      sectionFilter,
      selectedTour,
    }),
    showRoads: resolveRoadOverlayVisibility({
      roadOverlayVisible,
      hasActiveRoute,
      hasTrackedLocation,
    }),
    sectionBurialDisableClusteringZoom,
    sectionBurialIndividualMarkerMinZoom: sectionBurialDisableClusteringZoom,
  };
};

export const shouldShowPersistentSectionTooltips = ({
  currentZoom = 0,
  sectionDetailMinZoom = MAP_PRESENTATION_POLICY.sectionDetailMinZoom,
  showAllBurials = false,
} = {}) => (
  !showAllBurials &&
  currentZoom >= sectionDetailMinZoom
);

//=============================================================================
// Presentation Rules
//=============================================================================

const SECTION_BURIAL_MARKER_PALETTE = [
  {
    fillColor: "#708177",
    hoverFillColor: "#607069",
    strokeColor: "#e7eee9",
  },
  {
    fillColor: "#7c7f88",
    hoverFillColor: "#686e78",
    strokeColor: "#edf1f4",
  },
  {
    fillColor: "#8a715f",
    hoverFillColor: "#765f50",
    strokeColor: "#f2eae4",
  },
  {
    fillColor: "#657884",
    hoverFillColor: "#556772",
    strokeColor: "#e8eff2",
  },
];

const ACTIVE_SECTION_BURIAL_MARKER_STYLE = {
  radius: 7.25,
  fillColor: "#2f6b57",
  fillOpacity: 0.82,
  color: "#f7fbf8",
  weight: 2.1,
  opacity: 1,
  hitRadius: 18,
};

export const ROAD_LAYER_STYLE = {
  color: "#36424b",
  weight: 1.35,
  opacity: 0.58,
  fillOpacity: 0.08,
};

const normalizeSectionBurialMarkerKey = (record = {}) => {
  if (record.id) {
    return String(record.id);
  }

  return [
    record.Section,
    record.Lot,
    record.Grave,
    record.Tier,
  ].filter((value) => value !== null && value !== undefined && value !== "").join(":");
};

const hashMarkerKey = (value = "") => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

const getSectionBurialMarkerTone = (record = {}) => {
  const markerKey = normalizeSectionBurialMarkerKey(record);
  const paletteIndex = hashMarkerKey(markerKey) % SECTION_BURIAL_MARKER_PALETTE.length;
  return SECTION_BURIAL_MARKER_PALETTE[paletteIndex];
};

export const getSectionBurialMarkerStyle = (record, options = {}) => {
  const {
    currentZoom = null,
    individualMarkerMinZoom = MAP_PRESENTATION_POLICY.sectionBurialIndividualMinZoom,
    isActive = false,
    isHovered = false,
  } = options;

  if (isActive) {
    return { ...ACTIVE_SECTION_BURIAL_MARKER_STYLE };
  }

  const isPreviewMarker = (
    !isHovered &&
    Number.isFinite(currentZoom) &&
    currentZoom < individualMarkerMinZoom
  );

  if (
    isPreviewMarker &&
    currentZoom < individualMarkerMinZoom - 1
  ) {
    return {
      radius: 0,
      fillOpacity: 0,
      opacity: 0,
      weight: 0,
      hitRadius: 0,
    };
  }

  const tone = getSectionBurialMarkerTone(record);

  return {
    radius: isHovered ? 6.25 : isPreviewMarker ? 3.75 : 5.25,
    fillColor: isHovered ? tone.hoverFillColor : tone.fillColor,
    fillOpacity: isHovered ? 0.62 : isPreviewMarker ? 0.24 : 0.44,
    color: tone.strokeColor,
    weight: isHovered ? 1.8 : isPreviewMarker ? 0.85 : 1.15,
    opacity: isHovered ? 0.92 : isPreviewMarker ? 0.48 : 0.76,
    hitRadius: isHovered ? 16 : isPreviewMarker ? 10 : 14,
  };
};

export const getSectionPolygonStyle = (options = {}) => {
  const {
    sectionId,
    activeSectionId,
    hoveredSectionId = null,
    showAllBurials = false,
  } = options;

  const nextSectionId = String(sectionId || "");
  const nextActiveId = String(activeSectionId || "");
  const nextHoveredId = String(hoveredSectionId || "");
  const isActive = nextSectionId && nextSectionId === nextActiveId;
  const isHovered = nextSectionId && nextSectionId === nextHoveredId;

  if (isActive) {
    return {
      fillColor: showAllBurials ? "#7396b4" : "#628ab0",
      fillOpacity: showAllBurials ? 0.14 : 0.24,
      color: showAllBurials ? "#4e6f87" : "#365977",
      weight: showAllBurials ? 1.8 : 2,
    };
  }

  if (isHovered) {
    return {
      fillColor: "#e4edf5",
      fillOpacity: showAllBurials ? 0.08 : 0.12,
      color: "#60788f",
      weight: 1.6,
    };
  }

  return {
    fillColor: "#f8f9fa",
    fillOpacity: showAllBurials ? 0.02 : 0.05,
    color: "#999999",
    weight: 1,
  };
};

//=============================================================================
// Location Rules
//=============================================================================

export const LOCATION_RECENT_FIX_WINDOW_MS = 15000;
export const LOCATION_MAX_ACCEPTABLE_ACCURACY_METERS = 75;
export const LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS = 150;
export const LOCATION_JITTER_DEADBAND_METERS = 2.5;

export const normalizeLocationPosition = (position) => {
  const latitude = Number(position?.coords?.latitude);
  const longitude = Number(position?.coords?.longitude);
  const accuracyMeters = Number(position?.coords?.accuracy);
  const recordedAt = Number(position?.timestamp);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracyMeters: Number.isFinite(accuracyMeters) && accuracyMeters >= 0
      ? Math.max(accuracyMeters, 1)
      : Number.POSITIVE_INFINITY,
    recordedAt: Number.isFinite(recordedAt) && recordedAt > 0
      ? recordedAt
      : Date.now(),
  };
};

export const calculateLocationDistanceMeters = (from, to) => {
  if (!from || !to) {
    return 0;
  }

  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLat = toLat - fromLat;
  const deltaLng = toRadians(to.longitude - from.longitude);

  const haversine = (
    (Math.sin(deltaLat / 2) ** 2) +
    (Math.cos(fromLat) * Math.cos(toLat) * (Math.sin(deltaLng / 2) ** 2))
  );

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
};

export const shouldRejectLocationCandidate = (
  candidate,
  { maxAcceptedAccuracyMeters = LOCATION_MAX_ACCEPTABLE_ACCURACY_METERS } = {}
) => (
  !candidate ||
  !Number.isFinite(candidate.accuracyMeters) ||
  candidate.accuracyMeters > maxAcceptedAccuracyMeters
);

export const scoreRecentLocationCandidate = (candidate, { latestRecordedAt } = {}) => {
  if (!candidate) {
    return Number.POSITIVE_INFINITY;
  }

  const ageSeconds = Math.max(0, ((latestRecordedAt || candidate.recordedAt) - candidate.recordedAt) / 1000);
  return candidate.accuracyMeters + (ageSeconds * 2);
};

export const selectBestRecentLocationCandidate = (candidates) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const latestRecordedAt = candidates.reduce(
    (maxRecordedAt, candidate) => Math.max(maxRecordedAt, Number(candidate?.recordedAt) || 0),
    0
  );

  return candidates.reduce((bestCandidate, candidate) => {
    if (!bestCandidate) {
      return candidate;
    }

    const candidateScore = scoreRecentLocationCandidate(candidate, { latestRecordedAt });
    const bestScore = scoreRecentLocationCandidate(bestCandidate, { latestRecordedAt });

    if (candidateScore < bestScore) {
      return candidate;
    }

    if (candidateScore > bestScore) {
      return bestCandidate;
    }

    return candidate.recordedAt >= bestCandidate.recordedAt
      ? candidate
      : bestCandidate;
  }, null);
};

export const areLocationCandidatesEquivalent = (left, right) => (
  Number(left?.recordedAt) === Number(right?.recordedAt) &&
  Number(left?.accuracyMeters) === Number(right?.accuracyMeters) &&
  Number(left?.latitude) === Number(right?.latitude) &&
  Number(left?.longitude) === Number(right?.longitude)
);

const getLocationSmoothingFactor = ({ accuracyMeters, distanceMeters }) => {
  const clampedAccuracy = clamp(accuracyMeters, 5, LOCATION_MAX_ACCEPTABLE_ACCURACY_METERS);

  if (distanceMeters <= LOCATION_JITTER_DEADBAND_METERS) {
    return 0.15;
  }

  if (distanceMeters >= Math.max(10, clampedAccuracy * 0.8)) {
    return 0.78;
  }

  if (clampedAccuracy <= 12) {
    return 0.72;
  }

  if (clampedAccuracy <= 25) {
    return 0.56;
  }

  if (clampedAccuracy <= 40) {
    return 0.42;
  }

  return 0.3;
};

export const smoothLocationCandidate = (previousLocation, candidate) => {
  if (!candidate) {
    return null;
  }

  if (!previousLocation) {
    return candidate;
  }

  const distanceMeters = calculateLocationDistanceMeters(previousLocation, candidate);
  const smoothingFactor = getLocationSmoothingFactor({
    accuracyMeters: candidate.accuracyMeters,
    distanceMeters,
  });
  const latitude = previousLocation.latitude + ((candidate.latitude - previousLocation.latitude) * smoothingFactor);
  const longitude = previousLocation.longitude + ((candidate.longitude - previousLocation.longitude) * smoothingFactor);
  const residualMeters = Math.max(0, distanceMeters * (1 - smoothingFactor));

  return {
    latitude,
    longitude,
    accuracyMeters: Math.max(candidate.accuracyMeters, residualMeters),
    recordedAt: candidate.recordedAt,
  };
};

const createDestinationPoint = ({ latitude, longitude, distanceMeters, bearingDegrees }) => {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(latitude);
  const lng1 = toRadians(longitude);
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngularDistance = Math.sin(angularDistance);
  const cosAngularDistance = Math.cos(angularDistance);

  const lat2 = Math.asin(
    (sinLat1 * cosAngularDistance) +
    (cosLat1 * sinAngularDistance * Math.cos(bearing))
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * sinAngularDistance * cosLat1,
    cosAngularDistance - (sinLat1 * Math.sin(lat2))
  );

  return [toDegrees(lng2), toDegrees(lat2)];
};

export const buildLocationAccuracyGeoJson = (location, { steps = 48 } = {}) => {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const accuracyMeters = Number(location?.accuracyMeters);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters <= 0
  ) {
    return null;
  }

  const normalizedSteps = Math.max(16, Math.round(steps));
  const ring = [];

  for (let index = 0; index <= normalizedSteps; index += 1) {
    const bearingDegrees = (index / normalizedSteps) * 360;
    ring.push(createDestinationPoint({
      latitude,
      longitude,
      distanceMeters: accuracyMeters,
      bearingDegrees,
    }));
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          kind: "location-accuracy",
          accuracyMeters,
        },
        geometry: {
          type: "Polygon",
          coordinates: [ring],
        },
      },
    ],
  };
};

//=============================================================================
// PMTiles Experiment Rules
//=============================================================================

export const PMTILES_EXPERIMENT_GLYPH_PALETTE = {
  approximate: {
    fill: "rgba(214, 155, 86, 0.28)",
    stroke: "rgba(124, 83, 40, 0.72)",
    guide: "rgba(124, 83, 40, 0.2)",
    label: "Lot-level record",
    detail: "Placed from section and lot details; exact grave position may vary.",
  },
  indexed: {
    fill: "rgba(18, 94, 74, 0.28)",
    stroke: "rgba(15, 69, 54, 0.82)",
    guide: "rgba(15, 69, 54, 0.24)",
    label: "Grave-level record",
    detail: "Includes added grave or tier detail, so it appears more strongly.",
  },
};

const getNumericBurialProperty = (props, key) => {
  const numericValue = Number(props?.[key] ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const hasIndexedBurialPlacement = (props = {}) => (
  getNumericBurialProperty(props, "Grave") > 0 ||
  getNumericBurialProperty(props, "Tier") > 0
);

const getExperimentalBurialVisualKey = (props = {}) => String(
  props.OBJECTID ??
  props.objectid ??
  [
    props.Section,
    props.Lot,
    props.Grave,
    props.Tier,
    props.First_Name,
    props.Last_Name,
  ].join(":")
);

const hashExperimentalBurialKey = (value) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const getPmtilesExperimentOffsetScale = (zoom) => {
  if (zoom >= 22) return 5.2;
  if (zoom >= 20) return 4.2;
  if (zoom >= 18) return 3.2;
  return 2.2;
};

export const getPmtilesExperimentGlyphSize = (zoom, isIndexed) => {
  if (zoom >= 22) return isIndexed ? 5.6 : 5;
  if (zoom >= 20) return isIndexed ? 5 : 4.5;
  if (zoom >= 18) return isIndexed ? 4.4 : 4;
  return isIndexed ? 3.9 : 3.5;
};

export const getPmtilesExperimentGlyphOffset = (zoom, props = {}, isIndexed) => {
  const grave = getNumericBurialProperty(props, "Grave");
  const tier = getNumericBurialProperty(props, "Tier");
  const hash = hashExperimentalBurialKey(getExperimentalBurialVisualKey(props));
  const offsetScale = getPmtilesExperimentOffsetScale(zoom);

  if (isIndexed) {
    const angle = (
      ((grave > 0 ? grave : hash % 24) % 16) / 16
    ) * Math.PI * 2 + ((hash % 7) * 0.07);
    const tierBand = tier > 0 ? Math.min(tier, 6) : ((hash % 4) + 1);
    const distance = Math.min(6, offsetScale * (0.72 + ((tierBand - 1) * 0.14)));
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
    };
  }

  const angle = ((hash % 24) / 24) * Math.PI * 2;
  const distance = offsetScale * (0.42 + ((hash % 5) * 0.08));
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
  };
};

const drawPmtilesExperimentGuide = (context, startX, startY, endX, endY, guideColor, zoom) => {
  const distance = Math.hypot(endX - startX, endY - startY);

  if (distance < 0.6) {
    return;
  }

  context.save();
  context.strokeStyle = guideColor;
  context.lineWidth = zoom >= 20 ? 1 : 0.8;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.restore();
};

const drawPmtilesExperimentCircleGlyph = (context, centerX, centerY, size, fillColor, strokeColor, zoom) => {
  context.save();
  context.fillStyle = fillColor;
  context.strokeStyle = strokeColor;
  context.lineWidth = zoom >= 20 ? 1.15 : 1;
  context.beginPath();
  context.arc(centerX, centerY, size, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
};

const drawPmtilesExperimentDiamondGlyph = (context, centerX, centerY, size, fillColor, strokeColor, zoom) => {
  context.save();
  context.fillStyle = fillColor;
  context.strokeStyle = strokeColor;
  context.lineWidth = zoom >= 20 ? 1.25 : 1.05;
  context.beginPath();
  context.moveTo(centerX, centerY - size);
  context.lineTo(centerX + size, centerY);
  context.lineTo(centerX, centerY + size);
  context.lineTo(centerX - size, centerY);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
};

export class ExperimentalBurialGlyphSymbolizer {
  constructor(variant) {
    this.variant = variant;
  }

  draw(context, geom, zoom, feature) {
    const anchor = geom?.[0]?.[0];
    if (!anchor) return;

    const props = feature?.props || {};
    const isIndexed = this.variant === "indexed";
    const palette = isIndexed
      ? PMTILES_EXPERIMENT_GLYPH_PALETTE.indexed
      : PMTILES_EXPERIMENT_GLYPH_PALETTE.approximate;
    const { dx, dy } = getPmtilesExperimentGlyphOffset(zoom, props, isIndexed);
    const centerX = anchor.x + dx;
    const centerY = anchor.y + dy;
    const size = getPmtilesExperimentGlyphSize(zoom, isIndexed);

    drawPmtilesExperimentGuide(
      context,
      anchor.x,
      anchor.y,
      centerX,
      centerY,
      palette.guide,
      zoom
    );

    if (isIndexed) {
      drawPmtilesExperimentDiamondGlyph(
        context,
        centerX,
        centerY,
        size,
        palette.fill,
        palette.stroke,
        zoom
      );
      return;
    }

    drawPmtilesExperimentCircleGlyph(
      context,
      centerX,
      centerY,
      size,
      palette.fill,
      palette.stroke,
      zoom
    );
  }
}
