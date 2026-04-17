import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import PinDropIcon from "@mui/icons-material/PinDrop";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DirectionsIcon from "@mui/icons-material/Directions";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { BottomSheet } from "react-spring-bottom-sheet";
import "react-spring-bottom-sheet/dist/style.css";
import { APP_PROFILE } from "./config/appProfile";
import {
  buildLocationParts,
  buildLocationSummary,
  formatBrowseResultName,
  getBrowseSourceMode,
  MIN_BROWSE_QUERY_LENGTH,
} from "./features/browse";
import { buildPopupViewModel, cleanRecordValue } from "./features/map";
import { useBurialSidebarBrowseState } from "./hooks/useBurialSidebarBrowseState";
import {
  MOBILE_SHEET_STATES,
  useBurialSidebarMobileSheetState,
} from "./hooks/useBurialSidebarMobileSheetState";
import { getRuntimeEnv } from "./shared/runtime";

const rowShellStyles = {
  cursor: "pointer",
  transition: "background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease",
  borderRadius: 2.5,
  p: 1.35,
  contentVisibility: "auto",
  containIntrinsicSize: "88px",
  position: "relative",
  overflow: "hidden",
  isolation: "isolate",
};

const panelSurfaceStyles = {
  position: "relative",
  overflow: "hidden",
  isolation: "isolate",
  border: "1px solid rgba(255, 255, 255, 0.68)",
  background: "rgba(248, 251, 252, 0.82)",
  boxShadow: "0 14px 28px rgba(20, 33, 43, 0.08), var(--glass-shadow-inset)",
  borderRadius: "24px",
};

const TOUR_LABEL = APP_PROFILE.features?.tours?.label || "Tour";

const BROWSE_SOURCE_OPTIONS = [
  { key: "all", label: "All" },
  { key: "section", label: "Section" },
  { key: "tour", label: TOUR_LABEL },
];

const DEFAULT_LOCATION_STATUS = APP_PROFILE.map.locationMessages?.inactive || "Location inactive";
const LOCATION_ACTIVE_STATUS = APP_PROFILE.map.locationMessages?.active || "Location active";
const LOCATION_LOCATING_STATUS = APP_PROFILE.map.locationMessages?.locating || "Locating...";
const EMPTY_PACKET_RECORDS = [];
const EMPTY_ACTIONS = [];
const SELECTION_PANEL_TITLE = "Selection";

const isActivationKey = (event) => event.key === "Enter" || event.key === " ";

const handleInteractiveRowKeyDown = (event, onActivate) => {
  if (!isActivationKey(event)) {
    return;
  }

  event.preventDefault();
  onActivate();
};

const formatLocationNoticeLabel = (status) => {
  if (status === LOCATION_ACTIVE_STATUS) {
    return "Using your current location for directions.";
  }

  if (status === LOCATION_LOCATING_STATUS) {
    return "Finding your location…";
  }

  return status;
};

const getLocationNoticeTone = (status) => {
  if (status === LOCATION_ACTIVE_STATUS) return "success";
  if (status === LOCATION_LOCATING_STATUS) return "neutral";
  return "warning";
};

const getSearchShellNoticeStyles = (tone) => {
  if (tone === "success") {
    return {
      backgroundColor: "rgba(47, 107, 87, 0.1)",
      border: "1px solid rgba(47, 107, 87, 0.18)",
      color: "var(--accent)",
      dotColor: "var(--accent)",
    };
  }

  if (tone === "warning") {
    return {
      backgroundColor: "rgba(154, 108, 25, 0.12)",
      border: "1px solid rgba(154, 108, 25, 0.18)",
      color: "#7a5613",
      dotColor: "#9a6c19",
    };
  }

  return {
    backgroundColor: "rgba(20, 33, 43, 0.05)",
    border: "1px solid rgba(20, 33, 43, 0.08)",
    color: "var(--muted-text)",
    dotColor: "rgba(103, 115, 129, 0.6)",
  };
};

const getSearchPlaceholder = ({
  browseSource,
  isBurialDataLoading,
  sectionFilter,
  selectedTour,
}) => {
  if (isBurialDataLoading) {
    return "Loading burials…";
  }

  if (browseSource === "section") {
    return sectionFilter ? "Search this section" : "Select a section to browse";
  }

  if (browseSource === "tour") {
    return selectedTour ? "Search this tour" : "Select a tour to browse";
  }

  return "Search by name, section, or lot";
};

const getBrowseEmptyState = ({
  browseSource,
  isBurialDataLoading,
  query,
  sectionFilter,
  selectedTour,
  isCurrentTourLoading,
}) => {
  if (isBurialDataLoading && browseSource !== "tour") {
    return "Loading burials…";
  }

  if (isCurrentTourLoading) {
    return "Loading tour stops…";
  }

  if (browseSource === "section" && !sectionFilter) {
    return "Select a section to browse.";
  }

  if (browseSource === "tour" && !selectedTour) {
    return "Select a tour to browse.";
  }

  if (browseSource === "all" && query.trim().length < MIN_BROWSE_QUERY_LENGTH) {
    return "Search by name or keyword.";
  }

  if (browseSource === "section") {
    return `No results in Section ${sectionFilter}${query.trim() ? ` for "${query.trim()}"` : ""}.`;
  }

  if (browseSource === "tour") {
    return `No results in ${selectedTour}${query.trim() ? ` for "${query.trim()}"` : ""}.`;
  }

  return `No results for "${query.trim()}".`;
};

const buildLifeDatesSummary = (record = {}) => (
  [record.Birth && `Born ${record.Birth}`, record.Death && `Died ${record.Death}`]
    .filter(Boolean)
    .join(" • ")
);

function BrowseResultsPanel({
  activeBurialId,
  batchSize,
  browseResults,
  browseSource,
  emptyStateActions = EMPTY_ACTIONS,
  hoveredBurialId,
  isBurialDataLoading,
  isExpanded,
  isMobile,
  isBrowsePending,
  isCurrentTourLoading,
  onBrowseResultSelect,
  onHoverBurialChange,
  onToggleExpanded,
  query,
  sectionFilter,
  selectedBurials,
  selectedTour,
  scopeChips = EMPTY_PACKET_RECORDS,
  tourStyles,
}) {
  const emptyMessage = getBrowseEmptyState({
    browseSource,
    isBurialDataLoading,
    query,
    sectionFilter,
    selectedTour,
    isCurrentTourLoading,
  });
  const selectedBurialIds = useMemo(
    () => new Set(selectedBurials.map((item) => item.id)),
    [selectedBurials]
  );
  const [visibleCount, setVisibleCount] = useState(batchSize);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [batchSize, browseResults.length, browseSource, query, sectionFilter, selectedTour]);

  const visibleResults = useMemo(
    () => browseResults.slice(0, visibleCount),
    [browseResults, visibleCount]
  );
  const hasMoreResults = browseResults.length > visibleCount;
  const canShowFewerResults = visibleCount > batchSize;
  const resultSummary = browseResults.length
    ? `${browseResults.length.toLocaleString()} result${browseResults.length === 1 ? "" : "s"}`
    : isExpanded ? "" : emptyMessage;
  const scopedSectionLabel = browseSource === "section" && sectionFilter
    ? `Section ${sectionFilter}`
    : "";
  const scopedTourLabel = browseSource === "tour" ? selectedTour : "";
  const shouldRenderEmptyState = isExpanded && browseResults.length === 0;
  const shouldShowSummary = Boolean(resultSummary);
  const hasScopeChips = scopeChips.length > 0;

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--browse left-sidebar__panel--surface"
      sx={{
        ...panelSurfaceStyles,
        p: isMobile ? 1.75 : 2,
        pb: isMobile ? 2.25 : 2,
      }}
    >
      <Box
        className="left-sidebar__results-header"
        sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}
      >
        <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
          Results
        </Typography>
        <Box
          className="left-sidebar__results-toolbar"
          sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}
        >
          {isBrowsePending && <CircularProgress size={14} />}
          {browseResults.length > 0 && (
            <Button
              className={[
                "left-sidebar__results-toggle",
                isExpanded ? "left-sidebar__results-toggle--active" : "",
              ].filter(Boolean).join(" ")}
              size="small"
              color="inherit"
              variant="text"
              onClick={onToggleExpanded}
            >
              {isExpanded ? "Collapse" : "View list"}
            </Button>
          )}
        </Box>
      </Box>
      {shouldShowSummary && (
        <Typography
          className="left-sidebar__results-summary"
          variant="body2"
          sx={{
            color: "var(--muted-text)",
            mb: hasScopeChips || shouldRenderEmptyState || (isExpanded && browseResults.length > 0) ? 1.25 : 0,
          }}
        >
          {resultSummary}
        </Typography>
      )}

      {hasScopeChips && (
        <Box
          className="left-sidebar__chip-row left-sidebar__browse-chip-row"
          sx={{ mb: shouldRenderEmptyState || (isExpanded && browseResults.length > 0) ? 1.25 : 0 }}
        >
          {scopeChips.map((chip) => (
            <Chip
              key={chip.key}
              size="small"
              label={chip.label}
              variant={chip.variant || "outlined"}
              sx={chip.sx}
            />
          ))}
        </Box>
      )}

      {shouldRenderEmptyState && (
        <Box
          className="left-sidebar__results-empty"
          sx={{
            borderRadius: 3,
            border: "1px dashed rgba(20, 33, 43, 0.12)",
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(245, 248, 250, 0.56))",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.72)",
            p: isMobile ? 1.35 : 1.5,
          }}
        >
          <Typography variant="body2" sx={{ color: "var(--muted-text)" }}>
            {emptyMessage}
          </Typography>
          {emptyStateActions.length > 0 && (
            <Box className="left-sidebar__results-empty-actions">
              {emptyStateActions.map((action) => (
                <Button
                  key={action.key}
                  size="small"
                  color="inherit"
                  variant={action.variant || "text"}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          )}
        </Box>
      )}

      {isExpanded && browseResults.length > 0 && (
        <>
          <Box className="left-sidebar__results-scroll">
            <List disablePadding onMouseLeave={() => onHoverBurialChange?.(null)}>
              {visibleResults.map((result) => {
                const isPinned = selectedBurialIds.has(result.id);
                const isActive = activeBurialId === result.id;
                const isHovered = hoveredBurialId === result.id;
                const tourStyle = tourStyles[result.tourKey];
                const lifeSummary = buildLifeDatesSummary(result);
                const locationSummary = buildLocationParts(result)
                  .filter((part) => !(scopedSectionLabel && part === scopedSectionLabel))
                  .join(", ");
                const shouldShowSectionChip = Boolean(result.Section)
                  && `Section ${result.Section}` !== scopedSectionLabel;
                const resultTourLabel = result.tourName || tourStyle?.name || "";
                const shouldShowTourChip = Boolean(tourStyle)
                  && !(scopedTourLabel && resultTourLabel === scopedTourLabel);

                return (
                  <ListItem key={result.id} disablePadding sx={{ display: "block", pb: 1 }}>
                    <Box
                      className={[
                        "left-sidebar__result-card",
                        isActive ? "left-sidebar__result-card--active" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => onBrowseResultSelect(result)}
                      onFocus={() => onHoverBurialChange?.(result.id)}
                      onMouseEnter={() => onHoverBurialChange?.(result.id)}
                      onBlur={() => onHoverBurialChange?.(null)}
                      onKeyDown={(event) => handleInteractiveRowKeyDown(event, () => onBrowseResultSelect(result))}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isActive}
                      sx={{
                        ...rowShellStyles,
                        border: isActive
                          ? "1px solid rgba(255, 255, 255, 0.82)"
                          : "1px solid rgba(255, 255, 255, 0.58)",
                        background: isActive
                          ? "var(--surface-card-active)"
                          : isHovered
                            ? "var(--surface-card-hover)"
                            : "var(--surface-card)",
                        boxShadow: isActive ? "var(--shadow-row-active)" : "var(--shadow-row)",
                        "&:hover": {
                          background: isActive ? "var(--surface-card-active-hover)" : "var(--surface-card-hover)",
                          boxShadow: isActive ? "var(--shadow-row-active-hover)" : "var(--shadow-row-hover)",
                        },
                        "&::after": (isActive || isHovered) ? {
                          content: "\"\"",
                          position: "absolute",
                          inset: "10px auto 10px 10px",
                          width: "3px",
                          borderRadius: "999px",
                          background: isActive
                            ? "var(--accent-rail)"
                            : "linear-gradient(180deg, rgba(24, 33, 43, 0.34), rgba(24, 33, 43, 0.12))",
                          boxShadow: isActive ? "var(--accent-rail-shadow)" : "none",
                          pointerEvents: "none",
                        } : undefined,
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ position: "relative", zIndex: 1, lineHeight: 1.25 }}>
                        {formatBrowseResultName(result)}
                      </Typography>
                      {locationSummary && (
                        <Typography variant="body2" color="text.secondary" sx={{ position: "relative", zIndex: 1, mt: 0.5 }}>
                          {locationSummary}
                        </Typography>
                      )}
                      {!locationSummary && result.secondaryText && (
                        <Typography variant="body2" color="text.secondary" sx={{ position: "relative", zIndex: 1, mt: 0.5 }}>
                          {result.secondaryText}
                        </Typography>
                      )}
                      {lifeSummary && (
                        <Typography variant="body2" color="text.secondary" sx={{ position: "relative", zIndex: 1, mt: 0.35 }}>
                          {lifeSummary}
                        </Typography>
                      )}
                      <Box sx={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                        {isActive && <Chip size="small" color="primary" label="Active" />}
                        {isPinned && !isActive && (
                          <Chip
                            size="small"
                            label="Pinned"
                            sx={{
                              backgroundColor: "var(--accent-soft)",
                              color: "var(--accent-strong)",
                            }}
                          />
                        )}
                        {shouldShowSectionChip && (
                          <Chip size="small" variant="outlined" label={`Section ${result.Section}`} />
                        )}
                        {result.Lot && (
                          <Chip size="small" variant="outlined" label={`Lot ${result.Lot}`} />
                        )}
                        {result.Tier && (
                          <Chip size="small" variant="outlined" label={`Tier ${result.Tier}`} />
                        )}
                        {shouldShowTourChip && (
                          <Chip
                            size="small"
                            label={result.tourName || tourStyle.name}
                            sx={{
                              color: "white",
                              backgroundColor: tourStyle.color,
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </ListItem>
                );
              })}
            </List>
          </Box>
          {(hasMoreResults || canShowFewerResults) && (
            <Box
              className="left-sidebar__results-pagination"
              sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mt: 1.25, flexWrap: "wrap" }}
            >
              <Typography variant="caption" sx={{ color: "var(--muted-text)", textAlign: "center" }}>
                Showing {visibleResults.length} of {browseResults.length}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
                {canShowFewerResults && (
                  <Button
                    className="left-sidebar__results-pagination-button"
                    size="small"
                    color="inherit"
                    onClick={() => setVisibleCount(batchSize)}
                  >
                    Show fewer
                  </Button>
                )}
                {hasMoreResults && (
                  <Button
                    className="left-sidebar__results-pagination-button"
                    size="small"
                    variant="contained"
                    onClick={() => setVisibleCount((count) => Math.min(browseResults.length, count + batchSize))}
                  >
                    Show more
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

function SelectedPeopleList({
  activeBurialId,
  activeRouteBurialId,
  hoveredBurialId,
  isMobile,
  markerColors,
  onFocusSelectedBurial,
  onHoverBurialChange,
  onOpenDirectionsMenu,
  onRemoveSelectedBurial,
  selectedBurialOrderById,
  selectedBurialRefs,
  selectedBurials,
  tourStyles,
}) {
  return (
    <List
      disablePadding
      className="left-sidebar__selected-list"
      onMouseLeave={() => onHoverBurialChange(null)}
    >
      {selectedBurials.map((burial, index) => {
        const markerIndex = selectedBurialOrderById?.get(burial.id) ?? index;
        const isActive = activeBurialId === burial.id;
        const isRouteActive = activeRouteBurialId === burial.id;
        const isHovered = hoveredBurialId === burial.id;
        const tourStyle = tourStyles[burial.tourKey];

        return (
          <ListItem key={burial.id} disablePadding sx={{ display: "block", pb: 1.5 }}>
            <Box
              className={[
                "left-sidebar__selected-row",
                isActive ? "left-sidebar__selected-row--active" : "",
                isRouteActive ? "left-sidebar__selected-row--route-active" : "",
              ].filter(Boolean).join(" ")}
              ref={(node) => {
                if (node) {
                  selectedBurialRefs.current.set(burial.id, node);
                } else {
                  selectedBurialRefs.current.delete(burial.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onFocus={() => onHoverBurialChange(burial.id)}
              onBlur={() => onHoverBurialChange(null)}
              onMouseEnter={() => onHoverBurialChange(burial.id)}
              onKeyDown={(event) => handleInteractiveRowKeyDown(event, () => onFocusSelectedBurial(burial))}
              onClick={() => onFocusSelectedBurial(burial)}
              sx={{
                ...rowShellStyles,
                border: isActive
                  ? "1px solid rgba(255, 255, 255, 0.82)"
                  : "1px solid rgba(255, 255, 255, 0.6)",
                background: isActive
                  ? "var(--surface-card-active)"
                  : isHovered
                    ? "var(--surface-card-hover)"
                    : "var(--surface-card)",
                boxShadow: isActive
                  ? "var(--shadow-row-active)"
                  : isHovered
                    ? "var(--shadow-row-hover)"
                    : "var(--shadow-row)",
                "&:hover": {
                  background: isActive ? "var(--surface-card-active-hover)" : "var(--surface-card-hover)",
                  boxShadow: isActive ? "var(--shadow-row-active-hover)" : "var(--shadow-row-hover)",
                },
                "&::after": (isActive || isRouteActive) ? {
                  content: "\"\"",
                  position: "absolute",
                  inset: "10px auto 10px 10px",
                  width: "3px",
                  borderRadius: "999px",
                  background: isRouteActive
                    ? "linear-gradient(180deg, rgba(39, 110, 207, 0.92), rgba(97, 153, 229, 0.54))"
                    : "var(--accent-rail)",
                  boxShadow: isRouteActive
                    ? "0 0 12px rgba(39, 110, 207, 0.22)"
                    : "var(--accent-rail-shadow)",
                  pointerEvents: "none",
                } : undefined,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box
                  sx={{
                    width: isActive || isHovered ? "32px" : "24px",
                    height: isActive || isHovered ? "32px" : "24px",
                    borderRadius: "50%",
                    backgroundColor: markerColors[markerIndex % markerColors.length],
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: isActive || isHovered ? "16px" : "14px",
                    border: isActive || isHovered ? "3px solid white" : "2px solid white",
                    boxShadow: isActive || isHovered
                      ? "0 0 8px rgba(0,0,0,0.6)"
                      : "0 0 4px rgba(0,0,0,0.4)",
                    transition: "width 0.2s ease, height 0.2s ease, font-size 0.2s ease, border-width 0.2s ease, box-shadow 0.2s ease",
                  }}
                >
                  {markerIndex + 1}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ lineHeight: 1.2 }}>
                    {formatBrowseResultName(burial)}
                  </Typography>
                  {buildLocationSummary(burial) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {buildLocationSummary(burial)}
                    </Typography>
                  )}
                  {([burial.Birth && `Born ${burial.Birth}`, burial.Death && `Died ${burial.Death}`].filter(Boolean).length > 0) && (
                    <Typography variant="body2" color="text.secondary">
                      {[burial.Birth && `Born ${burial.Birth}`, burial.Death && `Died ${burial.Death}`]
                        .filter(Boolean)
                        .join(" • ")}
                    </Typography>
                  )}
                  {(isActive || isRouteActive) && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
                      {isActive && <Chip size="small" color="primary" label="Active" />}
                      {isRouteActive && (
                        <Chip
                          size="small"
                          label="Route active"
                          sx={{
                            backgroundColor: "var(--accent-soft)",
                            color: "var(--accent-strong)",
                          }}
                        />
                      )}
                    </Box>
                  )}
                  {tourStyle && (
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 1,
                        color: "white",
                        backgroundColor: tourStyle.color,
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        display: "inline-block",
                      }}
                    >
                      {burial.tourName || tourStyle.name}
                    </Typography>
                  )}
                </Box>
                <IconButton
                  className="left-sidebar__selected-row-dismiss"
                  aria-label={`Remove ${formatBrowseResultName(burial)}`}
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveSelectedBurial(burial.id);
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box
                className={isMobile
                  ? "selected-person-actions selected-person-actions--mobile"
                  : "selected-person-actions"}
                sx={{
                  display: isMobile ? "grid" : "flex",
                  gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
                  flexWrap: isMobile ? undefined : "wrap",
                  gap: 1,
                  mt: 1.25,
                }}
              >
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<DirectionsIcon />}
                  sx={isMobile ? { minWidth: 0 } : undefined}
                  onClick={(event) => onOpenDirectionsMenu(event, burial)}
                >
                  Directions
                </Button>
                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  startIcon={<CloseIcon />}
                  sx={isMobile
                    ? {
                      gridColumn: "1 / -1",
                      minWidth: 0,
                      justifyContent: "center",
                    }
                    : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveSelectedBurial(burial.id);
                  }}
                >
                  Remove
                </Button>
              </Box>
            </Box>
          </ListItem>
        );
      })}
    </List>
  );
}

function SelectionLeadCard({
  burial,
  burialIndex,
  isRouteActive,
  isHovered,
  isMobile,
  markerColor,
  onFocusSelectedBurial,
  onHoverBurialChange,
  onOpenDirectionsMenu,
  onRemoveSelectedBurial,
  tourStyle,
}) {
  return (
    <Box
      className="left-sidebar__selected-row left-sidebar__selected-row--lead"
      role="button"
      tabIndex={0}
      aria-pressed="true"
      onClick={() => onFocusSelectedBurial(burial)}
      onFocus={() => onHoverBurialChange?.(burial.id)}
      onBlur={() => onHoverBurialChange?.(null)}
      onMouseEnter={() => onHoverBurialChange?.(burial.id)}
      onMouseLeave={() => onHoverBurialChange?.(null)}
      onKeyDown={(event) => handleInteractiveRowKeyDown(event, () => onFocusSelectedBurial(burial))}
      sx={{
        ...rowShellStyles,
        mt: 1.25,
        border: "1px solid rgba(255, 255, 255, 0.82)",
        background: isHovered ? "var(--surface-card-active-hover)" : "var(--surface-card-active)",
        boxShadow: isHovered ? "var(--shadow-row-active-hover)" : "var(--shadow-row-active)",
        "&::after": {
          content: "\"\"",
          position: "absolute",
          inset: "10px auto 10px 10px",
          width: "3px",
          borderRadius: "999px",
          background: isRouteActive
            ? "linear-gradient(180deg, rgba(39, 110, 207, 0.92), rgba(97, 153, 229, 0.54))"
            : "var(--accent-rail)",
          boxShadow: isRouteActive
            ? "0 0 12px rgba(39, 110, 207, 0.22)"
            : "var(--accent-rail-shadow)",
          pointerEvents: "none",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: markerColor,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "16px",
            border: "3px solid white",
            boxShadow: "0 0 8px rgba(0,0,0,0.45)",
            flexShrink: 0,
          }}
        >
          {burialIndex + 1}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, justifyContent: "space-between" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ lineHeight: 1.2 }}>
                {formatBrowseResultName(burial)}
              </Typography>
              {buildLocationSummary(burial) && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                  {buildLocationSummary(burial)}
                </Typography>
              )}
              {([burial.Birth && `Born ${burial.Birth}`, burial.Death && `Died ${burial.Death}`].filter(Boolean).length > 0) && (
                <Typography variant="body2" color="text.secondary">
                  {[burial.Birth && `Born ${burial.Birth}`, burial.Death && `Died ${burial.Death}`]
                    .filter(Boolean)
                    .join(" • ")}
                </Typography>
              )}
            </Box>
            <IconButton
              className="left-sidebar__selected-row-dismiss"
              aria-label={`Remove ${formatBrowseResultName(burial)}`}
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveSelectedBurial(burial.id);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
            <Chip size="small" color="primary" label="Active" />
            {isRouteActive && (
              <Chip
                size="small"
                label="Route active"
                sx={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent-strong)",
                }}
              />
            )}
            {tourStyle && (
              <Chip
                size="small"
                label={burial.tourName || tourStyle.name}
                sx={{
                  backgroundColor: tourStyle.color,
                  color: "white",
                }}
              />
            )}
          </Box>
        </Box>
      </Box>
      <Box
        className={isMobile
          ? "selected-person-actions selected-person-actions--mobile"
          : "selected-person-actions"}
        sx={{
          display: isMobile ? "grid" : "flex",
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
          flexWrap: isMobile ? undefined : "wrap",
          gap: 1,
          mt: 1.25,
        }}
      >
        <Button
          size="small"
          variant="contained"
          startIcon={<DirectionsIcon />}
          sx={isMobile ? { minWidth: 0 } : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onOpenDirectionsMenu(event, burial);
          }}
        >
          Directions
        </Button>
        <Button
          size="small"
          variant="text"
          color="inherit"
          startIcon={<CloseIcon />}
          sx={isMobile
            ? {
              gridColumn: "1 / -1",
              minWidth: 0,
              justifyContent: "center",
            }
            : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onRemoveSelectedBurial(burial.id);
          }}
        >
          Remove
        </Button>
      </Box>
    </Box>
  );
}

function SelectedPlaceCard({
  burial,
  burialIndex,
  isRouteActive,
  markerColor,
  onOpenExternalDirections,
  onRemoveSelectedBurial,
  onStartRouting,
  onStopRouting,
  tourStyle,
}) {
  const popupView = useMemo(() => buildPopupViewModel(burial), [burial]);
  const popupKey = burial?.id || popupView.heading;
  const [mediaUrl, setMediaUrl] = useState(() => popupView.imageUrl || "");

  useEffect(() => {
    setMediaUrl(popupView.imageUrl || "");
  }, [popupKey, popupView.imageUrl]);

  const handleImageError = useCallback(() => {
    setMediaUrl((currentUrl) => {
      const fallbackUrl = cleanRecordValue(popupView.imageFallbackUrl);
      if (fallbackUrl && currentUrl !== fallbackUrl) {
        return fallbackUrl;
      }

      return "";
    });
  }, [popupView.imageFallbackUrl]);

  return (
    <Box
      sx={{
        mt: 1.5,
        borderRadius: 2,
        border: "1px solid var(--panel-border)",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        overflow: "hidden",
      }}
    >
      <Box className="popup-card left-sidebar__selected-place-card">
        {popupView.sourceLabel && (
          <Box component="p" className="popup-card__eyebrow">
            {popupView.sourceLabel}
          </Box>
        )}
        <Box component="h3" className="popup-card__title">
          {popupView.heading}
        </Box>
        {popupView.subtitle && (
          <Box component="p" className="popup-card__subtitle">
            {popupView.subtitle}
          </Box>
        )}
        {popupView.paragraphs?.length > 0 && (
          <Box className="popup-card__body">
            {popupView.paragraphs.map((paragraph, index) => (
              <Box
                key={`${popupKey}-paragraph-${index}`}
                component="p"
                className="popup-card__paragraph"
              >
                {paragraph}
              </Box>
            ))}
          </Box>
        )}
        <Box className="left-sidebar__selected-place-card-meta">
          <Chip
            size="small"
            variant="outlined"
            label={`Marker ${burialIndex + 1}`}
            sx={{
              borderColor: markerColor,
              color: "var(--text-main)",
            }}
          />
          {isRouteActive && (
            <Chip
              size="small"
              label="Route active"
              sx={{
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent-strong)",
              }}
            />
          )}
          {tourStyle && (
            <Chip
              size="small"
              label={burial.tourName || tourStyle.name}
              sx={{
                backgroundColor: tourStyle.color,
                color: "white",
              }}
            />
          )}
        </Box>
        {popupView.rows.length > 0 && (
          <Box component="dl" className="popup-card__details">
            {popupView.rows.map(({ label, value }) => (
              <Box key={`${popupKey}-${label}`} className="popup-card__row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </Box>
            ))}
          </Box>
        )}
        {mediaUrl && (
          <Box className="popup-card__media">
            {popupView.imageHint && (
              <Box component="p" className="popup-card__hint">
                {popupView.imageHint}
              </Box>
            )}
            {popupView.imageLinkUrl ? (
              <a
                className="popup-card__image-link"
                href={popupView.imageLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  className="popup-card__image"
                  src={mediaUrl}
                  alt={popupView.imageAlt}
                  loading="lazy"
                  onError={handleImageError}
                />
              </a>
            ) : (
              <img
                className="popup-card__image"
                src={mediaUrl}
                alt={popupView.imageAlt}
                loading="lazy"
                onError={handleImageError}
              />
            )}
          </Box>
        )}
        <Box className="popup-card__actions left-sidebar__selected-place-card-actions">
          <button
            type="button"
            className="popup-card__action popup-card__action--primary"
            onClick={() => {
              if (isRouteActive) {
                onStopRouting?.();
                return;
              }

              onStartRouting?.(burial);
            }}
          >
            {isRouteActive ? "Stop route" : "Route on map"}
          </button>
          <button
            type="button"
            className="popup-card__action popup-card__action--secondary"
            onClick={() => onOpenExternalDirections?.(burial)}
          >
            Open in Maps
          </button>
          <button
            type="button"
            className="popup-card__action popup-card__action--ghost"
            onClick={() => onRemoveSelectedBurial(burial.id)}
          >
            Remove
          </button>
        </Box>
      </Box>
    </Box>
  );
}

function SelectedSummaryPanel({
  activeBurialId,
  activeRouteBurialId,
  hoveredBurialId,
  isExpanded,
  isMobile,
  markerColors,
  onClearSelectedBurials,
  onFocusSelectedBurial,
  onHoverBurialChange,
  onOpenExternalDirections,
  onOpenDirectionsMenu,
  onRemoveSelectedBurial,
  onStartRouting,
  onStopRouting,
  onToggleExpanded,
  selectedBurialRefs,
  selectedBurials,
  tourStyles,
}) {
  if (selectedBurials.length === 0) return null;

  const leadBurial = selectedBurials.find((burial) => burial.id === activeBurialId) || selectedBurials[0];
  const leadBurialIndex = selectedBurials.findIndex((burial) => burial.id === leadBurial.id);
  const hasMultipleSelectedBurials = selectedBurials.length > 1;
  const secondarySelectedBurials = selectedBurials.filter((burial) => burial.id !== leadBurial.id);
  const isRouteActive = activeRouteBurialId === leadBurial.id;
  const leadTourStyle = tourStyles[leadBurial.tourKey];
  const selectedBurialOrderById = new Map(selectedBurials.map((burial, index) => [burial.id, index]));

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--selected-summary left-sidebar__panel--surface"
      sx={{ ...panelSurfaceStyles, p: 2 }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2">{SELECTION_PANEL_TITLE}</Typography>
          <Typography variant="body2" sx={{ color: "var(--muted-text)", mt: 0.5 }}>
            {selectedBurials.length === 1
              ? "Pinned for map focus & directions"
              : `${selectedBurials.length} people pinned for map focus & directions`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
          <Chip size="small" color="primary" label={selectedBurials.length} />
          {hasMultipleSelectedBurials && (
            <Button
              size="small"
              variant={isExpanded ? "outlined" : "contained"}
              onClick={onToggleExpanded}
              endIcon={(
                <ArrowDropDownIcon
                  sx={{
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              )}
            >
              {isExpanded ? "Hide list" : "Show list"}
            </Button>
          )}
          <Button size="small" color="inherit" onClick={onClearSelectedBurials}>
            Clear
          </Button>
        </Box>
      </Box>

      {isMobile ? (
        <SelectedPlaceCard
          burial={leadBurial}
          burialIndex={leadBurialIndex}
          isRouteActive={isRouteActive}
          markerColor={markerColors[leadBurialIndex % markerColors.length]}
          onOpenExternalDirections={onOpenExternalDirections}
          onRemoveSelectedBurial={onRemoveSelectedBurial}
          onStartRouting={onStartRouting}
          onStopRouting={onStopRouting}
          tourStyle={leadTourStyle}
        />
      ) : (
        <SelectionLeadCard
          burial={leadBurial}
          burialIndex={leadBurialIndex}
          isHovered={hoveredBurialId === leadBurial.id}
          isMobile={isMobile}
          isRouteActive={isRouteActive}
          markerColor={markerColors[leadBurialIndex % markerColors.length]}
          onFocusSelectedBurial={onFocusSelectedBurial}
          onHoverBurialChange={onHoverBurialChange}
          onOpenDirectionsMenu={onOpenDirectionsMenu}
          onRemoveSelectedBurial={onRemoveSelectedBurial}
          tourStyle={leadTourStyle}
        />
      )}

      {secondarySelectedBurials.length > 0 && isExpanded && (
        <Box className="left-sidebar__selected-scroll left-sidebar__selected-scroll--summary" sx={{ mt: 1.5 }}>
          <Divider sx={{ mb: 1.5 }} />
          <SelectedPeopleList
            activeBurialId={activeBurialId}
            activeRouteBurialId={activeRouteBurialId}
            hoveredBurialId={hoveredBurialId}
            isMobile={isMobile}
            markerColors={markerColors}
            onFocusSelectedBurial={onFocusSelectedBurial}
            onHoverBurialChange={onHoverBurialChange}
            onOpenDirectionsMenu={onOpenDirectionsMenu}
            onRemoveSelectedBurial={onRemoveSelectedBurial}
            selectedBurialOrderById={selectedBurialOrderById}
            selectedBurialRefs={selectedBurialRefs}
            selectedBurials={secondarySelectedBurials}
            tourStyles={tourStyles}
          />
        </Box>
      )}
    </Box>
  );
}

function FieldPacketPanel({
  fieldPacket,
  fieldPacketNotice,
  onClearFieldPacket,
  onCopyFieldPacketLink,
  onCreateFieldPacket,
  onShareFieldPacket,
  onUpdateFieldPacket,
  selectedBurials,
}) {
  const packetRecords = fieldPacket?.selectedRecords || EMPTY_PACKET_RECORDS;
  const hasPacket = packetRecords.length > 0;
  const hasSelectedBurials = selectedBurials.length > 0;
  const currentSelectionIds = useMemo(
    () => selectedBurials.map((record) => record.id).sort().join("|"),
    [selectedBurials]
  );
  const packetSelectionIds = useMemo(
    () => packetRecords.map((record) => record.id).sort().join("|"),
    [packetRecords]
  );
  const hasSelectionDrift = hasPacket && currentSelectionIds !== packetSelectionIds;
  const canUseNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const noticeColor = fieldPacketNotice?.tone === "success"
    ? "var(--accent)"
    : fieldPacketNotice?.tone === "warning"
      ? "#9a6c19"
      : "var(--muted-text)";

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--field-packet left-sidebar__panel--surface"
      sx={{ ...panelSurfaceStyles, p: 2 }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.25, mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">Field Packet</Typography>
          <Typography variant="body2" sx={{ color: "var(--muted-text)", mt: 0.45 }}>
            Capture a shareable set of pinned records, notes, and map context.
          </Typography>
        </Box>
        <Chip
          size="small"
          label={hasPacket ? `${packetRecords.length} record${packetRecords.length === 1 ? "" : "s"}` : "Dev"}
          sx={hasPacket ? undefined : { color: "#9a6c19", backgroundColor: "rgba(154, 108, 25, 0.12)" }}
        />
      </Box>

      {hasPacket ? (
        <>
          <TextField
            fullWidth
            size="small"
            label="Packet name"
            value={fieldPacket?.name || ""}
            onChange={(event) => onUpdateFieldPacket({ name: event.target.value })}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            label="Field note"
            value={fieldPacket?.note || ""}
            onChange={(event) => onUpdateFieldPacket({ note: event.target.value })}
          />
          <Box className="left-sidebar__chip-row" sx={{ mt: 1.25 }}>
            {fieldPacket?.sectionFilter && (
              <Chip size="small" variant="outlined" label={`Section ${fieldPacket.sectionFilter}`} />
            )}
            {fieldPacket?.selectedTour && (
              <Chip size="small" variant="outlined" label={fieldPacket.selectedTour} />
            )}
            {fieldPacket?.mapBounds && (
              <Chip size="small" variant="outlined" label="Map context saved" />
            )}
          </Box>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 1,
              color: hasSelectionDrift ? "#9a6c19" : "var(--muted-text)",
            }}
          >
            {hasSelectionDrift
              ? "Current selection differs from this packet. Refresh to capture the latest records."
              : "Packet matches the current selection."}
          </Typography>
        </>
      ) : (
        <Typography variant="body2" sx={{ color: "var(--muted-text)" }}>
          {hasSelectedBurials
            ? `${selectedBurials.length} selected record${selectedBurials.length === 1 ? "" : "s"} ready to capture.`
            : "Select one or more records to create a packet."}
        </Typography>
      )}

      {fieldPacketNotice?.message && (
        <Typography variant="caption" sx={{ display: "block", mt: 1.1, color: noticeColor, fontWeight: 600 }}>
          {fieldPacketNotice.message}
        </Typography>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.4 }}>
        <Button
          size="small"
          variant="contained"
          onClick={onCreateFieldPacket}
          disabled={!hasSelectedBurials}
        >
          {hasPacket ? "Refresh packet" : "Create packet"}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={onCopyFieldPacketLink}
          disabled={!hasPacket && !hasSelectedBurials}
        >
          Copy link
        </Button>
        {canUseNativeShare && (
          <Button
            size="small"
            variant="outlined"
            onClick={onShareFieldPacket}
            disabled={!hasPacket && !hasSelectedBurials}
          >
            Share packet
          </Button>
        )}
        {hasPacket && (
          <Button size="small" color="inherit" onClick={onClearFieldPacket}>
            Clear packet
          </Button>
        )}
      </Box>
    </Box>
  );
}

function BurialSidebar({
  activeBurialId,
  activeRouteBurialId,
  burialDataError,
  burialRecords,
  fieldPacket,
  fieldPacketNotice,
  filterType,
  getTourName,
  hoveredBurialId,
  initialQuery,
  isFieldPacketsEnabled,
  isBurialDataLoading,
  isInstalled,
  isMobile,
  isOnline,
  isSearchIndexReady,
  loadingTourName,
  lotTierFilter,
  markerColors,
  rootRef,
  onBrowseResultSelect,
  onClearSectionFilters,
  onClearSelectedBurials,
  onFilterTypeChange,
  onFocusSelectedBurial,
  onHoverBurialChange,
  onOpenExternalDirections,
  onLocateMarker,
  onLotTierFilterChange,
  onClearFieldPacket,
  onCopyFieldPacketLink,
  onCreateFieldPacket,
  onOpenAppMenu,
  onOpenDirectionsMenu,
  onRemoveSelectedBurial,
  onRequestBurialDataLoad,
  onSectionChange,
  onShareFieldPacket,
  onStartRouting,
  onStopRouting,
  onToggleSectionMarkers,
  onTourChange,
  onUpdateFieldPacket,
  searchIndex,
  sectionIndex,
  sectionFilter,
  selectedBurialRefs,
  selectedBurials,
  selectedTour,
  showAllBurials,
  showIosInstallHint,
  status,
  tourDefinitions,
  tourLayerError,
  tourResults,
  tourStyles,
  uniqueSections,
}) {
  const {
    isDev,
    featureFlags,
  } = getRuntimeEnv();
  const areFieldPacketsEnabled = typeof isFieldPacketsEnabled === "boolean"
    ? isFieldPacketsEnabled
    : featureFlags.fieldPackets;
  const hasTourBrowse = tourDefinitions.length > 0;
  const initialBrowseSource = useMemo(
    () => {
      const explicitBrowseSource = getBrowseSourceMode({ sectionFilter, selectedTour });

      if (explicitBrowseSource !== "all") {
        return explicitBrowseSource;
      }

      if ((initialQuery || "").trim()) {
        return "all";
      }

      return isMobile ? "section" : "all";
    },
    [initialQuery, isMobile, sectionFilter, selectedTour]
  );
  const {
    browseQuery,
    browseResults,
    browseSource,
    hasActiveBrowseContext,
    isBrowsePending,
    resultLimit,
    setBrowseQuery,
    setBrowseSource,
  } = useBurialSidebarBrowseState({
    initialBrowseSource,
    initialQuery,
    burialRecords,
    sectionIndex,
    searchIndex,
    getTourName,
    sectionFilter,
    lotTierFilter,
    filterType,
    selectedTour,
    tourResults,
  });
  const {
    collapseMobileSheet,
    expandMobileSheet,
    handleSheetSpringEnd,
    isResultsExpanded,
    isSelectedSummaryExpanded,
    maximizeMobileSheet,
    mobileDefaultSnap,
    mobileSnapPoints,
    resolvedMobileSheetState,
    setIsResultsExpanded,
    setIsSelectedSummaryExpanded,
    sheetRef,
    toggleResultsExpanded,
    toggleSelectedSummary,
  } = useBurialSidebarMobileSheetState({
    hasActiveBrowseContext,
    initialBrowseSource,
    initialQuery,
    isMobile,
    selectedBurialsLength: selectedBurials.length,
  });
  const visibleBrowseSourceOptions = useMemo(
    () => BROWSE_SOURCE_OPTIONS.filter((option) => option.key !== "tour" || hasTourBrowse),
    [hasTourBrowse]
  );
  const activeBrowseSourceIndex = useMemo(() => {
    const activeIndex = visibleBrowseSourceOptions.findIndex((option) => option.key === browseSource);
    return activeIndex >= 0 ? activeIndex : 0;
  }, [browseSource, visibleBrowseSourceOptions]);
  const hasGlobalResetState = Boolean(browseQuery.trim() || selectedBurials.length > 0);
  const hasSectionFilters = Boolean(sectionFilter || lotTierFilter);
  const hasTourSelection = Boolean(selectedTour);
  const isCurrentTourLoading = Boolean(
    selectedTour && loadingTourName === selectedTour && tourResults.length === 0
  );
  const sidebarBodyRef = useRef(null);
  const previousActiveBurialIdRef = useRef(activeBurialId);
  const previousSectionFilterRef = useRef(sectionFilter);
  const previousSelectedTourRef = useRef(selectedTour);
  const previousSelectionSignatureRef = useRef(
    selectedBurials.map((record) => record.id).sort().join("|")
  );

  const setSidebarRootNode = useCallback((node) => {
    sidebarBodyRef.current = node;

    if (!rootRef) {
      return;
    }

    if (typeof rootRef === "function") {
      rootRef(node);
      return;
    }

    rootRef.current = node;
  }, [rootRef]);

  const scrollMobileSheetToTop = useCallback((behavior = "smooth") => {
    if (!isMobile) {
      return;
    }

    const scrollContainer = sidebarBodyRef.current?.closest?.("[data-rsbs-scroll]");
    if (!scrollContainer) {
      return;
    }

    if (typeof scrollContainer.scrollTo === "function") {
      scrollContainer.scrollTo({ top: 0, behavior });
      return;
    }

    scrollContainer.scrollTop = 0;
  }, [isMobile]);

  useEffect(() => {
    if (!hoveredBurialId) return;

    const hoveredBurialStillSelected = selectedBurials.some((burial) => burial.id === hoveredBurialId);
    if (!hoveredBurialStillSelected) {
      onHoverBurialChange(null);
    }
  }, [hoveredBurialId, onHoverBurialChange, selectedBurials]);

  useEffect(() => {
    const currentSelectionSignature = selectedBurials.map((record) => record.id).sort().join("|");
    const previousActiveBurialId = previousActiveBurialIdRef.current;
    const previousSectionFilter = previousSectionFilterRef.current;
    const previousSelectedTour = previousSelectedTourRef.current;
    const previousSelectionSignature = previousSelectionSignatureRef.current;

    previousActiveBurialIdRef.current = activeBurialId;
    previousSectionFilterRef.current = sectionFilter;
    previousSelectedTourRef.current = selectedTour;
    previousSelectionSignatureRef.current = currentSelectionSignature;

    if (!isMobile) {
      return;
    }

    const didSelectionChange = Boolean(currentSelectionSignature)
      && currentSelectionSignature !== previousSelectionSignature;
    const didActiveBurialChange = Boolean(activeBurialId)
      && activeBurialId !== previousActiveBurialId;
    const didSectionChange = Boolean(sectionFilter)
      && sectionFilter !== previousSectionFilter;
    const didTourChange = Boolean(selectedTour)
      && selectedTour !== previousSelectedTour;
    const shouldRevealSelectedRecord = selectedBurials.length > 0
      && (didSelectionChange || didActiveBurialChange);
    const shouldRevealBrowseContext = selectedBurials.length === 0
      && (didSectionChange || didTourChange);

    if (!shouldRevealSelectedRecord && !shouldRevealBrowseContext) {
      return;
    }

    if (
      shouldRevealSelectedRecord
      && resolvedMobileSheetState === MOBILE_SHEET_STATES.COLLAPSED
    ) {
      expandMobileSheet();
    }

    if (
      shouldRevealBrowseContext
      && resolvedMobileSheetState !== MOBILE_SHEET_STATES.FULL
    ) {
      maximizeMobileSheet();
    }

    scrollMobileSheetToTop();
  }, [
    activeBurialId,
    expandMobileSheet,
    isMobile,
    maximizeMobileSheet,
    resolvedMobileSheetState,
    scrollMobileSheetToTop,
    sectionFilter,
    selectedBurials,
    selectedTour,
  ]);

  const handleBrowseQueryChange = useCallback((event) => {
    onRequestBurialDataLoad?.();
    setBrowseQuery(event.target.value);
    setIsResultsExpanded(true);
  }, [onRequestBurialDataLoad, setBrowseQuery, setIsResultsExpanded]);

  const handleClearBrowseQuery = useCallback(() => {
    setBrowseQuery("");
  }, [setBrowseQuery]);

  const handleBrowseResultSelect = useCallback((result) => {
    onBrowseResultSelect(result);
    if (isMobile) {
      if (selectedBurials.length === 0) {
        setIsSelectedSummaryExpanded(true);
      }
    }
  }, [isMobile, onBrowseResultSelect, selectedBurials.length, setIsSelectedSummaryExpanded]);

  const handleSectionSelection = useCallback((nextSection) => {
    onRequestBurialDataLoad?.();
    setBrowseSource("section");
    setIsResultsExpanded(true);
    onSectionChange(nextSection || "");
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onRequestBurialDataLoad, onSectionChange, setBrowseSource, setIsResultsExpanded]);

  const handleToggleSectionMarkers = useCallback(() => {
    onRequestBurialDataLoad?.();
    onToggleSectionMarkers();
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onRequestBurialDataLoad, onToggleSectionMarkers]);

  const handleFilterTypeSelection = useCallback((nextFilterType) => {
    setIsResultsExpanded(true);
    onFilterTypeChange(nextFilterType);
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onFilterTypeChange, setIsResultsExpanded]);

  const handleLotTierChange = useCallback((nextValue) => {
    setIsResultsExpanded(true);
    onLotTierFilterChange(nextValue);
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onLotTierFilterChange, setIsResultsExpanded]);

  const handleClearSectionFilters = useCallback(() => {
    setBrowseSource("section");
    setIsResultsExpanded(true);
    onClearSectionFilters();
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onClearSectionFilters, setBrowseSource, setIsResultsExpanded]);

  const handleTourSelection = useCallback((tourName) => {
    if (!hasTourBrowse) return;

    setBrowseSource("tour");
    setIsResultsExpanded(true);
    onTourChange(tourName);
    maximizeMobileSheet();
  }, [hasTourBrowse, maximizeMobileSheet, onTourChange, setBrowseSource, setIsResultsExpanded]);

  const handleClearTourSelection = useCallback(() => {
    setBrowseSource("tour");
    setIsResultsExpanded(true);
    onTourChange(null);
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onTourChange, setBrowseSource, setIsResultsExpanded]);

  const handleBrowseSourceChange = useCallback((nextSource) => {
    onRequestBurialDataLoad?.();
    if (!nextSource || nextSource === browseSource) {
      expandMobileSheet();
      return;
    }

    if (nextSource === "tour" && !hasTourBrowse) {
      expandMobileSheet();
      return;
    }

    setBrowseSource(nextSource);
    setIsResultsExpanded(true);

    if (nextSource === "all") {
      if (sectionFilter || lotTierFilter) {
        onClearSectionFilters();
      }
      if (selectedTour) {
        onTourChange(null);
      }
      expandMobileSheet();
      return;
    }

    if (nextSource === "section") {
      if (selectedTour) {
        onTourChange(null);
      }
      maximizeMobileSheet();
      return;
    }

    if (sectionFilter || lotTierFilter) {
      onClearSectionFilters();
    }

    maximizeMobileSheet();
  }, [
    browseSource,
    expandMobileSheet,
    hasTourBrowse,
    maximizeMobileSheet,
    lotTierFilter,
    onClearSectionFilters,
    onRequestBurialDataLoad,
    onTourChange,
    sectionFilter,
    selectedTour,
    setBrowseSource,
    setIsResultsExpanded,
  ]);

  useEffect(() => {
    if (!hasTourBrowse && browseSource === "tour") {
      setBrowseSource("all");
    }
  }, [browseSource, hasTourBrowse, setBrowseSource]);

  const handleLocateUser = useCallback(() => {
    onLocateMarker();
  }, [onLocateMarker]);

  const handleClearAllBrowseState = useCallback(() => {
    setBrowseQuery("");
    setBrowseSource("all");
    setIsResultsExpanded(true);
    setIsSelectedSummaryExpanded(false);

    if (sectionFilter) {
      onClearSectionFilters();
    } else if (lotTierFilter) {
      onLotTierFilterChange("");
    }

    if (selectedTour) {
      onTourChange(null);
    }

    onClearSelectedBurials();
    collapseMobileSheet();
  }, [
    collapseMobileSheet,
    lotTierFilter,
    onClearSectionFilters,
    onClearSelectedBurials,
    onLotTierFilterChange,
    onTourChange,
    sectionFilter,
    selectedTour,
    setBrowseQuery,
    setBrowseSource,
    setIsResultsExpanded,
    setIsSelectedSummaryExpanded,
  ]);

  const sidebarClassName = isMobile
    ? "left-sidebar left-sidebar--mobile"
    : [
        "left-sidebar",
        "left-sidebar--desktop",
      ].join(" ");
  const autocompleteListboxProps = isMobile
    ? {
      sx: {
        maxHeight: "min(40svh, 320px)",
        py: 0.75,
      },
    }
    : {
      sx: {
        maxHeight: 240,
      },
    };
  const autocompleteComponentsProps = useMemo(
    () => ({
      popper: {
        className: "left-sidebar__autocomplete-popper",
        placement: isMobile ? "auto-start" : "bottom-start",
      },
      paper: {
        elevation: 8,
        className: "left-sidebar__autocomplete-paper",
      },
    }),
    [isMobile]
  );
  const selectedSectionOption = useMemo(
    () => uniqueSections.find((option) => `${option}` === `${sectionFilter}`) ?? null,
    [sectionFilter, uniqueSections]
  );
  const searchPlaceholder = getSearchPlaceholder({
    browseSource,
    isBurialDataLoading,
    sectionFilter,
    selectedTour,
  });
  const hasMinimumBrowseQuery = browseQuery.trim().length >= MIN_BROWSE_QUERY_LENGTH;
  const locationNotice = useMemo(() => {
    const nextStatus = (status || "").trim();

    if (!nextStatus || nextStatus === DEFAULT_LOCATION_STATUS) {
      return null;
    }

    return {
      key: "location",
      tone: getLocationNoticeTone(nextStatus),
      label: formatLocationNoticeLabel(nextStatus),
    };
  }, [status]);
  const runtimeNotice = useMemo(() => {
    if (!isOnline) {
      return {
        key: "offline",
        tone: "warning",
        label: "Offline. Search stays available, but live links may be limited.",
      };
    }

    if (isBurialDataLoading) {
      return {
        key: "records-loading",
        tone: "neutral",
        label: "Loading burials…",
      };
    }

    if (burialRecords.length === 0) {
      return null;
    }

    if (!isSearchIndexReady) {
      return {
        key: "search-readying",
        tone: "neutral",
        label: "Preparing fast search…",
      };
    }

    if (loadingTourName) {
      return {
        key: "tour-loading",
        tone: "neutral",
        label: `Loading ${loadingTourName}…`,
      };
    }

    return null;
  }, [burialRecords.length, isBurialDataLoading, isOnline, isSearchIndexReady, loadingTourName]);
  const searchShellNotices = useMemo(() => {
    const nextNotices = [locationNotice, runtimeNotice];

    if (!isInstalled && showIosInstallHint) {
      nextNotices.push({
        key: "install",
        tone: "neutral",
        label: "Safari: Share → Add to Home Screen",
      });
    }

    return nextNotices.filter(Boolean).slice(0, 2);
  }, [isInstalled, locationNotice, runtimeNotice, showIosInstallHint]);
  const browseScopeChips = useMemo(() => {
    const accentChipSx = {
      backgroundColor: "var(--accent-soft)",
      color: "var(--accent-strong)",
      borderColor: "rgba(47, 107, 87, 0.12)",
    };

    if (browseSource === "section") {
      if (!sectionFilter) {
        return EMPTY_PACKET_RECORDS;
      }

      const nextChips = [
        { key: "scope", label: `Section ${sectionFilter}`, sx: accentChipSx },
      ];

      if (lotTierFilter) {
        nextChips.push({
          key: "detail",
          label: `${filterType === "tier" ? "Tier" : "Lot"} ${lotTierFilter}`,
        });
      }

      if (showAllBurials) {
        nextChips.push({ key: "markers", label: "Markers visible" });
      }

      return nextChips;
    }

    if (browseSource === "tour") {
      if (!selectedTour) {
        return EMPTY_PACKET_RECORDS;
      }

      return [
        { key: "scope", label: selectedTour, sx: accentChipSx },
      ];
    }

    if (hasMinimumBrowseQuery && browseQuery.trim()) {
      return [
        { key: "scope", label: "Search", sx: accentChipSx },
      ];
    }

    return EMPTY_PACKET_RECORDS;
  }, [
    browseSource,
    browseQuery,
    filterType,
    hasMinimumBrowseQuery,
    lotTierFilter,
    sectionFilter,
    selectedTour,
    showAllBurials,
  ]);
  const browseEmptyActions = useMemo(() => {
    if (browseResults.length > 0 || isCurrentTourLoading) {
      return EMPTY_ACTIONS;
    }

    if (browseSource === "all") {
      if (!hasMinimumBrowseQuery) {
        const nextActions = [{
          key: "section",
          label: "Browse sections",
          variant: "contained",
          onClick: () => handleBrowseSourceChange("section"),
        }];

        if (hasTourBrowse) {
          nextActions.push({
            key: "tour",
            label: `Browse ${TOUR_LABEL.toLowerCase()}s`,
            onClick: () => handleBrowseSourceChange("tour"),
          });
        }

        return nextActions;
      }

      return [
        {
          key: "clear-search",
          label: "Clear search",
          variant: "contained",
          onClick: handleClearBrowseQuery,
        },
        {
          key: "section",
          label: "Browse sections",
          onClick: () => handleBrowseSourceChange("section"),
        },
      ];
    }

    if (browseSource === "section") {
      if (!sectionFilter) {
        return EMPTY_ACTIONS;
      }

      const nextActions = [];

      if (hasMinimumBrowseQuery) {
        nextActions.push({
          key: "clear-search",
          label: "Clear search",
          variant: "contained",
          onClick: handleClearBrowseQuery,
        });
      }

      nextActions.push({
        key: "reset-section",
        label: "Choose another section",
        variant: hasMinimumBrowseQuery ? "text" : "contained",
        onClick: handleClearSectionFilters,
      });

      return nextActions;
    }

    if (browseSource === "tour") {
      if (!selectedTour) {
        return EMPTY_ACTIONS;
      }

      const nextActions = [];

      if (hasMinimumBrowseQuery) {
        nextActions.push({
          key: "clear-search",
          label: "Clear search",
          variant: "contained",
          onClick: handleClearBrowseQuery,
        });
      }

      nextActions.push({
        key: "change-tour",
        label: `Choose another ${TOUR_LABEL.toLowerCase()}`,
        variant: hasMinimumBrowseQuery ? "text" : "contained",
        onClick: handleClearTourSelection,
      });

      return nextActions;
    }

    return EMPTY_ACTIONS;
  }, [
    browseResults.length,
    browseSource,
    handleBrowseSourceChange,
    handleClearBrowseQuery,
    handleClearSectionFilters,
    handleClearTourSelection,
    hasMinimumBrowseQuery,
    hasTourBrowse,
    isCurrentTourLoading,
    sectionFilter,
    selectedTour,
  ]);
  const desktopMoreButton = !isMobile ? (
    <Button
      variant="text"
      size="small"
      color="inherit"
      onClick={onOpenAppMenu}
      startIcon={<MoreHorizIcon />}
    >
      More
    </Button>
  ) : null;
  const mobileMoreButton = isMobile ? (
    <IconButton
      size="small"
      color="inherit"
      onClick={onOpenAppMenu}
      aria-label="More options"
      sx={{
        color: "var(--muted-text)",
        border: "1px solid rgba(20, 33, 43, 0.08)",
        backgroundColor: "rgba(255, 255, 255, 0.76)",
      }}
    >
      <MoreHorizIcon fontSize="small" />
    </IconButton>
  ) : null;

  const browseToolsContent = (
    <Box
      className="left-sidebar__browse-composer left-sidebar__panel--surface"
      sx={{
        ...panelSurfaceStyles,
        mt: 1,
        p: isMobile ? 1.5 : 1.75,
        display: "grid",
        gap: 1.1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">Browse</Typography>
          <Typography variant="body2" sx={{ color: "var(--muted-text)", mt: 0.5 }}>
            Search the cemetery or start with a section.
          </Typography>
        </Box>
      </Box>

      <TextField
        fullWidth
        placeholder={searchPlaceholder}
        variant="outlined"
        size="small"
        value={browseQuery}
        disabled={isBurialDataLoading || !!burialDataError}
        onFocus={() => onRequestBurialDataLoad?.()}
        onChange={handleBrowseQueryChange}
        autoComplete="off"
        inputProps={{
          "aria-label": "Search burials",
          autoCapitalize: "off",
          autoCorrect: "off",
          enterKeyHint: "search",
          name: "browse_query",
          spellCheck: false,
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: (
            <>
              {(isBurialDataLoading || isBrowsePending) ? <CircularProgress size={16} /> : null}
              {browseQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClearBrowseQuery}
                    aria-label="Clear search query"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )}
            </>
          ),
        }}
      />

      <Box
        className="left-sidebar__browse-toolbar"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box
          aria-label="Browse source"
          className="left-sidebar__browse-segmented"
          role="group"
          sx={{ flex: isMobile ? "1 1 100%" : "0 1 auto" }}
          style={{
            "--segment-count": visibleBrowseSourceOptions.length,
            "--segment-index": activeBrowseSourceIndex,
          }}
        >
          <Box className="left-sidebar__browse-segmented-indicator" aria-hidden="true" />
          {visibleBrowseSourceOptions.map((option) => {
            const isActive = browseSource === option.key;

            return (
              <Button
                key={option.key}
                color="inherit"
                variant="text"
                aria-pressed={isActive}
                className={[
                  "left-sidebar__browse-segmented-button",
                  isActive ? "left-sidebar__browse-segmented-button--active" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => handleBrowseSourceChange(option.key)}
              >
                {option.label}
              </Button>
            );
          })}
        </Box>
        {!isMobile && (
          <Box className="left-sidebar__browse-actions" sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            <Button
              onClick={handleLocateUser}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<PinDropIcon />}
            >
              My location
            </Button>
            {hasGlobalResetState && (
              <Button
                onClick={handleClearAllBrowseState}
                variant="text"
                color="inherit"
                size="small"
                startIcon={<CloseIcon />}
                aria-label="Clear all browse filters"
              >
                Reset all
              </Button>
            )}
            {desktopMoreButton}
          </Box>
        )}
      </Box>

      <Box className="left-sidebar__browse-controls" sx={{ display: "grid", gap: 1.2 }}>
        {browseSource === "section" && (
          <Box
            className="left-sidebar__browse-detail left-sidebar__browse-detail--section"
            sx={{
              p: isMobile ? 1.2 : 1.3,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 1,
                mb: 1,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" className="left-sidebar__browse-detail-title">
                  Section
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, color: "var(--muted-text)" }}>
                  Start with one section, then refine inside it.
                </Typography>
              </Box>
              {hasSectionFilters && (
                <Button
                  size="small"
                  color="inherit"
                  variant="text"
                  className="left-sidebar__browse-detail-clear"
                  onClick={handleClearSectionFilters}
                >
                  Clear
                </Button>
              )}
            </Box>
            <Autocomplete
              ListboxProps={autocompleteListboxProps}
              componentsProps={autocompleteComponentsProps}
              options={uniqueSections}
              value={selectedSectionOption}
              disabled={isBurialDataLoading || !!burialDataError}
              onChange={(event, newValue) => handleSectionSelection(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Section"
                  size="small"
                  fullWidth
                  autoComplete="off"
                  inputProps={{
                    ...params.inputProps,
                    autoCapitalize: "off",
                    autoCorrect: "off",
                    name: "section_filter",
                    spellCheck: false,
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  Section {option}
                </li>
              )}
              getOptionLabel={(option) => `Section ${option}`}
              isOptionEqualToValue={(option, value) => `${option}` === `${value}`}
            />

            {sectionFilter && (
              <Box sx={{ mt: 1.2 }}>
                <Typography variant="subtitle2" className="left-sidebar__browse-detail-title" gutterBottom>
                  Refine Section {sectionFilter}
                </Typography>
                <Box
                  className="left-sidebar__control-grid"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                    gap: 1,
                    alignItems: "start",
                  }}
                >
                  <Box>
                    <ButtonGroup fullWidth size="small" sx={{ mt: 0.25 }}>
                      <Button
                        variant={filterType === "lot" ? "contained" : "outlined"}
                        onClick={() => handleFilterTypeSelection("lot")}
                      >
                        Lot
                      </Button>
                      <Button
                        variant={filterType === "tier" ? "contained" : "outlined"}
                        onClick={() => handleFilterTypeSelection("tier")}
                      >
                        Tier
                      </Button>
                    </ButtonGroup>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    label={filterType === "lot" ? "Lot Number" : "Tier Number"}
                    value={lotTierFilter}
                    onChange={(event) => handleLotTierChange(event.target.value)}
                    disabled={isBurialDataLoading || !!burialDataError}
                    autoComplete="off"
                    inputProps={{
                      autoCapitalize: "off",
                      autoCorrect: "off",
                      inputMode: "search",
                      name: filterType === "lot" ? "lot_filter" : "tier_filter",
                      spellCheck: false,
                    }}
                  />
                  <Button
                    variant={showAllBurials ? "contained" : "outlined"}
                    color="primary"
                    size="small"
                    onClick={handleToggleSectionMarkers}
                    startIcon={showAllBurials ? <RemoveIcon /> : <AddIcon />}
                  >
                    {showAllBurials ? "Hide section markers" : "Show section markers"}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {browseSource === "tour" && hasTourBrowse && (
          <Box
            className="left-sidebar__browse-detail left-sidebar__browse-detail--tour"
            sx={{
              p: isMobile ? 1.2 : 1.3,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 1,
                mb: 1,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" className="left-sidebar__browse-detail-title">
                  Choose {TOUR_LABEL.toLowerCase()}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, color: "var(--muted-text)" }}>
                  Switch to a single tour context when you want curated stops.
                </Typography>
              </Box>
              {hasTourSelection && (
                <Button
                  size="small"
                  color="inherit"
                  variant="text"
                  className="left-sidebar__browse-detail-clear"
                  onClick={handleClearTourSelection}
                >
                  Clear
                </Button>
              )}
            </Box>
            <Autocomplete
              ListboxProps={autocompleteListboxProps}
              componentsProps={autocompleteComponentsProps}
              options={tourDefinitions}
              value={tourDefinitions.find((definition) => definition.name === selectedTour) || null}
              disabled={isBurialDataLoading || !!burialDataError}
              getOptionLabel={(option) => option.name}
              onChange={(event, newValue) => handleTourSelection(newValue ? newValue.name : null)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={TOUR_LABEL}
                  size="small"
                  fullWidth
                  autoComplete="off"
                  inputProps={{
                    ...params.inputProps,
                    autoCapitalize: "off",
                    autoCorrect: "off",
                    name: "tour_filter",
                    spellCheck: false,
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box
                    component="span"
                    sx={{
                      width: 14,
                      height: 14,
                      mr: 1,
                      borderRadius: "50%",
                      backgroundColor: tourStyles[option.key].color,
                      display: "inline-block",
                    }}
                  />
                  {option.name}
                </li>
              )}
              isOptionEqualToValue={(option, value) => option.name === value.name}
            />
          </Box>
        )}
      </Box>

      <Box
        className="left-sidebar__notice-stack"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          display: "grid",
          gap: 0.75,
          mt: searchShellNotices.length === 0 ? 0 : 1.2,
          maxHeight: searchShellNotices.length === 0 ? 0 : 120,
          opacity: searchShellNotices.length === 0 ? 0 : 1,
          overflow: "hidden",
          transition: "max-height 0.18s ease, opacity 0.16s ease, margin-top 0.18s ease",
        }}
      >
        {searchShellNotices.map((notice) => {
          const styles = getSearchShellNoticeStyles(notice.tone);

          return (
            <Box
              key={notice.key}
              className="left-sidebar__notice"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1,
                py: 0.8,
                borderRadius: 2,
                backgroundColor: styles.backgroundColor,
                border: styles.border,
                color: styles.color,
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: styles.dotColor,
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption" sx={{ color: "inherit", fontSize: "0.75rem", fontWeight: 500 }}>
                {notice.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  const headerContent = (
    <Box className="left-sidebar__header" sx={{ p: !isMobile ? 2 : 1.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
          mb: 1.25,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{ display: "block", letterSpacing: 1.2, color: "var(--muted-text)", lineHeight: 1.1 }}
          >
            Albany Rural Cemetery
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.35 }}>
            <Box
              component="a"
              href="https://www.albany.edu/arce/"
              sx={{ color: "inherit", display: "inline-block", textDecoration: "none" }}
            >
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                Burial Finder
              </Typography>
            </Box>
            {isDev && (
              <Chip
                size="small"
                label="Dev"
                sx={{
                  height: 18,
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  backgroundColor: "rgba(154, 108, 25, 0.15)",
                  color: "#9a6c19",
                  border: "1px solid rgba(154, 108, 25, 0.35)",
                }}
              />
            )}
          </Box>
        </Box>
        {mobileMoreButton}
      </Box>

      {(burialDataError || tourLayerError) && (
        <Box sx={{ display: "grid", gap: 0.75, mt: 1 }}>
          {burialDataError && (
            <Typography variant="body2" color="error">
              {burialDataError}
            </Typography>
          )}
          {tourLayerError && (
            <Typography variant="body2" color="error">
              {tourLayerError}
            </Typography>
          )}
        </Box>
      )}

      {browseToolsContent}
    </Box>
  );

  const bodyContent = (
    <Box sx={{ p: 1.5, display: "grid", gap: 1.5 }}>
      {selectedBurials.length > 0 && (
        <SelectedSummaryPanel
          activeBurialId={activeBurialId}
          activeRouteBurialId={activeRouteBurialId}
          hoveredBurialId={hoveredBurialId}
          isExpanded={isSelectedSummaryExpanded}
          isMobile={isMobile}
          markerColors={markerColors}
          onClearSelectedBurials={onClearSelectedBurials}
          onFocusSelectedBurial={onFocusSelectedBurial}
          onHoverBurialChange={onHoverBurialChange}
          onOpenExternalDirections={onOpenExternalDirections}
          onOpenDirectionsMenu={onOpenDirectionsMenu}
          onRemoveSelectedBurial={onRemoveSelectedBurial}
          onStartRouting={onStartRouting}
          onStopRouting={onStopRouting}
          onToggleExpanded={toggleSelectedSummary}
          selectedBurialRefs={selectedBurialRefs}
          selectedBurials={selectedBurials}
          tourStyles={tourStyles}
        />
      )}

      <BrowseResultsPanel
        activeBurialId={activeBurialId}
        batchSize={resultLimit}
        browseResults={browseResults}
        browseSource={browseSource}
        emptyStateActions={browseEmptyActions}
        hoveredBurialId={hoveredBurialId}
        isBurialDataLoading={isBurialDataLoading}
        isExpanded={isResultsExpanded}
        isBrowsePending={isBrowsePending}
        isCurrentTourLoading={isCurrentTourLoading}
        isMobile={isMobile}
        onBrowseResultSelect={handleBrowseResultSelect}
        onHoverBurialChange={onHoverBurialChange}
        onToggleExpanded={toggleResultsExpanded}
        query={browseQuery}
        sectionFilter={sectionFilter}
        selectedBurials={selectedBurials}
        selectedTour={selectedTour}
        scopeChips={browseScopeChips}
        tourStyles={tourStyles}
      />

      {areFieldPacketsEnabled && (
        <FieldPacketPanel
          fieldPacket={fieldPacket}
          fieldPacketNotice={fieldPacketNotice}
          onClearFieldPacket={onClearFieldPacket}
          onCopyFieldPacketLink={onCopyFieldPacketLink}
          onCreateFieldPacket={onCreateFieldPacket}
          onShareFieldPacket={onShareFieldPacket}
          onUpdateFieldPacket={onUpdateFieldPacket}
          selectedBurials={selectedBurials}
        />
      )}
    </Box>
  );

  // -- Desktop render --
  if (!isMobile) {
    return (
      <Paper ref={setSidebarRootNode} elevation={3} className={sidebarClassName}>
        {headerContent}
        <Divider />
        <Box
          className="left-sidebar__body"
          sx={{ minHeight: 0, overflow: "auto", flex: 1 }}
        >
          {bodyContent}
        </Box>
      </Paper>
    );
  }

  // -- Mobile render: Apple Maps-style BottomSheet --
  const mobileSheetHandle = <div aria-hidden="true" />;

  const mobileSheetBody = (
    <Box
      ref={setSidebarRootNode}
      className="left-sidebar__mobile-body"
      data-mobile-sheet-state={resolvedMobileSheetState}
    >
      <div className="left-sidebar__sheet-header">
        {headerContent}
      </div>
      {bodyContent}
    </Box>
  );

  return (
    <BottomSheet
      ref={sheetRef}
      open
      blocking={false}
      scrollLocking={false}
      skipInitialTransition
      className={[
        "left-sidebar",
        "left-sidebar--mobile",
        `left-sidebar--mobile--${resolvedMobileSheetState}`,
      ].join(" ")}
      snapPoints={mobileSnapPoints}
      defaultSnap={mobileDefaultSnap}
      header={mobileSheetHandle}
      expandOnContentDrag
      onSpringEnd={handleSheetSpringEnd}
    >
      {mobileSheetBody}
    </BottomSheet>
  );
}

export default memo(BurialSidebar);
