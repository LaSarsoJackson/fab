import { getGeoJsonBounds, isLatLngBoundsExpressionValid } from "../../shared/geo";

const normalizeSectionValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

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
  sectionDetailMinZoom = 16,
  sectionFilter = "",
  sectionOverviewMarkerMinZoom = 15,
  selectedTour = null,
} = {}) => {
  const hasFocusedContext = Boolean(
    normalizeSectionValue(sectionFilter) ||
    normalizeSectionValue(selectedTour)
  );

  return {
    showSectionOverviewMarkers: (
      !hasFocusedContext &&
      currentZoom >= sectionOverviewMarkerMinZoom &&
      currentZoom < sectionDetailMinZoom
    ),
    showSections: hasFocusedContext || currentZoom >= sectionDetailMinZoom,
  };
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
