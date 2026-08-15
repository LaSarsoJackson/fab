import L from "leaflet";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

export const MAP_MARKER_COLORS = [
  "#2f6b57",
  "#547487",
  "#8a6848",
  "#6f5c78",
  "#63745d",
  "#885c56",
];

const SECTION_MARKER_GLYPH = `
  <svg class="section-marker-glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path
      d="M10 27V12.5C10 8.91 12.91 6 16.5 6S23 8.91 23 12.5V27H25.5V29H7.5V27H10Z"
      class="section-marker-glyph__body"
      stroke-width="1.35"
      stroke-linejoin="round"
    />
    <circle class="section-marker-glyph__dot" cx="16.5" cy="14.8" r="2.15" />
    <path
      class="section-marker-glyph__base"
      d="M12.25 24.75H20.75"
      stroke-width="1.2"
      stroke-linecap="round"
    />
  </svg>
`;

const BURIAL_CLUSTER_DENSITY_STEPS = [
  { min: 50, className: "cemetery-cluster--massive", label: "50 or more records" },
  { min: 20, className: "cemetery-cluster--dense", label: "20 to 49 records" },
  { min: 10, className: "cemetery-cluster--full", label: "10 to 19 records" },
  { min: 6, className: "cemetery-cluster--clustered", label: "6 to 9 records" },
  { min: 3, className: "cemetery-cluster--paired", label: "3 to 5 records" },
];
const SECTION_CLUSTER_DENSITY_STEPS = [
  { min: 1000, className: "cemetery-cluster--massive", label: "1000 or more records" },
  { min: 250, className: "cemetery-cluster--dense", label: "250 to 999 records" },
  { min: 75, className: "cemetery-cluster--full", label: "75 to 249 records" },
  { min: 20, className: "cemetery-cluster--clustered", label: "20 to 74 records" },
];
const BURIAL_CLUSTER_DENSITY_FALLBACK = {
  className: "cemetery-cluster--small",
  label: "1 to 2 records",
};
const SECTION_CLUSTER_DENSITY_FALLBACK = {
  className: "cemetery-cluster--small",
  label: "fewer than 20 records",
};

const sectionPoiIcons = new Map();

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const getBurialClusterIconSize = (count = 0) => {
  const normalizedCount = Math.max(0, Number(count) || 0);
  if (normalizedCount >= 50) return 40;
  if (normalizedCount >= 20) return 37;
  if (normalizedCount >= 10) return 34;
  if (normalizedCount >= 6) return 32;
  if (normalizedCount >= 3) return 31;
  return 30;
};

const resolveClusterDensity = (count, steps, fallback) => {
  const normalizedCount = Math.max(0, Number(count) || 0);
  return steps.find(({ min }) => normalizedCount >= min) || fallback;
};

const getClusterDensityRules = (scale) => (
  scale === "section"
    ? {
        steps: SECTION_CLUSTER_DENSITY_STEPS,
        fallback: SECTION_CLUSTER_DENSITY_FALLBACK,
      }
    : {
        steps: BURIAL_CLUSTER_DENSITY_STEPS,
        fallback: BURIAL_CLUSTER_DENSITY_FALLBACK,
      }
);

const getCemeteryClusterDensityClass = (count = 0, { scale = "field" } = {}) => {
  const { steps, fallback } = getClusterDensityRules(scale);
  return resolveClusterDensity(count, steps, fallback).className;
};

const getCemeteryClusterDensityLabel = (count = 0) => {
  const { steps, fallback } = getClusterDensityRules("field");
  return resolveClusterDensity(count, steps, fallback).label;
};

export const getSectionPoiIcon = ({
  sectionValue = "",
  size = 26,
  variant = "overview",
  withLabel = true,
} = {}) => {
  const badge = Math.round(size);
  const label = sectionValue ? `Sec ${sectionValue}` : "";
  const escapedLabel = escapeHtml(label);
  const cacheKey = `${sectionValue}:${size}:${variant}:${withLabel}`;

  if (sectionPoiIcons.has(cacheKey)) {
    return sectionPoiIcons.get(cacheKey);
  }

  const html = `
    <div class="section-poi section-poi--${variant}">
      <div class="section-poi__badge" style="width:${badge}px;height:${badge}px;">
        ${SECTION_MARKER_GLYPH}
      </div>
      ${withLabel && label ? `<span class="section-poi__label">${escapedLabel}</span>` : ""}
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: "section-poi-icon",
    iconSize: [72, badge + 18],
    iconAnchor: [36, badge / 2],
    popupAnchor: [0, -badge / 2],
  });

  sectionPoiIcons.set(cacheKey, icon);
  return icon;
};

// "You are here" is the most important marker on-site, yet it used to be a
// plain green dot that blended into the green section and burial markers. Map
// convention the world over reads a pulsing blue dot as "me", so the location
// marker now uses the same navigation blue as the route line and carries a soft
// pulse so a visitor can find themselves at a glance under tree canopy and sun
// glare. Built once and reused — the live position drives the Marker, not the icon.
let locationMarkerIcon = null;

export const createLocationMarkerIcon = () => {
  if (locationMarkerIcon) {
    return locationMarkerIcon;
  }

  locationMarkerIcon = L.divIcon({
    className: "location-marker-icon",
    html: `
      <div class="location-marker" aria-hidden="true">
        <span class="location-marker__pulse"></span>
        <span class="location-marker__dot"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  return locationMarkerIcon;
};

export const createCemeteryClusterIcon = ({
  count = 0,
  label = String(Math.max(0, Number(count) || 0)),
  size,
  wrapperClassName = "cemetery-cluster cemetery-cluster--burial",
  className = "custom-cluster-icon",
  densityClassName,
  densityLabel,
} = {}) => {
  const normalizedCount = Math.max(0, Number(count) || 0);
  const normalizedSize = Number.isFinite(Number(size))
    ? Number(size)
    : getBurialClusterIconSize(normalizedCount);
  const resolvedDensityClass = densityClassName === undefined
    ? getCemeteryClusterDensityClass(normalizedCount)
    : densityClassName;
  const wrapperClasses = [wrapperClassName, resolvedDensityClass].filter(Boolean).join(" ");
  const resolvedDensityLabel = densityLabel || getCemeteryClusterDensityLabel(normalizedCount);
  const escapedDensityLabel = escapeHtml(resolvedDensityLabel);
  const escapedLabel = escapeHtml(label);

  return L.divIcon({
    html: `
      <div class="${wrapperClasses}" data-density-label="${escapedDensityLabel}">
        <span class="cemetery-cluster__count">${escapedLabel}</span>
      </div>
    `,
    className,
    iconSize: [normalizedSize, normalizedSize],
    iconAnchor: [normalizedSize / 2, normalizedSize / 2],
  });
};

export const createSelectedLocationIcon = ({ count = 0, isHighlighted = false } = {}) => (
  createCemeteryClusterIcon({
    count,
    size: 34,
    wrapperClassName: [
      "cemetery-cluster",
      "selected-location-marker",
      isHighlighted ? "selected-location-marker--highlighted" : "",
    ].filter(Boolean).join(" "),
    className: "custom-cluster-icon selected-location-marker-icon",
  })
);

const selectedBurialIcons = new Map();

export const getSelectedBurialPinOffset = (index = 0, count = 1) => {
  const normalizedCount = Math.max(1, Math.floor(Number(count) || 1));
  const normalizedIndex = Math.max(0, Math.floor(Number(index) || 0));

  if (normalizedCount === 1) {
    return { x: 0, y: 0 };
  }

  if (normalizedCount === 2) {
    return { x: normalizedIndex % 2 === 0 ? -14 : 14, y: 0 };
  }

  const angle = ((Math.PI * 2) / normalizedCount) * normalizedIndex - (Math.PI / 2);
  const radius = 18;

  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
};

/**
 * FABFG's locator represents a selected burial as a normal map pin, not a
 * cluster/count badge. Keep active styling in the class name so Leaflet can
 * reuse one icon per state while each person remains a separate Marker.
 */
export const createSelectedBurialIcon = ({ isHighlighted = false, offset = null } = {}) => {
  const offsetX = Math.round(Number(offset?.x) || 0);
  const offsetY = Math.round(Number(offset?.y) || 0);
  const state = isHighlighted ? "highlighted" : "default";
  const cacheKey = `${state}:${offsetX}:${offsetY}`;

  if (!selectedBurialIcons.has(cacheKey)) {
    selectedBurialIcons.set(cacheKey, new L.Icon.Default({
      className: [
        "selected-burial-marker-icon",
        isHighlighted ? "selected-burial-marker-icon--highlighted" : "",
      ].filter(Boolean).join(" "),
      iconRetinaUrl: markerIconRetinaUrl,
      iconUrl: markerIconUrl,
      shadowUrl: markerShadowUrl,
      iconAnchor: [12 - offsetX, 41 - offsetY],
      popupAnchor: [offsetX + 1, offsetY - 34],
      tooltipAnchor: [offsetX + 16, offsetY - 28],
    }));
  }

  return selectedBurialIcons.get(cacheKey);
};

export const getSectionClusterIcon = (count = 0) => {
  return getSectionPoiIcon({
    sectionValue: "",
    size: 30,
    variant: "detail",
    withLabel: false,
  });
};

export const getSectionAffordanceIcon = (size = 28) => {
  return getSectionPoiIcon({
    sectionValue: "",
    size,
    variant: "overview",
    withLabel: false,
  });
};
