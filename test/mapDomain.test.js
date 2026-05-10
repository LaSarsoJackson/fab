import { describe, expect, test } from "bun:test";

import {
  areLocationCandidatesEquivalent,
  areRouteLatLngTuplesEquivalent,
  buildRecordCoordinateGroups,
  beginLeafletSectionHover,
  buildLocationAccuracyGeoJson,
  buildSectionAffordanceMarkers,
  buildSectionBoundsById,
  buildSectionOverviewMarkers,
  calculateLocationDistanceMeters,
  clearLeafletSectionHover,
  createLeafletSectionHoverState,
  createViewportIntentController,
  formatSectionOverviewMarkerLabel,
  getClusterIconCount,
  getDistinctMarkerLocationCount,
  getSameCoordinateMarkerBurialRecords,
  getPopupViewportPadding,
  MAP_PRESENTATION_POLICY,
  getSectionBurialMarkerStyle,
  getSectionPolygonStyle,
  inferPointerType,
  isApproximateLocationAccuracy,
  isLeafletSectionLayerHovered,
  isTouchLikePointerType,
  LOCATION_APPROXIMATE_MAX_ACCURACY_METERS,
  LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS,
  LOCATION_MAX_ACCEPTABLE_ACCURACY_METERS,
  normalizeLocationPosition,
  resolveSectionAffordanceMarkerSize,
  resolveSectionClusterMarkerVisibility,
  resolveClusterExpansionZoom,
  resolveMapPresentationPolicy,
  resolveSectionAffordanceMarkerVisibility,
  resolveSectionBurialDisableClusteringZoom,
  resolveSectionOverlayVisibility,
  ROAD_LAYER_STYLES,
  ROAD_LAYER_STYLE,
  shouldApplyViewportFocus,
  shouldTreatViewportMoveAsUserIntent,
  selectBestRecentLocationCandidate,
  selectRouteTrackingLocationCandidate,
  shouldHandleSectionHover,
  shouldIgnoreSectionBackgroundSelection,
  shouldPreserveSectionClickViewport,
  shouldResetRouteGeometryForRequest,
  shouldRejectLocationCandidate,
  shouldShowPersistentSectionTooltips,
  smoothLocationCandidate,
  stopMapInteractionPropagation,
} from "../src/features/map/mapDomain";

describe("mapDomain", () => {
  const markerAt = (lat, lng) => ({
    getLatLng: () => ({ lat, lng }),
  });
  const burialMarkerAt = (lat, lng, burialRecord) => ({
    burialRecord,
    getLatLng: () => ({ lat, lng }),
  });

  describe("location tracking", () => {
    test("normalizes browser geolocation readings into shared candidates", () => {
      expect(normalizeLocationPosition({
        coords: {
          latitude: 42.70418,
          longitude: -73.73198,
          accuracy: 13.7,
        },
        timestamp: 1700000000000,
      })).toEqual({
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: 13.7,
        recordedAt: 1700000000000,
      });
    });

    test("accepts explicit zero-accuracy readings from simulated geolocation", () => {
      expect(normalizeLocationPosition({
        coords: {
          latitude: 42.70418,
          longitude: -73.73198,
          accuracy: 0,
        },
        timestamp: 1700000000000,
      })).toMatchObject({
        accuracyMeters: 1,
      });
    });

    test("prefers a fresher recent fix when an older one has gone stale", () => {
      const stalePreciseFix = {
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: 8,
        recordedAt: 1000,
      };
      const fresherModerateFix = {
        latitude: 42.70432,
        longitude: -73.73175,
        accuracyMeters: 18,
        recordedAt: 8000,
      };

      expect(selectBestRecentLocationCandidate([
        stalePreciseFix,
        fresherModerateFix,
      ])).toEqual(fresherModerateFix);
    });

    test("prefers meaningful fresh movement while an active route is tracking", () => {
      const olderPreciseFix = {
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: 5,
        recordedAt: 1700000000000,
      };
      const fresherMovedFix = {
        latitude: 42.7047,
        longitude: -73.7315,
        accuracyMeters: 25,
        recordedAt: 1700000004000,
      };

      expect(selectRouteTrackingLocationCandidate([
        olderPreciseFix,
        fresherMovedFix,
      ], {
        previousLocation: olderPreciseFix,
      })).toEqual(fresherMovedFix);
    });

    test("compares location fixes by their actual normalized fields", () => {
      const fix = {
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: 18,
        recordedAt: 1700000000000,
      };

      expect(areLocationCandidatesEquivalent(fix, { ...fix })).toBe(true);
      expect(areLocationCandidatesEquivalent(fix, { ...fix, accuracyMeters: 19 })).toBe(false);
    });

    test("rejects unusably noisy fixes", () => {
      expect(shouldRejectLocationCandidate({
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: LOCATION_MAX_ACCEPTABLE_ACCURACY_METERS + 1,
        recordedAt: 1700000000000,
      })).toBe(true);
      expect(shouldRejectLocationCandidate({
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: 22,
        recordedAt: 1700000000000,
      })).toBe(false);
    });

    test("supports a wider accuracy threshold while the first fix is still converging", () => {
      const noisyInitialFix = {
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: 110,
        recordedAt: 1700000000000,
      };

      expect(shouldRejectLocationCandidate(noisyInitialFix)).toBe(true);
      expect(shouldRejectLocationCandidate(noisyInitialFix, {
        maxAcceptedAccuracyMeters: LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS,
      })).toBe(false);
    });

    test("flags accuracies looser than the initial threshold as approximate", () => {
      // A 60m fix is precise enough to pass the strict steady-state filter;
      // we only mark "approximate" when accuracy is worse than the initial
      // threshold, so the chrome doesn't downgrade good pins.
      expect(isApproximateLocationAccuracy(60)).toBe(false);
      expect(isApproximateLocationAccuracy(LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS)).toBe(false);
      expect(isApproximateLocationAccuracy(LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS + 1)).toBe(true);
      expect(isApproximateLocationAccuracy(800)).toBe(true);
      expect(isApproximateLocationAccuracy(Number.POSITIVE_INFINITY)).toBe(true);
      expect(isApproximateLocationAccuracy(NaN)).toBe(false);
    });

    test("accepts coarse network fallbacks under the approximate threshold", () => {
      const coarseFallback = {
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: 600,
        recordedAt: 1700000000000,
      };

      // Strict thresholds reject this fix - that's the whole reason we have
      // an opt-in approximate threshold for the network-fallback stage.
      expect(shouldRejectLocationCandidate(coarseFallback)).toBe(true);
      expect(shouldRejectLocationCandidate(coarseFallback, {
        maxAcceptedAccuracyMeters: LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS,
      })).toBe(true);
      expect(shouldRejectLocationCandidate(coarseFallback, {
        maxAcceptedAccuracyMeters: LOCATION_APPROXIMATE_MAX_ACCURACY_METERS,
      })).toBe(false);
    });

    test("smooths jitter without understating the remaining uncertainty", () => {
      const previousLocation = {
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: 10,
        recordedAt: 1700000000000,
      };
      const noisyCandidate = {
        latitude: 42.70419,
        longitude: -73.731979,
        accuracyMeters: 24,
        recordedAt: 1700000004000,
      };
      const smoothedLocation = smoothLocationCandidate(previousLocation, noisyCandidate);

      expect(calculateLocationDistanceMeters(previousLocation, smoothedLocation)).toBeLessThan(
        calculateLocationDistanceMeters(previousLocation, noisyCandidate)
      );
      expect(smoothedLocation.accuracyMeters).toBeGreaterThanOrEqual(noisyCandidate.accuracyMeters);
    });

    test("builds a polygon that matches the reported accuracy radius", () => {
      const geojson = buildLocationAccuracyGeoJson({
        latitude: 42.70418,
        longitude: -73.73198,
        accuracyMeters: 12,
      }, { steps: 24 });
      const ring = geojson.features[0].geometry.coordinates[0];
      const firstPoint = ring[0];
      const lastPoint = ring[ring.length - 1];
      const radiusMeters = calculateLocationDistanceMeters(
        { latitude: 42.70418, longitude: -73.73198 },
        { latitude: firstPoint[1], longitude: firstPoint[0] }
      );

      expect(geojson.features[0].geometry.type).toBe("Polygon");
      expect(ring).toHaveLength(25);
      expect(firstPoint[0]).toBeCloseTo(lastPoint[0], 10);
      expect(firstPoint[1]).toBeCloseTo(lastPoint[1], 10);
      expect(radiusMeters).toBeCloseTo(12, 0);
    });
  });

  describe("section and overlay rules", () => {
    const sectionsGeoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { Section: "4" },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [-73.735, 42.704],
              [-73.734, 42.704],
              [-73.734, 42.705],
              [-73.735, 42.705],
              [-73.735, 42.704],
            ]],
          },
        },
        {
          type: "Feature",
          properties: { Section: "4" },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [-73.733, 42.706],
              [-73.732, 42.706],
              [-73.732, 42.707],
              [-73.733, 42.707],
              [-73.733, 42.706],
            ]],
          },
        },
        {
          type: "Feature",
          properties: { Section: "7" },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [-73.731, 42.708],
              [-73.73, 42.708],
              [-73.73, 42.709],
              [-73.731, 42.709],
              [-73.731, 42.708],
            ]],
          },
        },
      ],
    };

    test("builds grouped section bounds for sidebar and map focus", () => {
      const boundsById = buildSectionBoundsById(sectionsGeoJson);

      expect(boundsById.get("4")).toEqual([
        [42.704, -73.735],
        [42.707, -73.732],
      ]);
      expect(boundsById.get("7")).toEqual([
        [42.708, -73.731],
        [42.709, -73.73],
      ]);
    });

    test("builds affordance and overview markers from grouped section counts", () => {
      const sectionCounts = new Map([
        ["4", 250],
        ["7", 1000],
      ]);
      const affordanceMarkers = buildSectionAffordanceMarkers(sectionsGeoJson, sectionCounts);
      const overviewMarkers = buildSectionOverviewMarkers(sectionsGeoJson, sectionCounts);

      expect(affordanceMarkers).toHaveLength(2);
      expect(affordanceMarkers[0].id).toBe("section-affordance:4");
      expect(affordanceMarkers[0].count).toBe(250);
      expect(affordanceMarkers[0].size).toBeLessThan(affordanceMarkers[1].size);
      expect(affordanceMarkers[1].size - affordanceMarkers[0].size).toBeLessThanOrEqual(3);
      expect(affordanceMarkers[0].lat).toBeCloseTo(42.7055);
      expect(affordanceMarkers[0].lng).toBeCloseTo(-73.7335);

      expect(overviewMarkers).toHaveLength(2);
      expect(overviewMarkers.map((marker) => marker.id)).toEqual([
        "section-overview:4",
        "section-overview:7",
      ]);
      expect(overviewMarkers[0].bounds).toEqual([
        [42.704, -73.735],
        [42.707, -73.732],
      ]);
    });

    test("keeps count-driven section affordance sizing restrained", () => {
      const smallSectionSize = resolveSectionAffordanceMarkerSize({
        count: 100,
        maxCount: 1600,
      });
      const largeSectionSize = resolveSectionAffordanceMarkerSize({
        count: 1600,
        maxCount: 1600,
      });

      expect(smallSectionSize).toBeGreaterThanOrEqual(25);
      expect(largeSectionSize).toBeLessThanOrEqual(31);
      expect(largeSectionSize).toBeGreaterThan(smallSectionSize);
      expect(largeSectionSize - smallSectionSize).toBeLessThanOrEqual(5);
    });

    test("formats section labels and selection guards consistently", () => {
      expect(formatSectionOverviewMarkerLabel({
        sectionValue: "49",
        count: 1284,
      })).toBe("Section 49 • 1,284 burials");

      expect(shouldIgnoreSectionBackgroundSelection({
        clickedSection: "49",
        activeSection: 49,
      })).toBe(true);

      expect(shouldIgnoreSectionBackgroundSelection({
        clickedSection: "49",
        activeSection: "50",
      })).toBe(false);
    });

    test("renders section polygons by default across the initial zoom band", () => {
      expect(resolveSectionOverlayVisibility({
        currentZoom: 14,
      })).toEqual({
        showSectionOverviewMarkers: false,
        showSections: true,
      });

      expect(resolveSectionOverlayVisibility({
        currentZoom: 15,
      })).toEqual({
        showSectionOverviewMarkers: false,
        showSections: true,
      });

      expect(resolveSectionOverlayVisibility({
        currentZoom: 16,
      })).toEqual({
        showSectionOverviewMarkers: false,
        showSections: true,
      });
    });

    test("keeps section overview markers behind an explicit policy opt-in", () => {
      expect(resolveSectionOverlayVisibility({
        currentZoom: 14,
        preferOverviewMarkers: true,
      })).toEqual({
        showSectionOverviewMarkers: true,
        showSections: false,
      });

      expect(resolveSectionOverlayVisibility({
        currentZoom: 16,
        preferOverviewMarkers: true,
      })).toEqual({
        showSectionOverviewMarkers: false,
        showSections: true,
      });
    });

    test("suppresses overview and affordance markers once a section or tour is focused", () => {
      expect(resolveSectionOverlayVisibility({
        currentZoom: 14,
        preferOverviewMarkers: true,
        sectionFilter: "4",
      })).toEqual({
        showSectionOverviewMarkers: false,
        showSections: true,
      });

      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 15,
        sectionFilter: "4",
      })).toBe(false);

      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 15,
        selectedTour: "Mayors",
      })).toBe(false);
    });

    test("uses neutral section affordances as the default click cue", () => {
      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 14,
      })).toBe(true);
      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 15,
      })).toBe(true);
      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 16,
      })).toBe(false);

      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 15,
        preferOverviewMarkers: true,
      })).toBe(false);
    });

    test("shows section cluster markers after zooming in before a section is selected", () => {
      expect(resolveSectionClusterMarkerVisibility({
        currentZoom: 15,
      })).toBe(false);
      expect(resolveSectionClusterMarkerVisibility({
        currentZoom: 16,
      })).toBe(true);
      expect(resolveSectionClusterMarkerVisibility({
        currentZoom: 18,
        sectionFilter: "4",
      })).toBe(false);
      expect(resolveSectionClusterMarkerVisibility({
        currentZoom: 18,
        selectedTour: "Mayors",
      })).toBe(false);
    });

    test("preserves map-click viewport once the user is already at section detail zoom", () => {
      expect(shouldPreserveSectionClickViewport({
        currentZoom: MAP_PRESENTATION_POLICY.sectionDetailMinZoom - 0.5,
      })).toBe(false);
      expect(shouldPreserveSectionClickViewport({
        currentZoom: MAP_PRESENTATION_POLICY.sectionDetailMinZoom,
      })).toBe(true);
      expect(shouldPreserveSectionClickViewport({
        currentZoom: MAP_PRESENTATION_POLICY.sectionBrowseFocusMaxZoom + 1,
      })).toBe(true);
    });

    test("keeps marker clustering and expansion zooms explicit", () => {
      expect(resolveSectionBurialDisableClusteringZoom({ maxZoom: 19 })).toBe(19);
      expect(resolveSectionBurialDisableClusteringZoom({ maxZoom: 22 })).toBe(
        MAP_PRESENTATION_POLICY.sectionBurialIndividualMinZoom
      );
      expect(resolveSectionBurialDisableClusteringZoom({})).toBe(
        MAP_PRESENTATION_POLICY.sectionBurialIndividualMinZoom
      );
      expect(resolveClusterExpansionZoom({
        disableClusteringAtZoom: 19,
      })).toBe(19);
      expect(resolveClusterExpansionZoom()).toBe(
        MAP_PRESENTATION_POLICY.sectionBurialIndividualMinZoom
      );
    });

    test("keeps cluster badges tied to underlying burial records", () => {
      const markers = [
        markerAt(42.709101, -73.734101),
        markerAt(42.709101, -73.734101),
        markerAt(42.709202, -73.734202),
        markerAt(42.709202, -73.734202),
        markerAt(42.709303, -73.734303),
      ];

      expect(getDistinctMarkerLocationCount(markers)).toBe(3);
      expect(getClusterIconCount({ getChildCount: () => markers.length }, markers)).toBe(5);
    });

    test("keeps same-coordinate marker stacks counted by burial record", () => {
      const markers = [
        markerAt(42.709101, -73.734101),
        markerAt(42.709101, -73.734101),
        markerAt(42.709101, -73.734101),
      ];

      expect(getDistinctMarkerLocationCount(markers)).toBe(1);
      expect(getClusterIconCount({ getChildCount: () => markers.length }, markers)).toBe(3);
    });

    test("returns every burial record in a same-coordinate marker stack", () => {
      const markers = [
        burialMarkerAt(42.709101, -73.734101, { id: "one", Section: "50", Lot: "1" }),
        burialMarkerAt(42.709101, -73.734101, { id: "two", Section: "50", Lot: "1" }),
        burialMarkerAt(42.709101, -73.734101, { id: "three", Section: "50", Lot: "1" }),
      ];

      expect(getSameCoordinateMarkerBurialRecords(markers)).toEqual([
        { id: "one", Section: "50", Lot: "1" },
        { id: "two", Section: "50", Lot: "1" },
        { id: "three", Section: "50", Lot: "1" },
      ]);
    });

    test("ignores mixed-location and non-burial clusters for stack selection", () => {
      expect(getSameCoordinateMarkerBurialRecords([
        burialMarkerAt(42.709101, -73.734101, { Section: "50", Lot: "1" }),
        burialMarkerAt(42.709202, -73.734202, { Section: "50", Lot: "1" }),
      ])).toEqual([]);

      expect(getSameCoordinateMarkerBurialRecords([
        burialMarkerAt(42.709101, -73.734101, { Section: "50", Lot: "1" }),
        markerAt(42.709101, -73.734101),
      ])).toEqual([]);
    });

    test("keeps stack detection tied to source coordinates when display positions differ", () => {
      const records = [
        { id: "one", Section: "50", Lot: "1", coordinates: [-73.731094, 42.709337] },
        { id: "two", Section: "50", Lot: "1", coordinates: [-73.731094, 42.709337] },
      ];
      const markers = [
        {
          burialRecord: records[0],
          getLatLng: () => ({ lat: 42.70933701, lng: -73.73109401 }),
        },
        {
          burialRecord: records[1],
          getLatLng: () => ({ lat: 42.70933709, lng: -73.73109409 }),
        },
      ];

      expect(getDistinctMarkerLocationCount(markers)).toBe(2);
      expect(getSameCoordinateMarkerBurialRecords(markers)).toEqual(records);
    });

    test("keeps road rendering tied to the explicit overlay toggle", () => {
      expect(resolveMapPresentationPolicy({
        currentZoom: 14,
        maxZoom: 19,
      })).toMatchObject({
        sectionBurialClusterRadius: MAP_PRESENTATION_POLICY.sectionBurialClusterRadius,
        sectionBurialDisableClusteringZoom: 19,
        showRoads: false,
        showSectionAffordanceMarkers: true,
        showSectionClusterMarkers: false,
        showSectionOverviewMarkers: false,
        showSections: true,
      });

      expect(resolveMapPresentationPolicy({
        currentZoom: 16,
        maxZoom: 19,
        hasActiveRoute: true,
        hasTrackedLocation: true,
      })).toMatchObject({
        showRoads: false,
        showSectionAffordanceMarkers: false,
        showSectionClusterMarkers: true,
        showSectionOverviewMarkers: false,
        showSections: true,
      });

      expect(resolveMapPresentationPolicy({
        currentZoom: 16,
        maxZoom: 19,
        hasActiveRoute: true,
        hasTrackedLocation: true,
        roadOverlayVisible: true,
      })).toMatchObject({
        showRoads: true,
      });

      expect(resolveMapPresentationPolicy({
        currentZoom: 14,
        maxZoom: 19,
        preferSectionOverviewMarkers: true,
      })).toMatchObject({
        showSectionAffordanceMarkers: false,
        showSectionClusterMarkers: false,
        showSectionOverviewMarkers: true,
        showSections: false,
      });
    });

    test("hides persistent section labels once close-in burial markers are visible", () => {
      expect(shouldShowPersistentSectionTooltips({
        currentZoom: 16,
        showAllBurials: false,
      })).toBe(true);

      expect(shouldShowPersistentSectionTooltips({
        currentZoom: 16,
        showAllBurials: true,
      })).toBe(false);
    });
  });

  describe("route geometry rules", () => {
    test("keeps the current route geometry while live location refreshes the same destination", () => {
      const destination = [42.70908, -73.72157];

      expect(areRouteLatLngTuplesEquivalent(destination, [42.70908, -73.72157])).toBe(true);
      expect(shouldResetRouteGeometryForRequest({
        renderedDestination: destination,
        requestedDestination: [42.70908, -73.72157],
      })).toBe(false);
    });

    test("resets visible route geometry when a new destination is requested", () => {
      expect(areRouteLatLngTuplesEquivalent(
        [42.70908, -73.72157],
        [42.7042, -73.73195]
      )).toBe(false);
      expect(shouldResetRouteGeometryForRequest({
        renderedDestination: [42.70908, -73.72157],
        requestedDestination: [42.7042, -73.73195],
      })).toBe(true);
    });
  });

  describe("viewport intent rules", () => {
    test("lets explicit focus commands override prior manual map exploration", () => {
      expect(shouldApplyViewportFocus({ hasUserViewportIntent: false })).toBe(true);
      expect(shouldApplyViewportFocus({ hasUserViewportIntent: true })).toBe(false);
      expect(shouldApplyViewportFocus({
        hasUserViewportIntent: true,
        isExplicitFocus: true,
      })).toBe(true);
    });

    test("does not treat programmatic zooms as user map exploration", () => {
      expect(shouldTreatViewportMoveAsUserIntent({
        eventType: "zoomstart",
        isProgrammaticMove: true,
      })).toBe(false);
      expect(shouldTreatViewportMoveAsUserIntent({
        eventType: "zoomstart",
        isProgrammaticMove: false,
      })).toBe(true);
      expect(shouldTreatViewportMoveAsUserIntent({
        eventType: "dragstart",
        isProgrammaticMove: true,
      })).toBe(true);
    });

    test("suppresses passive focus after user movement until an explicit focus command", () => {
      const controller = createViewportIntentController();

      expect(controller.canApplyFocus()).toBe(true);

      controller.handleMoveStart("dragstart");

      expect(controller.hasUserViewportIntent()).toBe(true);
      expect(controller.canApplyFocus()).toBe(false);
      expect(controller.canApplyFocus({ isExplicitFocus: true })).toBe(true);
      expect(controller.hasUserViewportIntent()).toBe(false);
      expect(controller.canApplyFocus()).toBe(true);
    });

    test("ignores code-driven zoom starts while preserving real drag intent", () => {
      const listeners = new Map();
      const controller = createViewportIntentController();
      const map = {
        once: (eventName, handler) => {
          listeners.set(eventName, handler);
        },
        off: (eventName, handler) => {
          if (listeners.get(eventName) === handler) {
            listeners.delete(eventName);
          }
        },
      };

      controller.runProgrammaticMove(map, () => {
        expect(controller.getProgrammaticMoveDepth()).toBe(1);
        controller.handleMoveStart("zoomstart");
        controller.handleMoveStart("dragstart");
      });

      expect(controller.hasUserViewportIntent()).toBe(true);
      listeners.get("moveend")?.();
      expect(controller.getProgrammaticMoveDepth()).toBe(0);
    });

    test("notifies route and GPS follow-up state when the user takes over the viewport", () => {
      let notificationCount = 0;
      const controller = createViewportIntentController({
        onUserViewportIntent: () => {
          notificationCount += 1;
        },
      });

      controller.handleMoveStart("zoomstart");

      expect(notificationCount).toBe(1);
    });
  });

  describe("presentation rules", () => {
    test("assigns stable burial marker tones and stronger emphasis for hover and active states", () => {
      const fills = ["a", "b", "c", "d"].map((id) => (
        getSectionBurialMarkerStyle({ id }).fillColor
      ));
      const baseStyle = getSectionBurialMarkerStyle({ id: "grave-a" });
      const hoveredStyle = getSectionBurialMarkerStyle({ id: "grave-a" }, { isHovered: true });
      const activeStyle = getSectionBurialMarkerStyle({ id: "grave-a" }, { isActive: true });

      expect(new Set(fills).size).toBe(4);
      expect(baseStyle).toEqual(getSectionBurialMarkerStyle({ id: "grave-a" }));
      expect(hoveredStyle.radius).toBeGreaterThan(baseStyle.radius);
      expect(hoveredStyle.fillOpacity).toBeGreaterThan(baseStyle.fillOpacity);
      expect(activeStyle.radius).toBeGreaterThan(hoveredStyle.radius);
      expect(activeStyle.fillOpacity).toBeGreaterThan(hoveredStyle.fillOpacity);
    });

    test("groups exact-coordinate record stacks without changing source coordinates", () => {
      const records = [
        { id: "one", coordinates: [-73.731094, 42.709337] },
        { id: "two", coordinates: [-73.731094, 42.709337] },
        { id: "three", coordinates: [-73.731094, 42.709337] },
        { id: "separate", coordinates: [-73.731239, 42.709374] },
      ];
      const coordinateGroups = buildRecordCoordinateGroups(records);

      expect(coordinateGroups).toHaveLength(2);
      expect(coordinateGroups[0].recordIds).toEqual(["one", "two", "three"]);
      expect(coordinateGroups[0].records).toEqual(records.slice(0, 3));
      expect(coordinateGroups[0].coordinates).toEqual([-73.731094, 42.709337]);
      expect(coordinateGroups[1].recordIds).toEqual(["separate"]);
      expect(records[0].coordinates).toEqual([-73.731094, 42.709337]);
    });

    test("hides section burial singletons until the close-in preview zoom", () => {
      const hiddenStyle = getSectionBurialMarkerStyle(
        { id: "grave-a" },
        {
          currentZoom: 17,
          individualMarkerMinZoom: 19,
        }
      );
      const previewStyle = getSectionBurialMarkerStyle(
        { id: "grave-a" },
        {
          currentZoom: 18,
          individualMarkerMinZoom: 19,
        }
      );
      const visibleStyle = getSectionBurialMarkerStyle(
        { id: "grave-a" },
        {
          currentZoom: 19,
          individualMarkerMinZoom: 19,
        }
      );

      expect(hiddenStyle).toMatchObject({
        fillOpacity: 0,
        hitRadius: 0,
        opacity: 0,
        radius: 0,
      });
      expect(visibleStyle.radius).toBeGreaterThan(0);
      expect(visibleStyle.fillOpacity).toBeGreaterThan(0);
      expect(previewStyle.radius).toBeGreaterThan(hiddenStyle.radius);
      expect(previewStyle.radius).toBeLessThan(visibleStyle.radius);
      expect(previewStyle.fillOpacity).toBeLessThan(visibleStyle.fillOpacity);
    });

    test("softens active section fill when close-in burials are visible and keeps roads restrained", () => {
      const defaultStyle = getSectionPolygonStyle({
        sectionId: "107",
        activeSectionId: "107",
        showAllBurials: false,
      });
      const closeInStyle = getSectionPolygonStyle({
        sectionId: "107",
        activeSectionId: "107",
        showAllBurials: true,
      });

      expect(closeInStyle.fillOpacity).toBeLessThan(defaultStyle.fillOpacity);
      expect(closeInStyle.weight).toBeLessThan(defaultStyle.weight);
      expect(ROAD_LAYER_STYLE.opacity).toBeGreaterThanOrEqual(0.7);
      expect(ROAD_LAYER_STYLE.weight).toBeGreaterThanOrEqual(1.5);
    });

    test("defines MapKit-style roads as layered non-interactive strokes", () => {
      expect(ROAD_LAYER_STYLES).toHaveLength(3);

      const [shadow, casing, body] = ROAD_LAYER_STYLES;

      expect(shadow).toMatchObject({
        interactive: false,
        lineCap: "round",
        lineJoin: "round",
      });
      expect(casing).toMatchObject({
        interactive: false,
        lineCap: "round",
        lineJoin: "round",
      });
      expect(body).toMatchObject({
        color: "#f8f6ef",
        interactive: false,
        lineCap: "round",
        lineJoin: "round",
      });
      expect(shadow.weight).toBeGreaterThan(casing.weight);
      expect(casing.weight).toBeGreaterThan(body.weight);
      expect(body.opacity).toBeGreaterThan(shadow.opacity);
    });

    test("keeps popups clear of a full-height desktop sidebar", () => {
      expect(getPopupViewportPadding({
        containerRect: { left: 0, top: 0, right: 1280, bottom: 800 },
        overlayRect: { left: 0, top: 0, right: 390, bottom: 800 },
      })).toEqual({
        topLeft: [406, 16],
        bottomRight: [16, 16],
      });
    });

    test("keeps popups above a mobile bottom sheet", () => {
      expect(getPopupViewportPadding({
        containerRect: { left: 0, top: 0, right: 390, bottom: 844 },
        overlayRect: { left: 0, top: 544, right: 390, bottom: 844 },
      })).toEqual({
        topLeft: [16, 16],
        bottomRight: [16, 316],
      });
    });

    test("falls back to the base popup padding when there is no overlay overlap", () => {
      expect(getPopupViewportPadding({
        containerRect: { left: 0, top: 0, right: 1280, bottom: 800 },
        overlayRect: { left: 1320, top: 0, right: 1520, bottom: 800 },
      })).toEqual({
        topLeft: [16, 16],
        bottomRight: [16, 16],
      });
    });
  });

  describe("hover and pointer rules", () => {
    test("treats touch and pen pointers as touch-like and infers pointer source from events", () => {
      expect(isTouchLikePointerType("touch")).toBe(true);
      expect(isTouchLikePointerType("pen")).toBe(true);
      expect(isTouchLikePointerType("mouse")).toBe(false);

      expect(inferPointerType({ pointerType: "pen" })).toBe("pen");
      expect(inferPointerType({ nativeEvent: { pointerType: "touch" } })).toBe("touch");
      expect(inferPointerType({ type: "touchstart" })).toBe("touch");
      expect(inferPointerType({ type: "mousemove" })).toBe("mouse");
    });

    test("suppresses section hover after touch input or when hover is unavailable", () => {
      expect(shouldHandleSectionHover({
        canHover: true,
        recentTouchInteraction: false,
      })).toBe(true);

      expect(shouldHandleSectionHover({
        canHover: true,
        recentTouchInteraction: true,
      })).toBe(false);

      expect(shouldHandleSectionHover({
        canHover: false,
        recentTouchInteraction: false,
      })).toBe(false);
    });

    test("clears the previous hovered layer when hover moves or resets", () => {
      const firstLayer = { id: "first" };
      const secondLayer = { id: "second" };

      const movedHover = beginLeafletSectionHover(
        createLeafletSectionHoverState({
          sectionId: "49",
          layer: firstLayer,
        }),
        createLeafletSectionHoverState({
          sectionId: "49",
          layer: secondLayer,
        })
      );

      expect(movedHover.clearedHoverState).toEqual({
        sectionId: "49",
        layer: firstLayer,
      });
      expect(movedHover.nextHoverState).toEqual({
        sectionId: "49",
        layer: secondLayer,
      });

      const clearedHover = clearLeafletSectionHover({
        sectionId: 38,
        layer: secondLayer,
      });

      expect(clearedHover.clearedHoverState).toEqual({
        sectionId: "38",
        layer: secondLayer,
      });
      expect(clearedHover.nextHoverState).toEqual({
        sectionId: null,
        layer: null,
      });
      expect(isLeafletSectionLayerHovered(movedHover.nextHoverState, secondLayer)).toBe(true);
      expect(isLeafletSectionLayerHovered(movedHover.nextHoverState, firstLayer)).toBe(false);
    });

    test("stops propagation on synthetic and native events", () => {
      const calls = [];
      const nativeEvent = {
        stopPropagation: () => calls.push("native-stop"),
        stopImmediatePropagation: () => calls.push("native-immediate"),
      };
      const event = {
        nativeEvent,
        stopPropagation: () => calls.push("react-stop"),
      };

      stopMapInteractionPropagation(event);

      expect(calls).toEqual([
        "react-stop",
        "native-stop",
        "native-immediate",
      ]);
    });
  });

});
