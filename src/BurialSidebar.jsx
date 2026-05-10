import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DirectionsIcon from "@mui/icons-material/Directions";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { BottomSheet } from "react-spring-bottom-sheet";
import "react-spring-bottom-sheet/dist/style.css";
import { APP_PROFILE } from "./features/fab/profile";
import BrowseWorkspacePanel from "./features/browse/BrowseWorkspacePanel";
import {
  buildLifeDatesSummary,
  buildBrowseEmptyActionSpecs,
  buildBrowseScopeChips,
  buildSearchShellNotices,
  getBrowseEmptyState,
  getSearchPlaceholder,
} from "./features/browse/sidebarPresentation";
import {
  buildLocationParts,
  buildLocationSummary,
  formatBrowseResultName,
  getBrowseSourceMode,
  MIN_BROWSE_QUERY_LENGTH,
} from "./features/browse/browseResults";
import { buildSharedSelectionPresentation } from "./features/fieldPackets";
import { buildPopupViewModel, cleanRecordValue } from "./features/map/mapRecordPresentation";
import { resolvePortraitImageName } from "./features/tours/tourDerivedData";
import {
  MOBILE_SHEET_STATES,
  useBurialSidebarBrowseState,
  useBurialSidebarMobileSheetState,
} from "./features/browse/sidebarState";
import {
  getRuntimeEnv,
  isFieldPacketsEnabled as resolveFieldPacketsEnabled,
} from "./shared/runtimeEnv";

/**
 * Sidebar shell for search, browse, selected records, directions actions, and
 * mobile drawer behavior. Pure result shaping and mobile-sheet state live in
 * feature/hooks modules so this file can stay focused on composing the UI.
 */
const rowShellStyles = {
  transition: "background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease",
  borderRadius: 3,
  contentVisibility: "auto",
  containIntrinsicSize: "88px",
  position: "relative",
  overflow: "hidden",
  isolation: "isolate",
};

const selectedRowShellStyles = {
  ...rowShellStyles,
  contentVisibility: "visible",
  containIntrinsicSize: "auto",
};

const interactiveCardButtonSx = {
  display: "block",
  width: "100%",
  padding: 1.2,
  borderRadius: "inherit",
  textAlign: "left",
  color: "inherit",
  "&.MuiButtonBase-root": {
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  "&:focus-visible": {
    outline: "2px solid rgba(34, 96, 79, 0.28)",
    outlineOffset: "-2px",
  },
};

const selectionTextWrapSx = {
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const buildSelectionActionLayoutSx = () => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 7.75rem), 1fr))",
  gap: 0.75,
  mt: 1,
  px: 1.2,
  pb: 1.2,
  position: "relative",
  zIndex: 1,
  alignItems: "stretch",
});

const buildSelectionBadgeSx = ({ color, isLead = false }) => ({
  width: isLead ? 24 : 20,
  height: isLead ? 24 : 20,
  borderRadius: "50%",
  backgroundColor: color,
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: isLead ? "12px" : "11px",
  lineHeight: 1,
  border: "2px solid rgba(255, 255, 255, 0.96)",
  boxShadow: isLead
    ? "0 6px 14px rgba(20, 33, 43, 0.18)"
    : "0 4px 10px rgba(20, 33, 43, 0.14)",
  flexShrink: 0,
  mt: 0.2,
});

const panelSurfaceStyles = {
  position: "relative",
  overflow: "hidden",
  isolation: "isolate",
  border: "1px solid rgba(20, 33, 43, 0.06)",
  background: "rgba(255, 255, 255, 0.9)",
  boxShadow: "0 14px 30px rgba(20, 33, 43, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.76)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  borderRadius: "20px",
};

const TOUR_LABEL = APP_PROFILE.features?.tours?.label || "Tour";
const APP_SHELL = APP_PROFILE.shell || {};
const APP_HEADER_EYEBROW = APP_SHELL.headerEyebrow || APP_PROFILE.brand?.appName || "App";
const APP_HEADER_TITLE = APP_SHELL.headerTitle || "Burial Finder";
const APP_HOME_URL = APP_SHELL.homeUrl || "#";

const DEFAULT_LOCATION_STATUS = APP_PROFILE.map.locationMessages?.inactive || "Location inactive";
const LOCATION_ACTIVE_STATUS = APP_PROFILE.map.locationMessages?.active || "Location active";
const LOCATION_LOCATING_STATUS = APP_PROFILE.map.locationMessages?.locating || "Locating...";
const LOCATION_OUT_OF_BOUNDS_STATUS = APP_PROFILE.map.locationMessages?.outOfBounds || "Location outside cemetery range";
const LOCATION_UNAVAILABLE_STATUS = APP_PROFILE.map.locationMessages?.unavailable || "GPS unavailable";
const LOCATION_UNSUPPORTED_STATUS = APP_PROFILE.map.locationMessages?.unsupported || "GPS unsupported";
const LOCATION_APPROXIMATE_STATUS = APP_PROFILE.map.locationMessages?.approximate || "";
const LOCATION_WEAK_SIGNAL_STATUS = APP_PROFILE.map.locationMessages?.weakSignal || "";
const EMPTY_PACKET_RECORDS = [];
const EMPTY_ACTIONS = [];
const SELECTION_PANEL_TITLE = "Selection";

function BrowseResultPortraitThumbnail({ result }) {
  const portraitImageName = cleanRecordValue(resolvePortraitImageName(result));
  const popupView = useMemo(
    () => (portraitImageName ? buildPopupViewModel(result) : null),
    [portraitImageName, result]
  );
  const [mediaUrl, setMediaUrl] = useState(() => popupView?.imageUrl || "");
  const thumbnailKey = result?.id || popupView?.imageAlt || "";

  useEffect(() => {
    setMediaUrl(popupView?.imageUrl || "");
  }, [thumbnailKey, popupView?.imageUrl]);

  const handleImageError = useCallback(() => {
    setMediaUrl("");
  }, []);

  if (!portraitImageName || !mediaUrl) {
    return null;
  }

  return (
    <Box className="left-sidebar__result-thumbnail" aria-hidden="true">
      <img
        className="left-sidebar__result-thumbnail-image"
        src={mediaUrl}
        alt=""
        loading="lazy"
        onError={handleImageError}
      />
    </Box>
  );
}

const hasFieldPacketContent = (fieldPacket) => {
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

/**
 * Result list shared by search, section browse, and tour browse. Map.jsx owns
 * the selected/hovered ids; this panel only renders the current scope and sends
 * explicit focus/hover intent back up.
 */
function BrowseResultsPanel({
  activeBurialId,
  batchSize,
  browseResults,
  browseSource,
  emptyStateActions = EMPTY_ACTIONS,
  hoveredBurialId,
  isBurialDataLoading,
  isBrowsePending,
  isCurrentTourLoading,
  onBrowseResultSelect,
  onClearSelectedBurials,
  onHoverBurialChange,
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
    isCurrentTourLoading,
    minBrowseQueryLength: MIN_BROWSE_QUERY_LENGTH,
    query,
    sectionFilter,
    selectedTour,
    tourLabel: TOUR_LABEL,
  });
  const selectedBurialIds = useMemo(
    () => new Set(selectedBurials.map((item) => item.id)),
    [selectedBurials]
  );
  const selectedBurialCount = selectedBurials.length;
  const browseResultIds = useMemo(
    () => new Set(browseResults.map((result) => result.id)),
    [browseResults]
  );
  const selectedBrowseResults = useMemo(() => {
    const scopedSelections = selectedBurials.filter((burial) => browseResultIds.has(burial.id));
    if (!activeBurialId) return scopedSelections;

    const activeSelection = scopedSelections.find((burial) => burial.id === activeBurialId);
    if (!activeSelection) return scopedSelections;

    return [
      activeSelection,
      ...scopedSelections.filter((burial) => burial.id !== activeBurialId),
    ];
  }, [activeBurialId, browseResultIds, selectedBurials]);
  const isShowingSelectedSubset = selectedBrowseResults.length > 0;
  const displayedResults = isShowingSelectedSubset ? selectedBrowseResults : browseResults;
  const displayedResultCount = displayedResults.length;
  const selectedBrowseResultSignature = selectedBrowseResults.map((result) => result.id).join("|");
  const [visibleCount, setVisibleCount] = useState(batchSize);

  useEffect(() => {
    // Scope changes should reset incremental pagination so newly selected
    // sections/tours start from the top of their result list.
    setVisibleCount(batchSize);
  }, [
    activeBurialId,
    batchSize,
    browseResults.length,
    browseSource,
    query,
    sectionFilter,
    selectedBrowseResultSignature,
    selectedTour,
  ]);

  const visibleResults = useMemo(
    () => displayedResults.slice(0, visibleCount),
    [displayedResults, visibleCount]
  );
  const hasMoreResults = displayedResultCount > visibleCount;
  const canShowFewerResults = visibleCount > batchSize;
  const resultSummary = `${displayedResultCount.toLocaleString()} result${displayedResultCount === 1 ? "" : "s"}`;
  const trimmedQuery = query.trim();
  const scopedSectionLabel = browseSource === "section" && sectionFilter
    ? `Section ${sectionFilter}`
    : "";
  const scopedTourLabel = browseSource === "tour" ? selectedTour : "";
  const shouldRenderEmptyState = displayedResultCount === 0;
  const hasScopeChips = scopeChips.length > 0;
  const isScopedBrowse = browseSource === "section" || browseSource === "tour";
  const resultsEyebrow = isScopedBrowse
    ? ""
    : trimmedQuery
      ? "Search"
      : "Browse";
  const resultsTitle = isShowingSelectedSubset
    ? "Selected records"
    : isScopedBrowse
      ? "Results"
      : trimmedQuery
        ? "Search results"
        : "Burials";

  return (
    <Box
      className="left-sidebar__results-section"
      sx={{
        display: "grid",
        gap: 1.2,
      }}
    >
      <Box
        className="left-sidebar__results-header"
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.25,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {resultsEyebrow && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "var(--muted-text)",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {resultsEyebrow}
            </Typography>
          )}
          <Typography variant="subtitle2" sx={{ mt: resultsEyebrow ? 0.35 : 0, lineHeight: 1.2 }}>
            {resultsTitle}
          </Typography>
        </Box>
        <Box
          className="left-sidebar__results-toolbar"
          sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: "auto", flexWrap: "wrap" }}
        >
          {isBrowsePending && <CircularProgress size={14} />}
          {selectedBurialCount > 0 && (
            <>
              <Chip
                size="small"
                label={`${selectedBurialCount.toLocaleString()} selected`}
                sx={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent-strong)",
                  fontWeight: 700,
                }}
              />
              <Button
                size="small"
                color="inherit"
                variant="text"
                onClick={onClearSelectedBurials}
              >
                Clear selected
              </Button>
            </>
          )}
        </Box>
      </Box>

      {!shouldRenderEmptyState && !isShowingSelectedSubset && (
        <Typography
          className="left-sidebar__results-summary"
          variant="body2"
          sx={{ color: "var(--muted-text)" }}
        >
          {browseSource === "all" && trimmedQuery
            ? `${resultSummary} for "${trimmedQuery}".`
            : resultSummary}
        </Typography>
      )}

      {hasScopeChips && (
        <Box
          className="left-sidebar__chip-row left-sidebar__browse-chip-row"
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
            p: 1.5,
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

      {displayedResultCount > 0 && (
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
                const metadataSummary = [
                  shouldShowSectionChip ? `Section ${result.Section}` : "",
                  result.Lot ? `Lot ${result.Lot}` : "",
                  result.Tier ? `Tier ${result.Tier}` : "",
                ].filter(Boolean).join(" • ");
                const resultTourLabel = result.tourName || tourStyle?.name || "";
                const shouldShowTourChip = Boolean(tourStyle)
                  && !(scopedTourLabel && resultTourLabel === scopedTourLabel);
                const shouldShowInlineThumbnail = browseSource === "tour";

                return (
                  <ListItem key={result.id} disablePadding sx={{ display: "block", pb: 1 }}>
                    <ButtonBase
                      component="button"
                      type="button"
                      focusRipple
                      className={[
                        "left-sidebar__result-card",
                        isActive ? "left-sidebar__result-card--active" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => onBrowseResultSelect(result)}
                      onFocus={() => onHoverBurialChange?.(result.id)}
                      onMouseEnter={() => onHoverBurialChange?.(result.id)}
                      onMouseLeave={() => onHoverBurialChange?.(null)}
                      onBlur={() => onHoverBurialChange?.(null)}
                      aria-pressed={isActive}
                      sx={{
                        ...rowShellStyles,
                        ...interactiveCardButtonSx,
                        border: isActive
                          ? "1px solid rgba(47, 107, 87, 0.22)"
                          : "1px solid rgba(20, 33, 43, 0.08)",
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
                        "&:focus-visible": {
                          outline: "2px solid rgba(47, 107, 87, 0.24)",
                          outlineOffset: "-2px",
                        },
                      }}
                    >
                      <Box
                        className={[
                          "left-sidebar__result-card-layout",
                          shouldShowInlineThumbnail ? "left-sidebar__result-card-layout--with-thumbnail" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <Box className="left-sidebar__result-card-copy">
                          {metadataSummary && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                position: "relative",
                                zIndex: 1,
                                mb: 0.45,
                                color: "var(--muted-text)",
                                fontWeight: 700,
                                letterSpacing: "0.03em",
                                textTransform: "uppercase",
                              }}
                            >
                              {metadataSummary}
                            </Typography>
                          )}
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
                        {shouldShowInlineThumbnail && (
                          <BrowseResultPortraitThumbnail result={result} />
                        )}
                      </Box>
                    </ButtonBase>
                  </ListItem>
                );
              })}
            </List>
          </Box>
          {(hasMoreResults || canShowFewerResults) && (
            <Box
              className="left-sidebar__results-pagination"
              sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}
            >
              <Typography variant="caption" sx={{ color: "var(--muted-text)", textAlign: "center" }}>
                Showing {visibleResults.length} of {displayedResultCount}
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

/**
 * Compact selected-record list. Its visual numbering mirrors the numbered map
 * markers, so ordering and hover state stay driven by Map.jsx props.
 */
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
              onMouseEnter={() => onHoverBurialChange(burial.id)}
              onMouseLeave={() => onHoverBurialChange(null)}
              sx={{
                ...selectedRowShellStyles,
                border: isActive
                  ? "1px solid rgba(47, 107, 87, 0.14)"
                  : "1px solid rgba(20, 33, 43, 0.07)",
                background: isActive
                  ? "rgba(247, 250, 248, 0.98)"
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
              }}
            >
              <ButtonBase
                component="button"
                type="button"
                focusRipple
                aria-pressed={isActive}
                onFocus={() => onHoverBurialChange(burial.id)}
                onBlur={() => onHoverBurialChange(null)}
                onClick={() => onFocusSelectedBurial(burial)}
                sx={{
                  ...interactiveCardButtonSx,
                  position: "relative",
                  pb: 1.1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <Box
                    sx={buildSelectionBadgeSx({
                      color: markerColors[markerIndex % markerColors.length],
                    })}
                  >
                    {markerIndex + 1}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ lineHeight: 1.2, ...selectionTextWrapSx }}
                    >
                      {formatBrowseResultName(burial)}
                    </Typography>
                    {buildLocationSummary(burial) && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5, ...selectionTextWrapSx }}
                      >
                        {buildLocationSummary(burial)}
                      </Typography>
                    )}
                    {([burial.Birth && `Born ${burial.Birth}`, burial.Death && `Died ${burial.Death}`].filter(Boolean).length > 0) && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={selectionTextWrapSx}
                      >
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
                </Box>
              </ButtonBase>
              <Box
                className={isMobile
                  ? "selected-person-actions selected-person-actions--mobile"
                  : "selected-person-actions"}
                sx={buildSelectionActionLayoutSx()}
              >
                <Button
                  className="left-sidebar__selection-action left-sidebar__selection-action--primary"
                  fullWidth
                  size="small"
                  variant="contained"
                  startIcon={<DirectionsIcon />}
                  onClick={(event) => onOpenDirectionsMenu(event, burial)}
                >
                  Directions
                </Button>
                <Button
                  className="left-sidebar__selection-action left-sidebar__selection-action--secondary"
                  fullWidth
                  size="small"
                  variant="text"
                  color="inherit"
                  startIcon={<CloseIcon />}
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

/**
 * Prominent active selection card for the summary panel. It keeps action layout
 * close to the selected record without owning route or popup state.
 */
function SelectionLeadCard({
  burial,
  burialIndex,
  isActive,
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
      onMouseEnter={() => onHoverBurialChange?.(burial.id)}
      onMouseLeave={() => onHoverBurialChange?.(null)}
      sx={{
        ...selectedRowShellStyles,
        mt: 1.5,
        border: isActive
          ? "1px solid rgba(47, 107, 87, 0.14)"
          : "1px solid rgba(20, 33, 43, 0.07)",
        background: isActive
          ? (isHovered ? "rgba(243, 248, 245, 0.98)" : "rgba(247, 250, 248, 0.98)")
          : (isHovered ? "var(--surface-card-hover)" : "var(--surface-card)"),
        boxShadow: isActive
          ? (isHovered ? "var(--shadow-row-active-hover)" : "var(--shadow-row-active)")
          : (isHovered ? "var(--shadow-row-hover)" : "var(--shadow-row)"),
      }}
    >
      <ButtonBase
        component="button"
        type="button"
        focusRipple
        aria-pressed={isActive}
        onClick={() => onFocusSelectedBurial(burial)}
        onFocus={() => onHoverBurialChange?.(burial.id)}
        onBlur={() => onHoverBurialChange?.(null)}
        sx={{
          ...interactiveCardButtonSx,
          position: "relative",
          pb: 1.1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box
            sx={buildSelectionBadgeSx({
              color: markerColor,
              isLead: true,
            })}
          >
            {burialIndex + 1}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "var(--muted-text)",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                mb: 0.5,
              }}
            >
              {isActive ? "Current selection" : "Selected burial"}
            </Typography>
            <Typography
              variant="subtitle2"
              sx={{ lineHeight: 1.2, fontSize: "1.04rem", ...selectionTextWrapSx }}
            >
              {formatBrowseResultName(burial)}
            </Typography>
            {buildLocationSummary(burial) && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.35, ...selectionTextWrapSx }}
              >
                {buildLocationSummary(burial)}
              </Typography>
            )}
            {([burial.Birth && `Born ${burial.Birth}`, burial.Death && `Died ${burial.Death}`].filter(Boolean).length > 0) && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={selectionTextWrapSx}
              >
                {[burial.Birth && `Born ${burial.Birth}`, burial.Death && `Died ${burial.Death}`]
                  .filter(Boolean)
                  .join(" • ")}
              </Typography>
            )}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.7, mt: 0.85 }}>
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
      </ButtonBase>
      <Box
        className={isMobile
          ? "selected-person-actions selected-person-actions--mobile"
          : "selected-person-actions"}
        sx={buildSelectionActionLayoutSx()}
      >
        <Button
          className="left-sidebar__selection-action left-sidebar__selection-action--primary"
          fullWidth
          size="small"
          variant="contained"
          startIcon={<DirectionsIcon />}
          onClick={(event) => {
            event.stopPropagation();
            onOpenDirectionsMenu(event, burial);
          }}
        >
          Directions
        </Button>
        <Button
          className="left-sidebar__selection-action left-sidebar__selection-action--secondary"
          fullWidth
          size="small"
          variant="text"
          color="inherit"
          startIcon={<CloseIcon />}
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
  isCompact = false,
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
  const locationSummary = buildLocationSummary(burial);
  const lifeSummary = buildLifeDatesSummary(burial);
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
  const mediaContent = mediaUrl ? (
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
  ) : null;

  if (isCompact) {
    const hasCompactMeta = Boolean(isRouteActive || tourStyle);

    return (
      <Box
        sx={{
          mt: 1,
          borderRadius: 2,
          border: "1px solid var(--panel-border)",
          backgroundColor: "rgba(255, 255, 255, 0.92)",
          overflow: "hidden",
        }}
      >
        <Box className="popup-card left-sidebar__selected-place-card left-sidebar__selected-place-card--compact">
          {popupView.sourceLabel && (
            <Box component="p" className="popup-card__eyebrow">
              {popupView.sourceLabel}
            </Box>
          )}
          <Box component="h3" className="popup-card__title">
            {popupView.heading}
          </Box>
          {locationSummary && (
            <Box component="p" className="popup-card__subtitle">
              {locationSummary}
            </Box>
          )}
          {lifeSummary && (
            <Box component="p" className="popup-card__hint">
              {lifeSummary}
            </Box>
          )}
          {hasCompactMeta && (
            <Box className="left-sidebar__selected-place-card-meta">
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
          )}
          {mediaContent}
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
        {mediaContent}
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

/**
 * Shared selection summary for desktop sidebar and mobile sheet variants.
 */
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
  const isLeadBurialActive = leadBurial.id === activeBurialId;
  const hasMultipleSelectedBurials = selectedBurials.length > 1;
  const secondarySelectedBurials = selectedBurials.filter((burial) => burial.id !== leadBurial.id);
  const isRouteActive = activeRouteBurialId === leadBurial.id;
  const leadTourStyle = tourStyles[leadBurial.tourKey];
  const selectedBurialOrderById = new Map(selectedBurials.map((burial, index) => [burial.id, index]));
  const selectionSummaryLabel = "Pinned for focus & directions";
  const shouldShowSelectionToggle = isMobile && hasMultipleSelectedBurials;
  const shouldShowSecondarySelections = secondarySelectedBurials.length > 0 && (!isMobile || isExpanded);

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--selected-summary left-sidebar__panel--surface"
      sx={{ ...panelSurfaceStyles, p: isMobile ? 1.85 : 2 }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          columnGap: 1,
          rowGap: 0.85,
          alignItems: "start",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{SELECTION_PANEL_TITLE}</Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Chip size="small" color="primary" label={selectedBurials.length} />
        </Box>
        <Typography
          variant="body2"
          sx={{
            gridColumn: "1 / -1",
            color: "var(--muted-text)",
            lineHeight: 1.45,
          }}
        >
          {selectionSummaryLabel}
        </Typography>
        <Box
          sx={{
            gridColumn: "1 / -1",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: 0.75,
          }}
        >
          {shouldShowSelectionToggle && (
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
          isCompact
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
          isActive={isLeadBurialActive}
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

      {shouldShowSecondarySelections && (
        <Box
          className="left-sidebar__selected-scroll left-sidebar__selected-scroll--summary"
          sx={{
            mt: 1.65,
            ...(isMobile ? null : {
              maxHeight: "none",
              overflow: "visible",
              paddingRight: 0,
              marginRight: 0,
              scrollbarGutter: "auto",
            }),
          }}
        >
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

/**
 * Field-packet editor and sharing controls. The packet state itself lives in
 * Map.jsx so URL restoration and current map bounds can stay in one place.
 */
function FieldPacketPanel({
  fieldPacket,
  fieldPacketNotice,
  installPromptEvent,
  iosAppStoreUrl,
  isInstalled,
  onClearFieldPacket,
  onCopyFieldPacketLink,
  onInstallApp,
  onShareFieldPacket,
  onUpdateFieldPacket,
  selectedBurials,
  sharedLinkLandingState,
  showIosInstallHint,
}) {
  const packetRecords = fieldPacket?.selectedRecords || EMPTY_PACKET_RECORDS;
  const hasPacket = packetRecords.length > 0;
  const hasSelectedBurials = selectedBurials.length > 0;
  const canUseNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const canInstallApp = Boolean(installPromptEvent) && !isInstalled;
  const canOpenIosAppStore = Boolean(iosAppStoreUrl) && !isInstalled;
  const displayRecordCount = hasPacket ? packetRecords.length : selectedBurials.length;
  const fieldPacketPresentation = useMemo(
    () => buildSharedSelectionPresentation(fieldPacket || {}),
    [fieldPacket]
  );
  const noticeColor = fieldPacketNotice?.tone === "success"
    ? "var(--accent)"
    : fieldPacketNotice?.tone === "warning"
      ? "#9a6c19"
      : "var(--muted-text)";

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--field-packet left-sidebar__panel--surface"
      sx={{ ...panelSurfaceStyles, p: hasPacket ? 1.75 : 1.55 }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.25, mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">Share Link</Typography>
          <Typography variant="body2" sx={{ color: "var(--muted-text)", mt: 0.45 }}>
            Send someone straight to this selection and map view.
          </Typography>
        </Box>
        <Chip
          size="small"
          label={`${displayRecordCount} record${displayRecordCount === 1 ? "" : "s"}`}
        />
      </Box>

      {sharedLinkLandingState && hasPacket && (
        <Box
          sx={{
            mb: 1.2,
            p: 1.35,
            borderRadius: "18px",
            border: "1px solid rgba(47, 107, 87, 0.16)",
            background: "linear-gradient(180deg, rgba(47, 107, 87, 0.12), rgba(47, 107, 87, 0.05))",
          }}
        >
          <Typography
            variant="overline"
            sx={{ display: "block", color: "var(--accent-strong)", lineHeight: 1.2 }}
          >
            Shared Link
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 0.6 }}>
            Opened from a shared link
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: "var(--muted-text)" }}>
            {fieldPacketPresentation.description}
          </Typography>
          {(canInstallApp || canOpenIosAppStore) && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.15 }}>
              {canInstallApp && (
                <Button size="small" variant="contained" onClick={onInstallApp}>
                  Install app
                </Button>
              )}
              {canOpenIosAppStore && (
                <Button
                  size="small"
                  variant={canInstallApp ? "outlined" : "contained"}
                  component="a"
                  href={iosAppStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get iPhone app
                </Button>
              )}
            </Box>
          )}
          {showIosInstallHint && !canInstallApp && (
            <Typography variant="caption" sx={{ display: "block", mt: 0.85, color: "var(--muted-text)" }}>
              Or save it to your Home Screen from Safari for one-tap return visits.
            </Typography>
          )}
        </Box>
      )}

      {hasPacket ? (
        <>
          <TextField
            fullWidth
            size="small"
            label="Link title"
            value={fieldPacket?.name || ""}
            onChange={(event) => onUpdateFieldPacket({ name: event.target.value })}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            label="Message"
            value={fieldPacket?.note || ""}
            onChange={(event) => onUpdateFieldPacket({ note: event.target.value })}
          />
          <Typography variant="caption" sx={{ display: "block", mt: 0.9, color: "var(--muted-text)" }}>
            Anyone with the link can see this title, message, and saved view.
          </Typography>
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
              color: "var(--muted-text)",
            }}
          >
            {hasSelectedBurials
              ? "Copying or sharing updates the link to the current selection and map view."
              : "This link restores the saved selection and map view."}
          </Typography>
        </>
      ) : (
        <Typography variant="body2" sx={{ color: "var(--muted-text)" }}>
          {hasSelectedBurials
            ? `${selectedBurials.length} selected record${selectedBurials.length === 1 ? "" : "s"} ready to share.`
            : "Select one or more records to create a share link."}
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
          onClick={onCopyFieldPacketLink}
          disabled={!hasPacket && !hasSelectedBurials}
        >
          Copy share link
        </Button>
        {canUseNativeShare && (
          <Button
            size="small"
            variant="outlined"
            onClick={onShareFieldPacket}
            disabled={!hasPacket && !hasSelectedBurials}
          >
            Share link
          </Button>
        )}
        {hasPacket && (
          <Button size="small" color="inherit" onClick={onClearFieldPacket}>
            Clear saved details
          </Button>
        )}
      </Box>
    </Box>
  );
}

/**
 * Main sidebar composition. It receives map state as props, delegates browse and
 * mobile-sheet mechanics to hooks, and emits user intent back to the map shell.
 */
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
  installPromptEvent,
  isFieldPacketsEnabled,
  isBurialDataLoading,
  isInstalled,
  isMobile,
  isOnline,
  isSearchIndexReady,
  iosAppStoreUrl,
  loadingTourName,
  lotTierFilter,
  mapDataError,
  markerColors,
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
  onInstallApp,
  onOpenAppMenu,
  onOpenDirectionsMenu,
  onMobileSheetViewportChange,
  onRemoveSelectedBurial,
  onRequestBurialDataLoad,
  onRequestHideChrome,
  onSectionChange,
  onShareFieldPacket,
  onStartRouting,
  onStopRouting,
  onToggleSectionMarkers,
  onTourChange,
  onUpdateFieldPacket,
  rootRef,
  searchIndex,
  sectionRecordsOverride,
  sectionIndex,
  sectionFilter,
  selectedBurialRefs,
  selectedBurials,
  selectedTour,
  showAllBurials,
  showIosInstallHint,
  sharedLinkLandingState,
  status,
  tourDefinitions,
  tourLayerError,
  tourResults,
  tourStyles,
  uniqueSections,
}) {
  const { isDev } = getRuntimeEnv();
  const areFieldPacketsEnabled = typeof isFieldPacketsEnabled === "boolean"
    ? isFieldPacketsEnabled
    : resolveFieldPacketsEnabled();
  const hasTourBrowse = tourDefinitions.length > 0;
  const initialBrowseSource = useMemo(
    () => {
      const explicitBrowseSource = getBrowseSourceMode({ sectionFilter, selectedTour });

      if (explicitBrowseSource !== "all") {
        return explicitBrowseSource;
      }

      return "all";
    },
    [sectionFilter, selectedTour]
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
    sectionRecordsOverride,
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
    isSelectedSummaryExpanded,
    maximizeMobileSheet,
    mobileDefaultSnap,
    mobileSnapPoints,
    resolvedMobileSheetState,
    setIsSelectedSummaryExpanded,
    sheetRef,
    toggleSelectedSummary,
  } = useBurialSidebarMobileSheetState({
    hasActiveBrowseContext,
    initialBrowseSource,
    initialQuery,
    isMobile,
    selectedBurialsLength: selectedBurials.length,
  });
  const [isMobileSearchPanelCollapsedByControl, setIsMobileSearchPanelCollapsedByControl] = useState(false);
  const hasGlobalResetState = Boolean(
    browseQuery.trim() ||
    sectionFilter ||
    lotTierFilter ||
    selectedTour ||
    selectedBurials.length > 0
  );
  const hasSectionFilters = Boolean(sectionFilter || lotTierFilter);
  const hasTourSelection = Boolean(selectedTour);
  const isSectionBrowseVisible = browseSource === "section";
  const isTourBrowseVisible = browseSource === "tour" && hasTourBrowse;
  const isCurrentTourLoading = Boolean(
    selectedTour && loadingTourName === selectedTour && tourResults.length === 0
  );
  const sidebarScrollRef = useRef(null);
  const previousActiveBurialIdRef = useRef(activeBurialId);
  const previousSectionFilterRef = useRef(sectionFilter);
  const previousSelectedTourRef = useRef(selectedTour);
  const previousSelectionSignatureRef = useRef(
    selectedBurials.map((record) => record.id).sort().join("|")
  );

  const setSidebarRootNode = useCallback((node) => {
    // `react-spring-bottom-sheet` owns part of the mobile DOM tree, so the map
    // shell needs a direct root ref for visible-viewport padding calculations.
    if (!rootRef) {
      return;
    }

    const rootNode = isMobile
      ? node?.closest?.("[data-rsbs-overlay]") || node
      : node;

    if (typeof rootRef === "function") {
      rootRef(rootNode);
      return;
    }

    rootRef.current = rootNode;
  }, [isMobile, rootRef]);

  const setSidebarScrollNode = useCallback((node) => {
    sidebarScrollRef.current = node;
  }, []);

  const scrollMobileSheetToTop = useCallback((behavior = "smooth") => {
    if (!isMobile) {
      return;
    }

    const scrollContainer = sidebarScrollRef.current?.closest?.("[data-rsbs-scroll]");
    if (!scrollContainer) {
      return;
    }

    if (typeof scrollContainer.scrollTo === "function") {
      scrollContainer.scrollTo({ top: 0, behavior });
      return;
    }

    scrollContainer.scrollTop = 0;
  }, [isMobile]);

  const handleMobileSheetSpringEnd = useCallback((event) => {
    handleSheetSpringEnd(event);
    onMobileSheetViewportChange?.();
  }, [handleSheetSpringEnd, onMobileSheetViewportChange]);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileSearchPanelCollapsedByControl(false);
      return;
    }

    if (resolvedMobileSheetState !== MOBILE_SHEET_STATES.COLLAPSED) {
      setIsMobileSearchPanelCollapsedByControl(false);
    }
  }, [isMobile, resolvedMobileSheetState]);

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

    // Mobile keeps the map usable by default, then reveals the drawer when a
    // user action creates a result or selection worth inspecting.
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
      expandMobileSheet();
    }

    scrollMobileSheetToTop();
  }, [
    activeBurialId,
    expandMobileSheet,
    isMobile,
    resolvedMobileSheetState,
    scrollMobileSheetToTop,
    sectionFilter,
    selectedBurials,
    selectedTour,
  ]);

  const handleBrowseQueryChange = useCallback((event) => {
    onRequestBurialDataLoad?.();
    setBrowseQuery(event.target.value);
  }, [onRequestBurialDataLoad, setBrowseQuery]);

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
  }, [
    isMobile,
    onBrowseResultSelect,
    selectedBurials.length,
    setIsSelectedSummaryExpanded,
  ]);

  const handleSectionSelection = useCallback((nextSection) => {
    onRequestBurialDataLoad?.();
    setBrowseSource("section");
    onSectionChange(nextSection || "");
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onRequestBurialDataLoad, onSectionChange, setBrowseSource]);

  const handleToggleSectionMarkers = useCallback(() => {
    onRequestBurialDataLoad?.();
    onToggleSectionMarkers();
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onRequestBurialDataLoad, onToggleSectionMarkers]);

  const handleFilterTypeSelection = useCallback((nextFilterType) => {
    onFilterTypeChange(nextFilterType);
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onFilterTypeChange]);

  const handleLotTierChange = useCallback((nextValue) => {
    onLotTierFilterChange(nextValue);
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onLotTierFilterChange]);

  const handleClearSectionFilters = useCallback(() => {
    setBrowseSource("section");
    onClearSectionFilters();
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onClearSectionFilters, setBrowseSource]);

  const handleTourSelection = useCallback((tourName) => {
    if (!hasTourBrowse) return;

    setBrowseSource("tour");
    onTourChange(tourName);
    maximizeMobileSheet();
  }, [hasTourBrowse, maximizeMobileSheet, onTourChange, setBrowseSource]);

  const handleClearTourSelection = useCallback(() => {
    setBrowseSource("tour");
    onTourChange(null);
    maximizeMobileSheet();
  }, [maximizeMobileSheet, onTourChange, setBrowseSource]);

  const handleBrowseSourceChange = useCallback((nextSource) => {
    onRequestBurialDataLoad?.();

    if (!nextSource) {
      setBrowseSource("all");
      expandMobileSheet();
      return;
    }

    if (nextSource === "tour" && !hasTourBrowse) {
      expandMobileSheet();
      return;
    }

    if (
      nextSource === browseSource &&
      ((nextSource === "section" && !hasSectionFilters) ||
      (nextSource === "tour" && !hasTourSelection))
    ) {
      setBrowseSource("all");
      expandMobileSheet();
      return;
    }

    setBrowseSource(nextSource);

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
    hasSectionFilters,
    hasTourSelection,
    hasTourBrowse,
    maximizeMobileSheet,
    lotTierFilter,
    onClearSectionFilters,
    onRequestBurialDataLoad,
    onTourChange,
    sectionFilter,
    selectedTour,
    setBrowseSource,
  ]);

  useEffect(() => {
    if (!hasTourBrowse && browseSource === "tour") {
      setBrowseSource("all");
    }
  }, [browseSource, hasTourBrowse, setBrowseSource]);

  const handleLocateUser = useCallback(() => {
    onLocateMarker();
  }, [onLocateMarker]);

  const handleToggleMobileSearchPanel = useCallback(() => {
    if (!isMobile) {
      return;
    }

    if (isMobileSearchPanelCollapsedByControl) {
      setIsMobileSearchPanelCollapsedByControl(false);
      expandMobileSheet();
      return;
    }

    if (onRequestHideChrome) {
      onRequestHideChrome();
      return;
    }

    setIsMobileSearchPanelCollapsedByControl(true);
    collapseMobileSheet();
  }, [
    collapseMobileSheet,
    expandMobileSheet,
    isMobile,
    isMobileSearchPanelCollapsedByControl,
    onRequestHideChrome,
  ]);

  const handleClearAllBrowseState = useCallback(() => {
    setBrowseQuery("");
    setBrowseSource("all");
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
  const searchShellNotices = useMemo(() => {
    return buildSearchShellNotices({
      burialRecordCount: burialRecords.length,
      browseResultCount: browseResults.length,
      defaultLocationStatus: DEFAULT_LOCATION_STATUS,
      activeLocationStatus: LOCATION_ACTIVE_STATUS,
      locatingLocationStatus: LOCATION_LOCATING_STATUS,
      outOfBoundsLocationStatus: LOCATION_OUT_OF_BOUNDS_STATUS,
      unavailableLocationStatus: LOCATION_UNAVAILABLE_STATUS,
      unsupportedLocationStatus: LOCATION_UNSUPPORTED_STATUS,
      approximateLocationStatus: LOCATION_APPROXIMATE_STATUS,
      weakSignalLocationStatus: LOCATION_WEAK_SIGNAL_STATUS,
      hasActiveBrowseQuery: Boolean(browseQuery.trim()),
      isBurialDataLoading,
      isInstalled,
      isOnline,
      isSearchIndexReady,
      loadingTourName,
      showIosInstallHint,
      status,
    });
  }, [
    burialRecords.length,
    browseQuery,
    browseResults.length,
    isBurialDataLoading,
    isInstalled,
    isOnline,
    isSearchIndexReady,
    loadingTourName,
    showIosInstallHint,
    status,
  ]);
  const browseScopeChips = useMemo(() => {
    return buildBrowseScopeChips({
      browseSource,
      filterType,
      lotTierFilter,
      sectionFilter,
      selectedTour,
      showAllBurials,
    });
  }, [
    browseSource,
    filterType,
    lotTierFilter,
    sectionFilter,
    selectedTour,
    showAllBurials,
  ]);
  const browseEmptyActions = useMemo(() => {
    return buildBrowseEmptyActionSpecs({
      browseResultCount: browseResults.length,
      browseSource,
      hasMinimumBrowseQuery,
      isCurrentTourLoading,
      sectionFilter,
      selectedTour,
      tourLabel: TOUR_LABEL,
    }).map((action) => ({
      ...action,
      onClick: action.action === "clear-search"
        ? handleClearBrowseQuery
        : action.action === "reset-section"
          ? handleClearSectionFilters
          : handleClearTourSelection,
    }));
  }, [
    browseResults.length,
    browseSource,
    handleClearBrowseQuery,
    handleClearSectionFilters,
    handleClearTourSelection,
    hasMinimumBrowseQuery,
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
  const mobileSearchPanelToggleLabel = isMobileSearchPanelCollapsedByControl
    ? "Show search panel"
    : "Hide search panel";
  const mobileSearchPanelToggleButton = isMobile ? (
    <IconButton
      size="small"
      color="inherit"
      onClick={handleToggleMobileSearchPanel}
      aria-label={mobileSearchPanelToggleLabel}
      title={mobileSearchPanelToggleLabel}
      aria-pressed={isMobileSearchPanelCollapsedByControl}
      sx={{
        color: "var(--muted-text)",
        border: "1px solid rgba(20, 33, 43, 0.08)",
        backgroundColor: "rgba(255, 255, 255, 0.76)",
      }}
    >
      <ArrowDropDownIcon
        fontSize="small"
        sx={{
          transform: isMobileSearchPanelCollapsedByControl ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
        }}
      />
    </IconButton>
  ) : null;
  const mobileHeaderActions = isMobile ? (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: "auto" }}>
      {mobileSearchPanelToggleButton}
      {mobileMoreButton}
    </Box>
  ) : null;
  const hasExplicitBrowseResultsContext = Boolean(browseQuery.trim())
    || Boolean(sectionFilter)
    || Boolean(selectedTour)
    || isBrowsePending
    || isCurrentTourLoading;
  const shouldShowBrowseResults = hasExplicitBrowseResultsContext;
  const shouldShowFieldPacketPanel = areFieldPacketsEnabled
    && (selectedBurials.length > 0 || hasFieldPacketContent(fieldPacket));

  const browseResultsContent = shouldShowBrowseResults ? (
    <BrowseResultsPanel
      activeBurialId={activeBurialId}
      batchSize={resultLimit}
      browseResults={browseResults}
      browseSource={browseSource}
      emptyStateActions={browseEmptyActions}
      hoveredBurialId={hoveredBurialId}
      isBurialDataLoading={isBurialDataLoading}
      isBrowsePending={isBrowsePending}
      isCurrentTourLoading={isCurrentTourLoading}
      onBrowseResultSelect={handleBrowseResultSelect}
      onClearSelectedBurials={onClearSelectedBurials}
      onHoverBurialChange={onHoverBurialChange}
      query={browseQuery}
      sectionFilter={sectionFilter}
      selectedBurials={selectedBurials}
      selectedTour={selectedTour}
      scopeChips={browseScopeChips}
      tourStyles={tourStyles}
    />
  ) : null;

  const selectedSummaryContent = selectedBurials.length > 0 ? (
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
  ) : null;

  const browseWorkspaceContent = (
    <BrowseWorkspacePanel
      autocompleteComponentsProps={autocompleteComponentsProps}
      autocompleteListboxProps={autocompleteListboxProps}
      burialDataError={burialDataError}
      browseQuery={browseQuery}
      desktopMoreButton={desktopMoreButton}
      filterType={filterType}
      hasGlobalResetState={hasGlobalResetState}
      hasSectionFilters={hasSectionFilters}
      hasTourBrowse={hasTourBrowse}
      hasTourSelection={hasTourSelection}
      isBrowsePending={isBrowsePending}
      isBurialDataLoading={isBurialDataLoading}
      isMobile={isMobile}
      isSectionBrowseVisible={isSectionBrowseVisible}
      isTourBrowseVisible={isTourBrowseVisible}
      lotTierFilter={lotTierFilter}
      onBrowseQueryChange={handleBrowseQueryChange}
      onBrowseSourceChange={handleBrowseSourceChange}
      onClearAllBrowseState={handleClearAllBrowseState}
      onClearBrowseQuery={handleClearBrowseQuery}
      onClearSectionFilters={handleClearSectionFilters}
      onClearTourSelection={handleClearTourSelection}
      onFilterTypeSelection={handleFilterTypeSelection}
      onLocateUser={handleLocateUser}
      onLotTierChange={handleLotTierChange}
      onRequestBurialDataLoad={onRequestBurialDataLoad}
      onSectionSelection={handleSectionSelection}
      onToggleSectionMarkers={handleToggleSectionMarkers}
      onTourSelection={handleTourSelection}
      priorityContent={shouldShowBrowseResults ? null : selectedSummaryContent}
      resultsContent={browseResultsContent}
      searchPlaceholder={searchPlaceholder}
      searchShellNotices={searchShellNotices}
      sectionFilter={sectionFilter}
      selectedSectionOption={selectedSectionOption}
      selectedTour={selectedTour}
      showAllBurials={showAllBurials}
      surfaceSx={panelSurfaceStyles}
      tourDefinitions={tourDefinitions}
      tourLabel={TOUR_LABEL}
      tourStyles={tourStyles}
      uniqueSections={uniqueSections}
    />
  );

  const headerContent = (
    <Box className="left-sidebar__header" sx={{ p: !isMobile ? 1.75 : 1.35 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
          mb: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{ display: "block", letterSpacing: 1.2, color: "var(--muted-text)", lineHeight: 1.1 }}
          >
            {APP_HEADER_EYEBROW}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.35 }}>
            <Box
              component="a"
              href={APP_HOME_URL}
              sx={{ color: "inherit", display: "inline-block", textDecoration: "none" }}
            >
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                {APP_HEADER_TITLE}
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
        {mobileHeaderActions}
      </Box>

      {(burialDataError || mapDataError || tourLayerError) && (
        <Box sx={{ display: "grid", gap: 0.75, mt: 1 }}>
          {burialDataError && (
            <Typography variant="body2" color="error">
              {burialDataError}
            </Typography>
          )}
          {mapDataError && (
            <Typography variant="body2" color="error">
              {mapDataError}
            </Typography>
          )}
          {tourLayerError && (
            <Typography variant="body2" color="error">
              {tourLayerError}
            </Typography>
          )}
        </Box>
      )}

    </Box>
  );

  const bodyContent = (
    <Box sx={{ p: 1.25, display: "grid", gap: 1.25 }}>
      {browseWorkspaceContent}

      {shouldShowFieldPacketPanel && (
        <FieldPacketPanel
          fieldPacket={fieldPacket}
          fieldPacketNotice={fieldPacketNotice}
          installPromptEvent={installPromptEvent}
          iosAppStoreUrl={iosAppStoreUrl}
          isInstalled={isInstalled}
          onClearFieldPacket={onClearFieldPacket}
          onCopyFieldPacketLink={onCopyFieldPacketLink}
          onInstallApp={onInstallApp}
          onShareFieldPacket={onShareFieldPacket}
          onUpdateFieldPacket={onUpdateFieldPacket}
          selectedBurials={selectedBurials}
          sharedLinkLandingState={sharedLinkLandingState}
          showIosInstallHint={showIosInstallHint}
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
          ref={setSidebarScrollNode}
          className="left-sidebar__body"
          sx={{ minHeight: 0, overflow: "auto", flex: 1 }}
        >
          {bodyContent}
        </Box>
      </Paper>
    );
  }

  // -- Mobile render: Apple Maps-style BottomSheet --
  const mobileSheetBody = (
    <Box
      ref={(node) => {
        setSidebarRootNode(node);
        setSidebarScrollNode(node);
      }}
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
      header={false}
      expandOnContentDrag
      onSpringEnd={handleMobileSheetSpringEnd}
    >
      {mobileSheetBody}
    </BottomSheet>
  );
}

export default memo(BurialSidebar);
