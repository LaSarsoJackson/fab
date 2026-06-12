import React, { memo, useEffect } from "react";
import { CircleMarker, GeoJSON, ImageOverlay, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import {
  Box,
  ClickAwayListener,
  Divider,
  IconButton,
  Paper,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import HomeIcon from "@mui/icons-material/Home";
import LayersIcon from "@mui/icons-material/Layers";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import RemoveIcon from "@mui/icons-material/Remove";
import SearchIcon from "@mui/icons-material/Search";
import {
  getSectionPoiIcon,
} from "./mapMarkerIcons";
import { formatSectionOverviewMarkerLabel, getPopupViewportPadding } from "./mapDomain";
import { buildPublicAssetUrl } from "../../shared/runtimeEnv";
export { createCemeteryClusterIcon } from "./mapMarkerIcons";

/**
 * Leaflet chrome and React-Leaflet adapters.
 *
 * Keep visual controls, basemap/GeoJSON adapters, and viewport-padding bridges
 * here. The top-level map shell owns state and decides when these helpers run.
 */

const DESKTOP_MAP_CONTROL_RIGHT = "12px";
const DESKTOP_MAP_CONTROL_TOP = "12px";
const MOBILE_MAP_CONTROL_RIGHT = "calc(env(safe-area-inset-right, 0px) + 12px)";
const MOBILE_MAP_CONTROL_TOP = "calc(env(safe-area-inset-top, 0px) + 10px)";
const MAP_CONTROL_BUTTON_SIZE = 44;
const DEFAULT_BASEMAP_KEEP_BUFFER = 4;
const GEOJSON_DATA_KEYS = new WeakMap();
let nextGeoJsonDataKey = 1;

const buildPaddingPoint = (x, y) => [x, y];

const getSectionOverviewMarkerRadius = (count = 0) => {
  if (count >= 2000) return 9;
  if (count >= 1000) return 8;
  if (count >= 300) return 7;
  return 6;
};

const getOverlayRect = (getOverlayElement) => {
  if (typeof getOverlayElement !== "function") return undefined;
  return getOverlayElement()?.getBoundingClientRect?.();
};

export const getLeafletViewportPadding = (
  map,
  {
    basePadding = 16,
    getOverlayElement,
  } = {}
) => {
  // Leaflet wants two padding points, while the shared viewport helper works in
  // DOM rectangles. This adapter keeps map-shell viewport rules centralized.
  const mapContainer = map?.getContainer?.();
  if (!mapContainer || typeof document === "undefined") {
    return {
      paddingTopLeft: buildPaddingPoint(basePadding, basePadding),
      paddingBottomRight: buildPaddingPoint(basePadding, basePadding),
    };
  }

  const containerRect = mapContainer.getBoundingClientRect();
  const overlayRect = getOverlayRect(getOverlayElement);
  const { topLeft, bottomRight } = getPopupViewportPadding({
    containerRect,
    overlayRect,
    basePadding,
  });

  return {
    paddingTopLeft: buildPaddingPoint(topLeft[0], topLeft[1]),
    paddingBottomRight: buildPaddingPoint(bottomRight[0], bottomRight[1]),
  };
};

export const fitBoundsInVisibleViewport = (
  map,
  bounds,
  {
    getOverlayElement,
    ...options
  } = {}
) => {
  if (!map || !bounds) return;

  const { paddingTopLeft, paddingBottomRight } = getLeafletViewportPadding(map, {
    basePadding: 24,
    getOverlayElement,
  });

  map.fitBounds(bounds, {
    ...options,
    paddingTopLeft,
    paddingBottomRight,
  });
};

export const isLatLngInsideVisibleViewport = (
  map,
  latLng,
  {
    basePadding = 24,
    getOverlayElement,
  } = {}
) => {
  if (!map || !latLng) return false;
  if (
    typeof map.latLngToContainerPoint !== "function" ||
    typeof map.getSize !== "function"
  ) {
    return false;
  }

  const point = map.latLngToContainerPoint(latLng);
  const size = map.getSize();
  if (!point || !size) return false;

  const { paddingTopLeft, paddingBottomRight } = getLeafletViewportPadding(map, {
    basePadding,
    getOverlayElement,
  });
  const minX = paddingTopLeft.x;
  const minY = paddingTopLeft.y;
  const maxX = size.x - paddingBottomRight.x;
  const maxY = size.y - paddingBottomRight.y;

  return (
    point.x >= minX &&
    point.x <= maxX &&
    point.y >= minY &&
    point.y <= maxY
  );
};

export const panIntoVisibleViewport = (
  map,
  latLng,
  {
    getOverlayElement,
    ...options
  } = {}
) => {
  if (!map || !latLng) return;

  const { paddingTopLeft, paddingBottomRight } = getLeafletViewportPadding(map, {
    basePadding: 24,
    getOverlayElement,
  });

  map.panInside(latLng, {
    ...options,
    paddingTopLeft,
    paddingBottomRight,
  });
};

export const keepPopupInView = (
  popup,
  {
    getOverlayElement,
  } = {}
) => {
  const map = popup?._map;
  if (!map) return;

  const { paddingTopLeft, paddingBottomRight } = getLeafletViewportPadding(map, {
    basePadding: 16,
    getOverlayElement,
  });

  popup.options.autoPanPaddingTopLeft = paddingTopLeft;
  popup.options.autoPanPaddingBottomRight = paddingBottomRight;

  if (typeof popup._adjustPan === "function") {
    popup._adjustPan();
  }
};

export const syncPopupLayout = (popup, options = {}) => {
  if (!popup) return;

  if (typeof popup.update === "function") {
    popup.update();
  }

  keepPopupInView(popup, options);
};

export const schedulePopupInView = (popup, options = {}) => {
  if (!popup) return;

  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    syncPopupLayout(popup, options);
    return;
  }

  window.requestAnimationFrame(() => {
    syncPopupLayout(popup, options);
  });
};

export const getLeafletGeoJsonDataKey = (featureCollection) => {
  if (!featureCollection || typeof featureCollection !== "object") {
    return "empty";
  }

  // React-Leaflet does not deeply diff GeoJSON feature collections. A WeakMap
  // key lets us force remounts when a new data object is loaded without leaking
  // ids for discarded collections.
  let dataKey = GEOJSON_DATA_KEYS.get(featureCollection);

  if (!dataKey) {
    dataKey = `geojson-${nextGeoJsonDataKey++}`;
    GEOJSON_DATA_KEYS.set(featureCollection, dataKey);
  }

  return dataKey;
};

export const LeafletGeoJsonLayer = ({ layerId, data, ...geoJsonProps }) => (
  <GeoJSON
    key={`${layerId}:${getLeafletGeoJsonDataKey(data)}`}
    data={data}
    {...geoJsonProps}
  />
);

export const isLeafletRasterBasemap = (basemap) => (
  basemap?.type === "raster-xyz" &&
  typeof basemap?.urlTemplate === "string" &&
  basemap.urlTemplate.length > 0
);

export const isLeafletImageBasemap = (basemap) => (
  basemap?.type === "image-overlay" && (
    (
      Array.isArray(basemap?.imageOverlays) &&
      basemap.imageOverlays.some((overlay) => (
        typeof overlay?.imageUrl === "string" &&
        overlay.imageUrl.length > 0 &&
        Array.isArray(overlay.bounds)
      ))
    ) ||
    (
      typeof basemap?.imageUrl === "string" &&
      basemap.imageUrl.length > 0 &&
      Array.isArray(basemap.bounds)
    )
  )
);

const getLeafletBasemapNativeMaxZoom = (basemap) => (
  Number.isFinite(basemap?.maxNativeZoom) ? basemap.maxNativeZoom : basemap?.maxZoom
);

const LeafletRasterBasemapTile = ({ basemap, keepBuffer }) => (
  <TileLayer
    key={basemap.id || basemap.urlTemplate}
    url={basemap.urlTemplate}
    minZoom={basemap.minZoom}
    maxZoom={basemap.maxZoom}
    maxNativeZoom={getLeafletBasemapNativeMaxZoom(basemap)}
    tileSize={basemap.tileSize || 256}
    attribution={basemap.attribution || ""}
    className="leaflet-basemap-tile"
    keepBuffer={keepBuffer}
    updateWhenIdle={false}
    updateWhenZooming={false}
  />
);

export const LeafletBasemapLayer = ({ basemap, keepBuffer = DEFAULT_BASEMAP_KEEP_BUFFER }) => {
  if (isLeafletImageBasemap(basemap)) {
    const fallbackRaster = isLeafletRasterBasemap(basemap.fallbackRaster)
      ? basemap.fallbackRaster
      : null;
    const imageOverlays = (Array.isArray(basemap.imageOverlays)
      ? basemap.imageOverlays
      : [basemap]
    ).filter((overlay) => (
      typeof overlay?.imageUrl === "string" &&
      overlay.imageUrl.length > 0 &&
      Array.isArray(overlay.bounds)
    ));

    return (
      <>
        {fallbackRaster && (
          <LeafletRasterBasemapTile basemap={fallbackRaster} keepBuffer={keepBuffer} />
        )}
        {imageOverlays.map((overlay, index) => (
          <ImageOverlay
            key={overlay.id || overlay.imageUrl || `${basemap.id}:image:${index}`}
            url={buildPublicAssetUrl(overlay.imageUrl)}
            bounds={overlay.bounds}
            opacity={overlay.opacity ?? basemap.opacity ?? 1}
            zIndex={overlay.zIndex ?? index + 1}
            attribution={overlay.attribution || basemap.attribution || ""}
            className="leaflet-basemap-image"
          />
        ))}
      </>
    );
  }

  if (!isLeafletRasterBasemap(basemap)) {
    return null;
  }

  return <LeafletRasterBasemapTile basemap={basemap} keepBuffer={keepBuffer} />;
};

const mapControlShellSx = {
  borderRadius: "18px",
  border: "1px solid rgba(18, 47, 40, 0.12)",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 252, 0.9))",
  boxShadow: "0 18px 36px rgba(16, 35, 31, 0.16)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  overflow: "hidden",
};

const mapControlButtonSx = {
  width: MAP_CONTROL_BUTTON_SIZE,
  height: MAP_CONTROL_BUTTON_SIZE,
  borderRadius: 0,
  color: "var(--text-main)",
};

const mapControlOptionButtonSx = {
  display: "grid",
  gridTemplateColumns: "20px minmax(0, 1fr)",
  alignItems: "center",
  columnGap: "10px",
  width: "100%",
  minHeight: "44px",
  border: 0,
  borderRadius: "10px",
  padding: "8px 6px",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
  transition: "background-color 0.16s ease",
  "&:hover": {
    backgroundColor: "rgba(18, 47, 40, 0.06)",
  },
  "&:focus-visible": {
    outline: "2px solid var(--accent-strong, rgba(47, 107, 87, 0.55))",
    outlineOffset: "-2px",
  },
};

const MapLayerControlOption = ({
  active,
  label,
  onClick,
  icon: Icon,
  inactiveIcon: InactiveIcon,
}) => {
  const VisibleIcon = active ? Icon : InactiveIcon;

  return (
    <Box component="button" type="button" onClick={onClick} sx={mapControlOptionButtonSx}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: active ? "var(--text-main)" : "rgba(24, 45, 40, 0.6)",
        }}
      >
        <VisibleIcon fontSize="small" />
      </Box>
      <Typography
        sx={{
          fontSize: "0.88rem",
          fontWeight: active ? 700 : 600,
          color: "var(--text-main)",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

// Controls sit above the Leaflet pane, but only the control children should
// receive pointer events. The wrapper stays transparent to map drag/pinch input.
export function MapControlStack({ isMobile, children }) {
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <Box
      sx={{
        position: "absolute",
        top: isMobile ? MOBILE_MAP_CONTROL_TOP : DESKTOP_MAP_CONTROL_TOP,
        right: isMobile ? MOBILE_MAP_CONTROL_RIGHT : DESKTOP_MAP_CONTROL_RIGHT,
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        alignItems: "flex-end",
        width: "max-content",
        pointerEvents: "none",
      }}
    >
      {items.map((child, index) => (
        <Box
          key={index}
          sx={{
            pointerEvents: "auto",
            width: "auto",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {child}
        </Box>
      ))}
    </Box>
  );
}

export function MapLayerControl({
  basemapOptions,
  activeBasemapId,
  isOpen,
  onBasemapChange,
  onOpenChange,
  overlayOptions,
  overlayVisibility,
  onToggleOverlay,
}) {
  return (
    <ClickAwayListener onClickAway={() => onOpenChange(false)}>
      <Box
        sx={{
          position: "relative",
          width: MAP_CONTROL_BUTTON_SIZE,
          height: MAP_CONTROL_BUTTON_SIZE,
          overflow: "visible",
        }}
      >
        {isOpen && (
          <Paper
            elevation={0}
            sx={{
              ...mapControlShellSx,
              position: "absolute",
              top: 0,
              right: "calc(100% + 10px)",
              width: "min(260px, calc(100vw - 84px))",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                padding: "12px 14px 10px",
                borderBottom: "1px solid rgba(18, 47, 40, 0.12)",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "rgba(24, 45, 40, 0.72)",
                }}
              >
                Map layers
              </Typography>
            </Box>
            <Box
              sx={{
                display: "grid",
                gap: "12px",
                padding: "10px 12px 12px",
              }}
            >
              <Box sx={{ display: "grid", gap: "4px" }}>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "rgba(24, 45, 40, 0.72)",
                  }}
                >
                  Basemap
                </Typography>
                {basemapOptions.map((option) => (
                  <MapLayerControlOption
                    key={option.id}
                    active={activeBasemapId === option.id}
                    label={option.label}
                    onClick={() => onBasemapChange(option.id)}
                    icon={RadioButtonCheckedIcon}
                    inactiveIcon={RadioButtonUncheckedIcon}
                  />
                ))}
              </Box>

              <Divider sx={{ borderColor: "rgba(18, 47, 40, 0.12)" }} />

              <Box sx={{ display: "grid", gap: "4px" }}>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "rgba(24, 45, 40, 0.72)",
                  }}
                >
                  Overlays
                </Typography>
                {overlayOptions.map((option) => (
                  <MapLayerControlOption
                    key={option.id}
                    active={overlayVisibility[option.id] !== false}
                    label={option.label}
                    onClick={() => onToggleOverlay(option.id)}
                    icon={CheckBoxIcon}
                    inactiveIcon={CheckBoxOutlineBlankIcon}
                  />
                ))}
              </Box>
            </Box>
          </Paper>
        )}
        <Paper
          elevation={0}
          sx={{
            ...mapControlShellSx,
            position: "relative",
            zIndex: 1,
          }}
        >
          <IconButton
            onClick={() => onOpenChange(!isOpen)}
            size="small"
            title={isOpen ? "Close map layers" : "Open map layers"}
            aria-label={isOpen ? "Close map layers" : "Open map layers"}
            aria-expanded={isOpen}
            sx={mapControlButtonSx}
          >
            <LayersIcon fontSize="small" />
          </IconButton>
        </Paper>
      </Box>
    </ClickAwayListener>
  );
}

export function MapZoomControl({ isMobile, onZoomIn, onZoomOut }) {
  if (isMobile) {
    return null;
  }

  return (
    <Paper elevation={0} sx={mapControlShellSx}>
      <Box sx={{ display: "grid" }}>
        <IconButton
          onClick={onZoomIn}
          size="small"
          sx={mapControlButtonSx}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <AddIcon fontSize="small" />
        </IconButton>
        <Box sx={{ height: 1, backgroundColor: "rgba(18, 47, 40, 0.1)" }} />
        <IconButton
          onClick={onZoomOut}
          size="small"
          sx={mapControlButtonSx}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <RemoveIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}

export function SidebarToggleControl({ isSearchPanelVisible = true, onToggle }) {
  const label = isSearchPanelVisible ? "Collapse" : "Search";
  const ToggleIcon = isSearchPanelVisible ? MenuOpenIcon : SearchIcon;

  return (
    <Paper elevation={0} sx={mapControlShellSx}>
      <IconButton
        onClick={onToggle}
        size="small"
        title={label}
        aria-label={label}
        aria-pressed={!isSearchPanelVisible}
        sx={mapControlButtonSx}
      >
        <ToggleIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

export function CustomZoomControl({ isMobile }) {
  const map = useMap();

  return (
    <MapZoomControl
      isMobile={isMobile}
      onZoomIn={() => map.zoomIn()}
      onZoomOut={() => map.zoomOut()}
    />
  );
}

// Applies profile-defined map limits from inside React-Leaflet, where the
// Leaflet instance is available through `useMap`.
export function MapBounds({ fitMapBounds, paddedBoundaryBounds, maxZoom, minZoom = 13 }) {
  const map = useMap();

  useEffect(() => {
    map.setMaxBounds(paddedBoundaryBounds);
    map.setMinZoom(minZoom);
    map.setMaxZoom(maxZoom);

    if (map.getZoom() > maxZoom) {
      map.setZoom(maxZoom, { animate: false });
    }

    map.whenReady(() => {
      fitMapBounds(map, paddedBoundaryBounds);
    });
  }, [fitMapBounds, map, maxZoom, minZoom, paddedBoundaryBounds]);

  return null;
}

export function ActiveLeafletBasemap({ basemap, keepBuffer = DEFAULT_BASEMAP_KEEP_BUFFER }) {
  if (!basemap) {
    return null;
  }

  return <LeafletBasemapLayer basemap={basemap} keepBuffer={keepBuffer} />;
}

export const MapSectionOverviewMarkers = memo(function MapSectionOverviewMarkers({
  markers,
  onSelectSection,
}) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return null;
  }

  return (
    <>
      {markers.map((marker) => (
        <CircleMarker
          key={marker.id}
          center={[marker.lat, marker.lng]}
          radius={getSectionOverviewMarkerRadius(marker.count)}
          pathOptions={{
            color: "rgba(29, 63, 54, 0.42)",
            weight: 1.5,
            fillColor: "rgba(255, 255, 255, 0.96)",
            fillOpacity: 0.92,
          }}
          eventHandlers={{
            click: () => onSelectSection?.(marker.sectionValue, marker.bounds),
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -6]}
            className="section-label section-label--overview"
          >
            {`Section ${marker.sectionValue}`}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
});

export const MapSectionClusterMarkers = memo(function MapSectionClusterMarkers({
  markers,
  onSelectSection,
}) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return null;
  }

  return (
    <>
      {markers.map((marker) => (
        <Marker
          key={`cluster-${marker.id}`}
          position={[marker.lat, marker.lng]}
          icon={getSectionPoiIcon({
            sectionValue: marker.sectionValue,
            size: 30,
            variant: "detail",
            withLabel: true,
          })}
          eventHandlers={{
            click: () => onSelectSection?.(marker.sectionValue, marker.bounds),
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -8]}
            className="section-label section-label--overview"
          >
            {formatSectionOverviewMarkerLabel(marker)}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
});

export const MapSectionAffordanceMarkers = memo(function MapSectionAffordanceMarkers({
  markers,
  onSelectSection,
}) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return null;
  }

  return (
    <>
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lng]}
          icon={getSectionPoiIcon({
            sectionValue: marker.sectionValue,
            size: marker.size,
            variant: "overview",
            withLabel: true,
          })}
          eventHandlers={{
            click: () => onSelectSection?.(marker.sectionValue, marker.bounds),
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -8]}
            className="section-label section-label--overview"
          >
            {`Section ${marker.sectionValue}`}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
});

// Bridges Leaflet events back to the map shell without making the shell call
// `useMap`. This keeps viewport intent and zoom state centralized in Map.jsx.
export function MapController({ mapRef, onViewportMoveStart, onZoomChange }) {
  const leafletMap = useMap();

  useEffect(() => {
    mapRef.current = leafletMap;

    return () => {
      if (mapRef.current === leafletMap) {
        mapRef.current = null;
      }
    };
  }, [leafletMap, mapRef]);

  useEffect(() => {
    if (typeof onZoomChange !== "function") {
      return undefined;
    }

    leafletMap.on("zoomend", onZoomChange);
    return () => {
      leafletMap.off("zoomend", onZoomChange);
    };
  }, [leafletMap, onZoomChange]);

  useEffect(() => {
    if (typeof onViewportMoveStart !== "function") {
      return undefined;
    }

    const handleDragStart = () => onViewportMoveStart("dragstart");
    const handleZoomStart = () => onViewportMoveStart("zoomstart");
    const handleBoxZoomStart = () => onViewportMoveStart("boxzoomstart");

    leafletMap.on("dragstart", handleDragStart);
    leafletMap.on("zoomstart", handleZoomStart);
    leafletMap.on("boxzoomstart", handleBoxZoomStart);

    return () => {
      leafletMap.off("dragstart", handleDragStart);
      leafletMap.off("zoomstart", handleZoomStart);
      leafletMap.off("boxzoomstart", handleBoxZoomStart);
    };
  }, [leafletMap, onViewportMoveStart]);

  return null;
}

export function MapHomeButton({ onClick }) {
  return (
    <Paper elevation={0} sx={mapControlShellSx}>
      <IconButton
        onClick={onClick}
        size="small"
        title="Return to Default Extent"
        aria-label="Return to default extent"
        sx={mapControlButtonSx}
      >
        <HomeIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

export function DefaultExtentButton({ defaultViewBounds, fitMapBounds }) {
  const map = useMap();

  return (
    <MapHomeButton onClick={() => fitMapBounds(map, defaultViewBounds, { isExplicitFocus: true })} />
  );
}

export function MobileLocateButton({
  isMobile,
  locationMessages = {},
  locationStatus = "",
  onLocate,
}) {
  if (!isMobile) {
    return null;
  }

  const normalizedStatus = String(locationStatus || "").trim();
  const isLocating = Boolean(locationMessages.locating && normalizedStatus === locationMessages.locating);
  const isActive = Boolean(
    normalizedStatus &&
    [
      locationMessages.active,
      locationMessages.approximate,
      locationMessages.weakSignal,
    ].filter(Boolean).includes(normalizedStatus)
  );
  const label = isLocating
    ? "Finding location"
    : isActive
      ? "Recenter"
      : "Locate";

  return (
    <Paper elevation={0} sx={mapControlShellSx}>
      <IconButton
        onClick={() => {
          void onLocate?.();
        }}
        size="small"
        title={label}
        aria-label={label}
        aria-pressed={isActive}
        sx={{
          ...mapControlButtonSx,
          color: isActive ? "var(--accent-strong)" : mapControlButtonSx.color,
          backgroundColor: isActive ? "var(--accent-soft)" : mapControlButtonSx.backgroundColor,
        }}
      >
        <MyLocationIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

export function RouteStatusOverlay({
  isCalculating,
  isMobile = false,
  routingError,
  routingNotice = "",
}) {
  if (!isCalculating && !routingError && !routingNotice) {
    return null;
  }

  const isError = Boolean(routingError);
  const message = routingError || routingNotice || "Starting on-site navigation...";
  const placementSx = isMobile
    ? {
        top: "calc(env(safe-area-inset-top, 0px) + 10px)",
        right: "calc(env(safe-area-inset-right, 0px) + 68px)",
        bottom: "auto",
        left: "calc(env(safe-area-inset-left, 0px) + 12px)",
        transform: "none",
        zIndex: 1500,
      }
    : {
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1200,
        maxWidth: "min(520px, calc(100vw - 32px))",
      };

  return (
    <Paper
      elevation={0}
      className={[
        "route-status-overlay",
        isError ? "route-status-overlay--error" : "route-status-overlay--progress",
        isMobile ? "route-status-overlay--mobile" : "route-status-overlay--desktop",
      ].join(" ")}
      data-placement={isMobile ? "mobile-top" : "desktop-bottom"}
      role="status"
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      sx={{
        position: "absolute",
        ...placementSx,
        px: 1.6,
        py: 1.1,
        width: isMobile ? "auto" : "max-content",
        borderRadius: "18px",
        border: isError
          ? "1px solid rgba(170, 52, 48, 0.18)"
          : "1px solid rgba(20, 33, 43, 0.08)",
        backgroundColor: isError
          ? "rgba(167, 46, 42, 0.96)"
          : "rgba(255, 255, 255, 0.96)",
        color: isError ? "#ffffff" : "var(--text-main)",
        boxShadow: "0 18px 36px rgba(20, 33, 43, 0.18)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: "inherit",
          fontWeight: 600,
          lineHeight: 1.35,
          overflowWrap: "anywhere",
        }}
      >
        {message}
      </Typography>
    </Paper>
  );
}
