import { getGeoJsonBounds, isLatLngBoundsExpressionValid } from "../../shared/geoJsonBounds";

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
 *
 * It intentionally does not own React state, refs, DOM, or Leaflet/runtime
 * lifecycles. Those stay in the map shell and renderer-specific modules.
 */

//=============================================================================
// Shared Helpers
//=============================================================================

const EARTH_RADIUS_METERS = 6371008.8;
const METERS_PER_DEGREE_LATITUDE = 111320;
const DEFAULT_COORDINATE_PRECISION = 8;
const PROGRAMMATIC_MOVE_GUARD_TIMEOUT_MS = 1400;
const TOUCH_LIKE_POINTER_TYPES = new Set(["touch", "pen"]);
const UNKNOWN_LOT_VALUES = new Set(["-99", "-99.0"]);
const noop = () => {};

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

export const shouldApplyViewportFocus = ({
  hasUserViewportIntent = false,
  isExplicitFocus = false,
} = {}) => Boolean(isExplicitFocus || !hasUserViewportIntent);

export const shouldTreatViewportMoveAsUserIntent = ({
  eventType = "",
  isProgrammaticMove = false,
} = {}) => {
  const normalizedEventType = String(eventType || "").toLowerCase();

  if (normalizedEventType === "dragstart") {
    return true;
  }

  return !isProgrammaticMove;
};

export const createViewportIntentController = ({
  onUserViewportIntent = noop,
} = {}) => {
  // Auto-focus should stop once the user takes control of the viewport, but
  // programmatic Leaflet moves emit the same move events as real drags/zooms.
  // Track a small move depth so Map.jsx can distinguish those cases.
  let hasUserViewportIntent = false;
  let programmaticMoveDepth = 0;
  const notifyUserViewportIntent = typeof onUserViewportIntent === "function"
    ? onUserViewportIntent
    : noop;

  const markExplicitFocus = () => {
    hasUserViewportIntent = false;
  };

  const canApplyFocus = ({ isExplicitFocus = false } = {}) => {
    const shouldFocus = shouldApplyViewportFocus({
      hasUserViewportIntent,
      isExplicitFocus,
    });

    if (shouldFocus && isExplicitFocus) {
      markExplicitFocus();
    }

    return shouldFocus;
  };

  const markUserIntent = () => {
    hasUserViewportIntent = true;
    notifyUserViewportIntent();
  };

  const handleMoveStart = (eventType) => {
    if (!shouldTreatViewportMoveAsUserIntent({
      eventType,
      isProgrammaticMove: programmaticMoveDepth > 0,
    })) {
      return;
    }

    markUserIntent();
  };

  const runProgrammaticMove = (map, moveCallback) => {
    if (!map || typeof moveCallback !== "function") {
      return undefined;
    }

    programmaticMoveDepth += 1;

    let didFinish = false;
    let timeoutId = null;
    const finish = () => {
      if (didFinish) {
        return;
      }

      didFinish = true;
      map.off?.("moveend", finish);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      programmaticMoveDepth = Math.max(0, programmaticMoveDepth - 1);
    };

    if (typeof map.once === "function") {
      map.once("moveend", finish);
      timeoutId = setTimeout(finish, PROGRAMMATIC_MOVE_GUARD_TIMEOUT_MS);
    }

    try {
      const result = moveCallback();
      if (typeof map.once !== "function") {
        finish();
      }
      return result;
    } catch (error) {
      finish();
      throw error;
    }
  };

  return {
    canApplyFocus,
    getProgrammaticMoveDepth: () => programmaticMoveDepth,
    hasUserViewportIntent: () => hasUserViewportIntent,
    handleMoveStart,
    markExplicitFocus,
    markUserIntent,
    runProgrammaticMove,
  };
};

const buildBaseViewportPadding = (basePadding) => ({
  topLeft: [basePadding, basePadding],
  bottomRight: [basePadding, basePadding],
});

const getRectSize = (rect = {}) => ({
  width: Math.max(0, (rect.right || 0) - (rect.left || 0)),
  height: Math.max(0, (rect.bottom || 0) - (rect.top || 0)),
});

export const getPopupViewportPadding = ({
  containerRect,
  overlayRect,
  basePadding = 16,
  edgeThreshold = 12,
  dominantCoverage = 0.6,
} = {}) => {
  const padding = buildBaseViewportPadding(basePadding);

  if (!containerRect || !overlayRect) {
    return padding;
  }

  // The sidebar/mobile sheet can cover one side of the map. Translate that
  // overlap into Leaflet autopan padding so focused markers remain visible.
  const overlapLeft = Math.max(containerRect.left, overlayRect.left);
  const overlapTop = Math.max(containerRect.top, overlayRect.top);
  const overlapRight = Math.min(containerRect.right, overlayRect.right);
  const overlapBottom = Math.min(containerRect.bottom, overlayRect.bottom);

  if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) {
    return padding;
  }

  const overlapWidth = overlapRight - overlapLeft;
  const overlapHeight = overlapBottom - overlapTop;
  const { width: containerWidth, height: containerHeight } = getRectSize(containerRect);
  if (!containerWidth || !containerHeight) {
    return padding;
  }

  const touchesLeft = Math.abs(overlapLeft - containerRect.left) <= edgeThreshold;
  const touchesRight = Math.abs(containerRect.right - overlapRight) <= edgeThreshold;
  const touchesTop = Math.abs(overlapTop - containerRect.top) <= edgeThreshold;
  const touchesBottom = Math.abs(containerRect.bottom - overlapBottom) <= edgeThreshold;

  if (overlapWidth >= containerWidth * dominantCoverage) {
    if (touchesBottom && !touchesTop) {
      padding.bottomRight[1] = Math.ceil(overlapHeight) + basePadding;
      return padding;
    }

    if (touchesTop && !touchesBottom) {
      padding.topLeft[1] = Math.ceil(overlapHeight) + basePadding;
      return padding;
    }
  }

  if (overlapHeight >= containerHeight * dominantCoverage) {
    if (touchesLeft && !touchesRight) {
      padding.topLeft[0] = Math.ceil(overlapWidth) + basePadding;
      return padding;
    }

    if (touchesRight && !touchesLeft) {
      padding.bottomRight[0] = Math.ceil(overlapWidth) + basePadding;
      return padding;
    }
  }

  if (touchesLeft) {
    padding.topLeft[0] = Math.ceil(overlapWidth) + basePadding;
  }
  if (touchesRight) {
    padding.bottomRight[0] = Math.ceil(overlapWidth) + basePadding;
  }
  if (touchesTop) {
    padding.topLeft[1] = Math.ceil(overlapHeight) + basePadding;
  }
  if (touchesBottom) {
    padding.bottomRight[1] = Math.ceil(overlapHeight) + basePadding;
  }

  return padding;
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
  // Keep selected records as the only durable state. Active and hovered ids are
  // allowed only when they still point at a selected record, which prevents
  // stale Leaflet hover/focus state from leaking into the sidebar.
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

// Map selection updates funnel through action creators so search results,
// section markers, tour stops, deep links, and popup close events all normalize
// active/hovered/selected state the same way.
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

  // A single visible section can contain multiple polygons in the source data.
  // Group first, then compute one browse/focus bound per logical section id.
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

export const getMarkerCoordinateKey = (
  marker,
  precision = DEFAULT_COORDINATE_PRECISION
) => {
  const latLng = marker?.getLatLng?.();
  if (!latLng) return "";

  const lat = Number(latLng.lat);
  const lng = Number(latLng.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";

  return `${lat.toFixed(precision)}:${lng.toFixed(precision)}`;
};

// Display markers may be nudged apart, but cluster decisions still need the
// original cemetery coordinate when the marker carries its source burial record.
const getRecordCoordinateKey = (
  record,
  precision = DEFAULT_COORDINATE_PRECISION
) => {
  const coordinates = record?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return "";

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";

  return `${lat.toFixed(precision)}:${lng.toFixed(precision)}`;
};

const getMarkerSourceCoordinateKey = (
  marker,
  precision = DEFAULT_COORDINATE_PRECISION
) => (
  getRecordCoordinateKey(marker?.burialRecord, precision) ||
  getMarkerCoordinateKey(marker, precision)
);

export const getDistinctMarkerLocationCount = (markers = []) => {
  const coordinateKeys = new Set();

  markers.forEach((marker) => {
    const coordinateKey = getMarkerCoordinateKey(marker);
    if (coordinateKey) {
      coordinateKeys.add(coordinateKey);
    }
  });

  return coordinateKeys.size;
};

const areMarkersFromSameSourceLocation = (markers = []) => {
  const coordinateKeys = markers
    .map((marker) => getMarkerSourceCoordinateKey(marker))
    .filter(Boolean);

  return (
    markers.length > 1 &&
    coordinateKeys.length === markers.length &&
    new Set(coordinateKeys).size === 1
  );
};

const getSharedRecordValue = (records = [], fieldNames = []) => {
  const values = records.map((record) => (
    fieldNames
      .map((fieldName) => normalizeSectionValue(record?.[fieldName]))
      .find(Boolean) || ""
  ));
  const [sharedValue] = values;

  return sharedValue && values.every((value) => value === sharedValue)
    ? sharedValue
    : "";
};

const isUsableLotValue = (value) => (
  Boolean(value) && !UNKNOWN_LOT_VALUES.has(normalizeSectionValue(value))
);

const resolveStackedRecordDisplayOffset = (
  stackIndex,
  stackSize,
  offsetMeters
) => {
  if (stackSize <= 1 || !Number.isFinite(stackIndex) || stackIndex < 0) {
    return { eastMeters: 0, northMeters: 0 };
  }

  if (stackSize <= 8) {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * stackIndex) / stackSize);
    return {
      eastMeters: Math.cos(angle) * offsetMeters,
      northMeters: Math.sin(angle) * offsetMeters,
    };
  }

  let remainingIndex = stackIndex;
  let ring = 1;
  let ringCapacity = 8;

  while (remainingIndex >= ringCapacity) {
    remainingIndex -= ringCapacity;
    ring += 1;
    ringCapacity = ring * 8;
  }

  const angle = (
    (-Math.PI / 2) +
    ((Math.PI * 2 * (remainingIndex + (ring % 2 === 0 ? 0.5 : 0))) / ringCapacity)
  );
  const radiusMeters = offsetMeters * ring;

  return {
    eastMeters: Math.cos(angle) * radiusMeters,
    northMeters: Math.sin(angle) * radiusMeters,
  };
};

const offsetCoordinateByMeters = (coordinates, { eastMeters = 0, northMeters = 0 } = {}) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const longitudeScale = Math.max(Math.abs(Math.cos(toRadians(lat))), 0.000001);
  return [
    lng + (eastMeters / (METERS_PER_DEGREE_LATITUDE * longitudeScale)),
    lat + (northMeters / METERS_PER_DEGREE_LATITUDE),
  ];
};

export const buildStackedRecordDisplayCoordinateMap = (
  records = [],
  {
    getRecordId = (record) => record?.id,
    offsetMeters = 1.15,
  } = {}
) => {
  const groupsByCoordinate = new Map();
  const displayCoordinatesById = new Map();

  records.forEach((record, recordIndex) => {
    const recordId = normalizeSectionValue(getRecordId(record));
    const coordinateKey = getRecordCoordinateKey(record);
    if (!recordId || !coordinateKey) return;

    let coordinateGroup = groupsByCoordinate.get(coordinateKey);
    if (!coordinateGroup) {
      coordinateGroup = [];
      groupsByCoordinate.set(coordinateKey, coordinateGroup);
    }

    coordinateGroup.push({ record, recordId, recordIndex });
  });

  // Some burial records share an exact GIS point. Only the render coordinate is
  // offset; routing, deep links, and stack detection continue to use the source
  // coordinate on the record.
  groupsByCoordinate.forEach((coordinateGroup) => {
    if (coordinateGroup.length < 2) {
      return;
    }

    coordinateGroup
      .sort((left, right) => left.recordIndex - right.recordIndex)
      .forEach(({ record, recordId }, stackIndex) => {
        const displayCoordinates = offsetCoordinateByMeters(
          record.coordinates,
          resolveStackedRecordDisplayOffset(stackIndex, coordinateGroup.length, offsetMeters)
        );

        if (displayCoordinates) {
          displayCoordinatesById.set(recordId, displayCoordinates);
        }
      });
  });

  return displayCoordinatesById;
};

export const resolveSameCoordinateSectionBrowseContext = (markers = []) => {
  const burialRecords = markers
    .map((marker) => marker?.burialRecord)
    .filter(Boolean);

  if (
    burialRecords.length < 2 ||
    burialRecords.length !== markers.length ||
    !areMarkersFromSameSourceLocation(markers)
  ) {
    return null;
  }

  const sectionFilter = getSharedRecordValue(burialRecords, ["Section", "section"]);
  if (!sectionFilter) {
    return null;
  }

  // For one-source-coordinate clusters, the section browse panel is clearer
  // than opening another map-only list. Prefer the narrowest shared cemetery
  // field so the existing sidebar result list does the work.
  const sharedLot = getSharedRecordValue(burialRecords, ["Lot", "lot"]);
  if (isUsableLotValue(sharedLot)) {
    return {
      sectionFilter,
      filterType: "lot",
      lotTierFilter: sharedLot,
    };
  }

  const sharedTier = getSharedRecordValue(burialRecords, ["Tier", "tier"]);
  if (sharedTier) {
    return {
      sectionFilter,
      filterType: "tier",
      lotTierFilter: sharedTier,
    };
  }

  return {
    sectionFilter,
    filterType: "lot",
    lotTierFilter: "",
  };
};

export const getClusterIconCount = (
  cluster,
  markers = cluster?.getAllChildMarkers?.() || []
) => {
  const childCount = Number(cluster?.getChildCount?.());
  return Number.isFinite(childCount) && childCount > 0
    ? childCount
    : markers.length;
};

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
  preferSectionOverviewMarkers = false,
} = {}) => {
  // Map chrome asks for one policy object per render so zoom and section/tour
  // focus cannot drift through separate conditionals.
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
    showRoads: Boolean(roadOverlayVisible),
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

const ROAD_LINE_BASE_STYLE = {
  fill: false,
  interactive: false,
  bubblingMouseEvents: false,
  lineCap: "round",
  lineJoin: "round",
};

export const ROAD_LAYER_STYLES = [
  {
    ...ROAD_LINE_BASE_STYLE,
    color: "#5c6469",
    weight: 8,
    opacity: 0.2,
  },
  {
    ...ROAD_LINE_BASE_STYLE,
    color: "#d8d1c5",
    weight: 6.25,
    opacity: 0.64,
  },
  {
    ...ROAD_LINE_BASE_STYLE,
    color: "#f8f6ef",
    weight: 4.5,
    opacity: 0.96,
  },
];

export const ROAD_LAYER_STYLE = ROAD_LAYER_STYLES[ROAD_LAYER_STYLES.length - 1];

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
// In weak-signal cemetery conditions a coarse network/Wi-Fi fix is still more
// useful than nothing. The map shell may opt in to accepting such fixes as
// "approximate" via this looser threshold. The accepted candidate is then
// flagged so the shell can show an informational tone and continue trying to
// upgrade it via watchPosition.
export const LOCATION_APPROXIMATE_MAX_ACCURACY_METERS = 1000;
export const LOCATION_JITTER_DEADBAND_METERS = 2.5;

export const isApproximateLocationAccuracy = (accuracyMeters) => (
  Number(accuracyMeters) > LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS
);

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

export const selectRouteTrackingLocationCandidate = (
  candidates,
  { previousLocation = null } = {}
) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const bestAccuracyCandidate = selectBestRecentLocationCandidate(candidates);
  // While navigating, meaningful fresh movement is more useful than the most
  // accurate stale fix. The deadband below keeps small GPS jitter from moving
  // the route origin on every watch update.
  const freshestCandidate = candidates.reduce((freshest, candidate) => {
    if (!freshest) {
      return candidate;
    }

    return Number(candidate?.recordedAt) >= Number(freshest?.recordedAt)
      ? candidate
      : freshest;
  }, null);

  if (!previousLocation || !freshestCandidate || freshestCandidate === bestAccuracyCandidate) {
    return bestAccuracyCandidate || freshestCandidate;
  }

  const movementMeters = calculateLocationDistanceMeters(previousLocation, freshestCandidate);
  return movementMeters > LOCATION_JITTER_DEADBAND_METERS
    ? freshestCandidate
    : bestAccuracyCandidate;
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
