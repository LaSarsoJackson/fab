import React, { useEffect, useState } from "react";
import { GeoJSON, TileLayer, useMap } from "react-leaflet";
import {
  Box,
  ClickAwayListener,
  Divider,
  IconButton,
  Paper,
  Slider,
  Switch,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import HomeIcon from "@mui/icons-material/Home";
import LayersIcon from "@mui/icons-material/Layers";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import RemoveIcon from "@mui/icons-material/Remove";
import TuneIcon from "@mui/icons-material/Tune";
import { createLeafletMapRuntime } from "./engine/leafletRuntime";
import { getPopupViewportPadding } from "./popupViewport";

const DESKTOP_MAP_CONTROL_RIGHT = "12px";
const DESKTOP_MAP_CONTROL_TOP = "12px";
const MOBILE_MAP_CONTROL_RIGHT = "calc(env(safe-area-inset-right, 0px) + 12px)";
const MOBILE_MAP_CONTROL_TOP = "calc(env(safe-area-inset-top, 0px) + 10px)";
const MAP_CONTROL_BUTTON_SIZE = 44;
const DEFAULT_BASEMAP_KEEP_BUFFER = 1;
const GEOJSON_DATA_KEYS = new WeakMap();
let nextGeoJsonDataKey = 1;

const buildPaddingPoint = (x, y) => [x, y];

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

export const LeafletBasemapLayer = ({ basemap, keepBuffer = 1 }) => {
  if (!isLeafletRasterBasemap(basemap)) {
    return null;
  }

  return (
    <TileLayer
      key={basemap.id || basemap.urlTemplate}
      url={basemap.urlTemplate}
      minZoom={basemap.minZoom}
      maxZoom={basemap.maxZoom}
      maxNativeZoom={basemap.maxZoom}
      tileSize={basemap.tileSize || 256}
      attribution={basemap.attribution || ""}
      keepBuffer={keepBuffer}
      updateWhenIdle
      updateWhenZooming={false}
    />
  );
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

const SiteTwinDebugToggleRow = ({ checked, disabled = false, label, onChange, detail }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: "10px",
      alignItems: "center",
    }}
  >
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: "0.78rem",
          fontWeight: 600,
          lineHeight: 1.25,
          color: "var(--text-main)",
        }}
      >
        {label}
      </Typography>
      {detail ? (
        <Typography
          sx={{
            marginTop: "2px",
            fontSize: "0.68rem",
            lineHeight: 1.35,
            color: "rgba(24, 45, 40, 0.64)",
          }}
        >
          {detail}
        </Typography>
      ) : null}
    </Box>
    <Switch checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} size="small" />
  </Box>
);

const SiteTwinDebugSlider = ({ label, detail, value, min, max, step, onChange, formatValue }) => (
  <Box sx={{ display: "grid", gap: "6px" }}>
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "10px",
        alignItems: "start",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "0.78rem",
            fontWeight: 600,
            lineHeight: 1.25,
            color: "var(--text-main)",
          }}
        >
          {label}
        </Typography>
        {detail ? (
          <Typography
            sx={{
              marginTop: "2px",
              fontSize: "0.68rem",
              lineHeight: 1.35,
              color: "rgba(24, 45, 40, 0.64)",
            }}
          >
            {detail}
          </Typography>
        ) : null}
      </Box>
      <Typography
        sx={{
          fontSize: "0.72rem",
          fontWeight: 700,
          lineHeight: 1.4,
          color: "rgba(24, 45, 40, 0.72)",
        }}
      >
        {formatValue(value)}
      </Typography>
    </Box>
    <Slider
      size="small"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(_event, nextValue) => onChange(Array.isArray(nextValue) ? nextValue[0] : nextValue)}
      sx={{
        color: "var(--text-main)",
        py: 0,
        "& .MuiSlider-thumb": {
          width: 12,
          height: 12,
        },
      }}
    />
  </Box>
);

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

export function MapController({ mapRef }) {
  const leafletMap = useMap();

  useEffect(() => {
    const runtime = createLeafletMapRuntime(leafletMap);
    mapRef.current = runtime;

    return () => {
      if (mapRef.current === runtime) {
        mapRef.current = null;
      }
    };
  }, [leafletMap, mapRef]);

  return null;
}

export function PmtilesExperimentLegend({ glyphPalette = {} }) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...mapControlShellSx,
        width: 228,
        maxWidth: "calc(100vw - 24px)",
        padding: "12px 14px",
        pointerEvents: "none",
        borderRadius: "18px",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "rgba(24, 45, 40, 0.72)",
        }}
      >
        Grave Detail Preview
      </Typography>
      <Typography
        sx={{
          marginTop: "4px",
          fontSize: "0.88rem",
          fontWeight: 600,
          color: "var(--text-main)",
        }}
      >
        Placement Detail
      </Typography>
      <Box sx={{ display: "grid", gap: "10px", marginTop: "10px" }}>
        {Object.entries(glyphPalette).map(([variant, definition]) => (
          <Box
            key={variant}
            sx={{
              display: "grid",
              gridTemplateColumns: "18px minmax(0, 1fr)",
              columnGap: "10px",
              alignItems: "start",
            }}
          >
            <Box sx={{ position: "relative", width: 18, height: 18, marginTop: "2px" }}>
              <Box
                sx={{
                  position: "absolute",
                  left: 1,
                  top: 8,
                  width: 8,
                  height: 1,
                  backgroundColor: definition.guide,
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  right: 1,
                  top: 3,
                  width: 12,
                  height: 12,
                  borderRadius: variant === "approximate" ? "999px" : "2px",
                  border: `1.2px solid ${definition.stroke}`,
                  backgroundColor: definition.fill,
                  transform: variant === "indexed" ? "rotate(45deg)" : "none",
                }}
              />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  lineHeight: 1.25,
                  color: "var(--text-main)",
                }}
              >
                {definition.label}
              </Typography>
              <Typography
                sx={{
                  marginTop: "2px",
                  fontSize: "0.7rem",
                  lineHeight: 1.35,
                  color: "rgba(24, 45, 40, 0.72)",
                }}
              >
                {definition.detail}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Typography
        sx={{
          marginTop: "10px",
          fontSize: "0.68rem",
          lineHeight: 1.4,
          color: "rgba(24, 45, 40, 0.64)",
        }}
      >
        Small offsets separate stacked records without claiming an exact grave footprint.
      </Typography>
    </Paper>
  );
}

export function SiteTwinDebugControl({
  isOverlayEnabled,
  mapEngine,
  manifest,
  loadedSummary = {},
  filteredSummary = {},
  debugState = {},
  onToggleOverlay,
  onUpdateDebugState,
  onResetDebugState,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const totalCount = loadedSummary?.count || manifest?.graveCandidates?.count || 0;
  const knownHeadstoneCount = loadedSummary?.knownHeadstoneCount || manifest?.graveCandidates?.knownHeadstoneCount || 0;
  const filteredCount = Number(filteredSummary?.count) || 0;
  const filteredHeightP95Meters = Number(filteredSummary?.heightP95Meters) || 0;
  const filteredMeanConfidence = Number(filteredSummary?.meanConfidence) || 0;
  const renderMode = manifest?.mode || manifest?.status || "unbuilt";

  return (
    <ClickAwayListener onClickAway={() => setIsOpen(false)}>
      <Paper
        elevation={0}
        sx={{
          ...mapControlShellSx,
          width: isOpen ? "min(300px, calc(100vw - 24px))" : MAP_CONTROL_BUTTON_SIZE,
          maxWidth: "calc(100vw - 24px)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: isOpen
              ? `${MAP_CONTROL_BUTTON_SIZE}px minmax(0, 1fr)`
              : `${MAP_CONTROL_BUTTON_SIZE}px`,
            alignItems: "center",
          }}
        >
          <IconButton
            onClick={() => setIsOpen((current) => !current)}
            size="small"
            title={isOpen ? "Close ground model controls" : "Open ground model controls"}
            aria-label={isOpen ? "Close ground model controls" : "Open ground model controls"}
            aria-expanded={isOpen}
            sx={mapControlButtonSx}
          >
            <TuneIcon fontSize="small" />
          </IconButton>
          {isOpen && (
            <Typography
              sx={{
                paddingRight: "14px",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "rgba(24, 45, 40, 0.72)",
              }}
            >
              Ground Model
            </Typography>
          )}
        </Box>

        {isOpen && (
          <Box
            sx={{
              display: "grid",
              gap: "12px",
              padding: "10px 12px 12px",
              borderTop: "1px solid rgba(18, 47, 40, 0.12)",
            }}
          >
            <Box sx={{ display: "grid", gap: "2px" }}>
              <Typography
                sx={{
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "var(--text-main)",
                }}
              >
                {renderMode === "terrain-only" ? "Relief preview" : "Ground preview"}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  lineHeight: 1.45,
                  color: "rgba(24, 45, 40, 0.64)",
                }}
              >
                {manifest?.sourceVintageNote || "Ground model is not ready yet."}
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "8px",
              }}
            >
              <Box sx={{ padding: "8px 10px", borderRadius: "14px", backgroundColor: "rgba(24, 45, 40, 0.06)" }}>
                <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(24, 45, 40, 0.64)" }}>
                  Candidates
                </Typography>
                <Typography sx={{ marginTop: "2px", fontSize: "0.92rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {filteredCount.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: "0.68rem", color: "rgba(24, 45, 40, 0.64)" }}>
                  of {totalCount.toLocaleString()} loaded
                </Typography>
              </Box>
              <Box sx={{ padding: "8px 10px", borderRadius: "14px", backgroundColor: "rgba(24, 45, 40, 0.06)" }}>
                <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(24, 45, 40, 0.64)" }}>
                  Headstones
                </Typography>
                <Typography sx={{ marginTop: "2px", fontSize: "0.92rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {knownHeadstoneCount.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: "0.68rem", color: "rgba(24, 45, 40, 0.64)" }}>
                  height guide {filteredHeightP95Meters.toFixed(2)} m
                </Typography>
              </Box>
            </Box>

            <SiteTwinDebugToggleRow
              checked={isOverlayEnabled}
              label="Ground model"
              detail="Turns the relief layer and monument markers on or off."
              onChange={onToggleOverlay}
            />
            <SiteTwinDebugToggleRow
              checked={debugState.showSurface}
              label="Relief layer"
              detail="Shows the ground imagery layer."
              onChange={(checked) => onUpdateDebugState({ showSurface: checked })}
            />
            <SiteTwinDebugToggleRow
              checked={debugState.showMonuments}
              label="Monument markers"
              detail={mapEngine === "custom"
                ? "Shows possible monument locations with height cues."
                : "Switch to preview map mode to inspect monument height cues."}
              onChange={(checked) => onUpdateDebugState({ showMonuments: checked })}
            />
            <SiteTwinDebugToggleRow
              checked={debugState.knownHeadstonesOnly}
              label="Known headstones only"
              detail="Shows only records anchored to surveyed headstone points."
              onChange={(checked) => onUpdateDebugState({ knownHeadstonesOnly: checked })}
            />

            <Divider sx={{ borderColor: "rgba(18, 47, 40, 0.12)" }} />

            <SiteTwinDebugSlider
              label="Relief opacity"
              detail="Adjusts how strongly the relief layer appears."
              value={debugState.surfaceOpacity}
              min={0.1}
              max={1}
              step={0.01}
              onChange={(value) => onUpdateDebugState({ surfaceOpacity: value })}
              formatValue={(value) => `${Math.round(value * 100)}%`}
            />
            <SiteTwinDebugSlider
              label="Monument height"
              detail="Adjusts how strongly height cues appear."
              value={debugState.monumentHeightScale}
              min={0.5}
              max={3}
              step={0.05}
              onChange={(value) => onUpdateDebugState({ monumentHeightScale: value })}
              formatValue={(value) => `${value.toFixed(2)}x`}
            />
            <SiteTwinDebugSlider
              label="Match quality"
              detail="Shows only candidates above this quality level."
              value={debugState.minConfidence}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => onUpdateDebugState({ minConfidence: value })}
              formatValue={(value) => `${Math.round(value * 100)}%`}
            />
            <SiteTwinDebugSlider
              label="Minimum height"
              detail="Hides shorter height cues."
              value={debugState.minHeightMeters}
              min={0}
              max={2}
              step={0.02}
              onChange={(value) => onUpdateDebugState({ minHeightMeters: value })}
              formatValue={(value) => `${value.toFixed(2)} m`}
            />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  lineHeight: 1.45,
                  color: "rgba(24, 45, 40, 0.64)",
                }}
              >
                Average quality {filteredMeanConfidence.toFixed(2)}
              </Typography>
              <Box
                component="button"
                type="button"
                onClick={onResetDebugState}
                sx={{
                  border: "1px solid rgba(18, 47, 40, 0.12)",
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  color: "var(--text-main)",
                  borderRadius: "999px",
                  padding: "4px 10px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Reset
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
    </ClickAwayListener>
  );
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
    <MapHomeButton onClick={() => fitMapBounds(map, defaultViewBounds)} />
  );
}

export function MobileLocateButton({ isMobile, onLocate }) {
  if (!isMobile) {
    return null;
  }

  return (
    <Paper elevation={0} sx={mapControlShellSx}>
      <IconButton
        onClick={() => {
          void onLocate?.();
        }}
        size="small"
        title="Use my location"
        aria-label="Use my location"
        sx={mapControlButtonSx}
      >
        <MyLocationIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

export function RouteStatusOverlay({ isCalculating, routingError }) {
  if (!isCalculating && !routingError) {
    return null;
  }

  const isError = Boolean(routingError);

  return (
    <Paper
      elevation={0}
      sx={{
        position: "absolute",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1200,
        px: 1.6,
        py: 1.1,
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
      <Typography variant="body2" sx={{ color: "inherit", fontWeight: 600 }}>
        {isError ? routingError : "Calculating route..."}
      </Typography>
    </Paper>
  );
}
