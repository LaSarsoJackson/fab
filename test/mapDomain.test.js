import { describe, expect, test } from "bun:test";

import {
  areLocationCandidatesEquivalent,
  beginLeafletSectionHover,
  buildLocationAccuracyGeoJson,
  buildSectionAffordanceMarkers,
  buildSectionBoundsById,
  buildSectionOverviewMarkers,
  calculateLocationDistanceMeters,
  clearLeafletSectionHover,
  createLeafletSectionHoverState,
  formatSectionOverviewMarkerLabel,
  MAP_PRESENTATION_POLICY,
  getPmtilesExperimentGlyphOffset,
  getPmtilesExperimentGlyphSize,
  getSectionBurialMarkerStyle,
  getSectionPolygonStyle,
  hasIndexedBurialPlacement,
  inferPointerType,
  isLeafletSectionLayerHovered,
  isTouchLikePointerType,
  LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS,
  LOCATION_MAX_ACCEPTABLE_ACCURACY_METERS,
  normalizeLocationPosition,
  resolveClusterExpansionZoom,
  resolveMapPresentationPolicy,
  resolveRoadOverlayVisibility,
  resolveSectionAffordanceMarkerVisibility,
  resolveSectionBurialDisableClusteringZoom,
  resolveSectionOverlayVisibility,
  ROAD_LAYER_STYLE,
  selectBestRecentLocationCandidate,
  shouldHandleSectionHover,
  shouldIgnoreSectionBackgroundSelection,
  shouldRejectLocationCandidate,
  shouldShowPersistentSectionTooltips,
  smoothLocationCandidate,
  stopMapInteractionPropagation,
} from "../src/features/map/mapDomain";

describe("mapDomain", () => {
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

    test("builds one affordance and overview marker per grouped section", () => {
      const affordanceMarkers = buildSectionAffordanceMarkers(sectionsGeoJson);
      const overviewMarkers = buildSectionOverviewMarkers(sectionsGeoJson, new Map([
        ["4", 484],
        ["7", 485],
      ]));

      expect(affordanceMarkers).toHaveLength(2);
      expect(affordanceMarkers[0].id).toBe("section-affordance:4");
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

    test("uses section overview markers as the default zoomed-out presentation", () => {
      expect(resolveSectionOverlayVisibility({
        currentZoom: 14,
      })).toEqual({
        showSectionOverviewMarkers: true,
        showSections: false,
      });

      expect(resolveSectionOverlayVisibility({
        currentZoom: 15,
      })).toEqual({
        showSectionOverviewMarkers: true,
        showSections: false,
      });

      expect(resolveSectionOverlayVisibility({
        currentZoom: 16,
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

    test("keeps section affordance icons out of the overview policy", () => {
      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 14,
      })).toBe(false);
      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 15,
      })).toBe(false);
      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 16,
      })).toBe(false);

      expect(resolveSectionAffordanceMarkerVisibility({
        currentZoom: 15,
        preferOverviewMarkers: false,
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
        currentZoom: 17,
        disableClusteringAtZoom: 19,
      })).toBe(19);
      expect(resolveClusterExpansionZoom({
        currentZoom: 18,
        disableClusteringAtZoom: 19,
      })).toBe(19);
    });

    test("keeps roads off until explicitly enabled or useful for orientation", () => {
      expect(resolveRoadOverlayVisibility()).toBe(false);
      expect(resolveRoadOverlayVisibility({ roadOverlayVisible: true })).toBe(true);
      expect(resolveRoadOverlayVisibility({ hasActiveRoute: true })).toBe(true);
      expect(resolveRoadOverlayVisibility({ hasTrackedLocation: true })).toBe(true);

      expect(resolveMapPresentationPolicy({
        currentZoom: 14,
        maxZoom: 19,
      })).toMatchObject({
        sectionBurialClusterRadius: MAP_PRESENTATION_POLICY.sectionBurialClusterRadius,
        sectionBurialDisableClusteringZoom: 19,
        showRoads: false,
        showSectionAffordanceMarkers: false,
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
      expect(ROAD_LAYER_STYLE.opacity).toBeLessThan(0.7);
      expect(ROAD_LAYER_STYLE.weight).toBeLessThan(1.5);
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

  describe("pmtiles experiment rules", () => {
    test("detects indexed burial placement from grave or tier metadata", () => {
      expect(hasIndexedBurialPlacement({ Grave: 2 })).toBe(true);
      expect(hasIndexedBurialPlacement({ Tier: 3 })).toBe(true);
      expect(hasIndexedBurialPlacement({ Grave: "0", Tier: "0" })).toBe(false);
      expect(hasIndexedBurialPlacement({ Grave: "not-a-number" })).toBe(false);
    });

    test("keeps glyph offsets deterministic for the same burial record and scales by zoom", () => {
      const burialRecord = {
        OBJECTID: 42,
        Section: "107",
        Lot: "3",
        Grave: 4,
        Tier: 2,
        First_Name: "Anna",
        Last_Name: "Tracy",
      };

      expect(getPmtilesExperimentGlyphOffset(20, burialRecord, true)).toEqual(
        getPmtilesExperimentGlyphOffset(20, burialRecord, true)
      );
      expect(getPmtilesExperimentGlyphOffset(18, burialRecord, false)).toEqual(
        getPmtilesExperimentGlyphOffset(18, burialRecord, false)
      );

      expect(getPmtilesExperimentGlyphSize(18, false)).toBeLessThan(
        getPmtilesExperimentGlyphSize(18, true)
      );
      expect(getPmtilesExperimentGlyphSize(18, true)).toBeLessThan(
        getPmtilesExperimentGlyphSize(22, true)
      );
    });
  });
});
