import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Box,
  Button,
  ButtonBase,
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
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DirectionsIcon from "@mui/icons-material/Directions";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { BottomSheet } from "react-spring-bottom-sheet";
import "react-spring-bottom-sheet/dist/style.css";
import { APP_PROFILE } from "./features/fab/profile";
import BrowseWorkspacePanel, { BrowseSearchField } from "./features/browse/BrowseWorkspacePanel";
import {
  buildAutocompletePresentation,
  buildBrowseResultsPanelPresentation,
  buildLifeDatesSummary,
  buildBrowseEmptyActionSpecs,
  buildBrowseScopeChips,
  buildMobileSearchPanelTogglePresentation,
  buildSearchShellNotices,
  buildSidebarContentVisibility,
  getSearchPlaceholder,
  getSelectedSectionOption,
  getSidebarClassName,
} from "./features/browse/sidebarPresentation";
import {
  buildLocationSummary,
  formatBrowseResultName,
  getBrowseSourceMode,
  MIN_BROWSE_QUERY_LENGTH,
} from "./features/browse/browseResults";
import { buildBrowseResultCardPresentation } from "./features/browse/browseResultPresentation";
import {
  DEFAULT_SELECTED_PLACE_DETAIL_ROW_LIMIT,
  buildSelectedBurialLookup,
  buildSelectedPlaceDetailPresentation,
  buildSelectedSummaryPresentation,
  buildSelectedLocationLabel,
  buildSelectedPlaceInitials,
  getSelectedPlaceTypeLabel,
  hasFieldPacketContent,
} from "./features/browse/selectedRecordPresentation";
import { buildFieldPacketPanelPresentation } from "./features/fieldPackets";
import { buildPopupViewModel, cleanRecordValue } from "./features/map/mapRecordPresentation";
import { resolvePortraitImageName } from "./features/tours/tourDerivedData";
import { MOBILE_SHEET_STATES } from "./features/browse/mobileSheetGeometry";
import {
  buildBrowseQueryChangeIntent,
  buildSidebarBrowseFlags,
  buildBrowseSourceChangeIntent,
  buildClearAllBrowseStateIntent,
  buildClearBrowseQueryIntent,
  buildClearSectionFiltersIntent,
  buildClearTourSelectionIntent,
  buildFilterTypeSelectionIntent,
  buildLotTierChangeIntent,
  buildMobileSearchPanelCollapseResetIntent,
  buildMobileSearchPanelToggleIntent,
  buildMobileSheetRevealIntent,
  buildSectionSelectionIntent,
  buildToggleSectionMarkersIntent,
  buildTourSelectionIntent,
  buildUnavailableTourBrowseResetIntent,
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
const MOBILE_LOCATION_INITIAL_PERSON_LIMIT = 8;
const MOBILE_LOCATION_PERSON_SEARCH_THRESHOLD = 8;
const MOBILE_LOCATION_RENDER_ALL_PERSON_LIMIT = 100;

const buildMobileLocationPersonOptionId = (pickerId, recordId) => (
  `${pickerId}-option-${encodeURIComponent(cleanRecordValue(recordId)).replace(/%/g, "_")}`
);

const buildMobileLocationPickerId = (records = [], fallbackId = "plot") => (
  `mobile-location-${encodeURIComponent(cleanRecordValue(records[0]?.id || fallbackId)).replace(/%/g, "_")}`
);

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
const LOCATION_OUT_OF_BOUNDS_STATUS = APP_PROFILE.map.locationMessages?.outOfBounds || "Tap Navigate for driving directions.";
const LOCATION_UNAVAILABLE_STATUS = APP_PROFILE.map.locationMessages?.unavailable || "Location unavailable";
const LOCATION_UNSUPPORTED_STATUS = APP_PROFILE.map.locationMessages?.unsupported || "Location unavailable";
const LOCATION_APPROXIMATE_STATUS = APP_PROFILE.map.locationMessages?.approximate || "";
const LOCATION_WEAK_SIGNAL_STATUS = APP_PROFILE.map.locationMessages?.weakSignal || "";
const EMPTY_PACKET_RECORDS = [];
const EMPTY_ACTIONS = [];

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

function SelectedPlaceVisual({
  fallbackLabel,
  heading,
  imageAlt,
  imageLinkUrl,
  mediaUrl,
  markerColor,
  onImageError,
}) {
  if (mediaUrl) {
    const image = (
      <img
        className="left-sidebar__selected-place-visual-image"
        src={mediaUrl}
        alt={imageAlt}
        loading="lazy"
        onError={onImageError}
      />
    );

    return (
      <Box className="left-sidebar__selected-place-visual left-sidebar__selected-place-visual--image">
        {imageLinkUrl ? (
          <a
            className="left-sidebar__selected-place-visual-link"
            href={imageLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {image}
          </a>
        ) : image}
      </Box>
    );
  }

  return (
    <Box
      className="left-sidebar__selected-place-visual left-sidebar__selected-place-visual--fallback"
      aria-label={`${fallbackLabel} visual for ${heading}`}
      sx={{ "--selected-place-accent": markerColor || "var(--accent)" }}
    >
      <span className="left-sidebar__selected-place-visual-initials">
        {buildSelectedPlaceInitials(heading)}
      </span>
      <span className="left-sidebar__selected-place-visual-label">
        {fallbackLabel}
      </span>
    </Box>
  );
}

function SelectedRecordActionButtons({
  burial,
  detailLinkUrl = "",
  isMobile,
  isRouteActive,
  onNavigateToBurial,
  onRemoveSelectedBurial,
  showNavigate = true,
}) {
  return (
    <Box
      className={isMobile
        ? "selected-person-actions selected-person-actions--mobile"
        : "selected-person-actions"}
      sx={buildSelectionActionLayoutSx()}
    >
      {showNavigate && (
        <Button
          className="left-sidebar__selection-action left-sidebar__selection-action--primary"
          fullWidth
          size="small"
          variant="contained"
          startIcon={<DirectionsIcon />}
          onClick={(event) => {
            event.stopPropagation();
            onNavigateToBurial(event, burial);
          }}
        >
          {isRouteActive ? "Stop Navigation" : "Navigate"}
        </Button>
      )}
      {detailLinkUrl && (
        <Button
          className="left-sidebar__selection-action left-sidebar__selection-action--secondary"
          component="a"
          fullWidth
          href={detailLinkUrl}
          rel="noopener noreferrer"
          size="small"
          target="_blank"
          variant="text"
          color="inherit"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          Details
        </Button>
      )}
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
        Close
      </Button>
    </Box>
  );
}

/**
 * One browse/search result row. Memoized because the hovered/active ids live in
 * the map selection reducer: without memo, every hover re-renders every visible
 * card and recomputes its derived summaries.
 */
const BrowseResultCard = memo(function BrowseResultCard({
  result,
  isPinned,
  isActive,
  isHovered,
  tourColor,
  tourStyleName,
  scopedSectionLabel,
  scopedTourLabel,
  showInlineThumbnail,
  onSelect,
  onHoverChange,
}) {
  const presentation = buildBrowseResultCardPresentation({
    result,
    scopedSectionLabel,
    scopedTourLabel,
    tourStyleName,
  });

  return (
    <ListItem disablePadding sx={{ display: "block", pb: 1 }}>
      <ButtonBase
        component="button"
        type="button"
        focusRipple
        className={[
          "left-sidebar__result-card",
          isActive ? "left-sidebar__result-card--active" : "",
        ].filter(Boolean).join(" ")}
        onClick={() => onSelect(result)}
        onFocus={() => onHoverChange?.(result.id)}
        onMouseEnter={() => onHoverChange?.(result.id)}
        onMouseLeave={() => onHoverChange?.(null)}
        onBlur={() => onHoverChange?.(null)}
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
            showInlineThumbnail ? "left-sidebar__result-card-layout--with-thumbnail" : "",
          ].filter(Boolean).join(" ")}
        >
          <Box className="left-sidebar__result-card-copy">
            {presentation.metadataSummary && (
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
                {presentation.metadataSummary}
              </Typography>
            )}
            <Typography variant="subtitle2" sx={{ position: "relative", zIndex: 1, lineHeight: 1.25 }}>
              {presentation.displayName}
            </Typography>
            {presentation.locationSummary && (
              <Typography variant="body2" color="text.secondary" sx={{ position: "relative", zIndex: 1, mt: 0.5 }}>
                {presentation.locationSummary}
              </Typography>
            )}
            {presentation.secondarySummary && (
              <Typography variant="body2" color="text.secondary" sx={{ position: "relative", zIndex: 1, mt: 0.5 }}>
                {presentation.secondarySummary}
              </Typography>
            )}
            {presentation.lifeSummary && (
              <Typography variant="body2" color="text.secondary" sx={{ position: "relative", zIndex: 1, mt: 0.35 }}>
                {presentation.lifeSummary}
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
              {presentation.tourChipLabel && (
                <Chip
                  size="small"
                  label={presentation.tourChipLabel}
                  sx={{
                    color: "white",
                    backgroundColor: tourColor || "var(--accent)",
                  }}
                />
              )}
            </Box>
          </Box>
          {showInlineThumbnail && (
            <BrowseResultPortraitThumbnail result={result} />
          )}
        </Box>
      </ButtonBase>
    </ListItem>
  );
});

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
  setVisibleCount,
  scopeChips = EMPTY_PACKET_RECORDS,
  tourStyles,
  visibleCount,
}) {
  const {
    selectedBurialCount,
    selectedBurialIds,
  } = useMemo(
    () => buildSelectedBurialLookup({ selectedBurials }),
    [selectedBurials]
  );
  const onBrowseResultSelectRef = useRef(onBrowseResultSelect);
  const onHoverBurialChangeRef = useRef(onHoverBurialChange);

  onBrowseResultSelectRef.current = onBrowseResultSelect;
  onHoverBurialChangeRef.current = onHoverBurialChange;

  const handleBrowseResultSelect = useCallback((result) => {
    onBrowseResultSelectRef.current?.(result);
  }, []);

  const handleHoverBurialChange = useCallback((burialId) => {
    onHoverBurialChangeRef.current?.(burialId);
  }, []);

  const panelPresentation = useMemo(
    () => buildBrowseResultsPanelPresentation({
      batchSize,
      browseResults,
      browseSource,
      isBurialDataLoading,
      isCurrentTourLoading,
      minBrowseQueryLength: MIN_BROWSE_QUERY_LENGTH,
      query,
      scopeChips,
      sectionFilter,
      selectedTour,
      tourLabel: TOUR_LABEL,
      visibleCount,
    }),
    [
      batchSize,
      browseResults,
      browseSource,
      isBurialDataLoading,
      isCurrentTourLoading,
      query,
      scopeChips,
      sectionFilter,
      selectedTour,
      visibleCount,
    ]
  );
  const {
    canShowFewerResults,
    displayedResultCount,
    emptyMessage,
    hasMoreResults,
    hasScopeChips,
    resultSummaryLabel,
    resultsEyebrow,
    resultsTitle,
    scopedSectionLabel,
    scopedTourLabel,
    shouldRenderEmptyState,
    visibleResults,
  } = panelPresentation;

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

      {!shouldRenderEmptyState && (
        <Typography
          className="left-sidebar__results-summary"
          variant="body2"
          sx={{ color: "var(--muted-text)" }}
        >
          {resultSummaryLabel}
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
            <List disablePadding onMouseLeave={() => handleHoverBurialChange(null)}>
              {visibleResults.map((result) => (
                <BrowseResultCard
                  key={result.id}
                  result={result}
                  isPinned={selectedBurialIds.has(result.id)}
                  isActive={activeBurialId === result.id}
                  isHovered={hoveredBurialId === result.id}
                  tourColor={tourStyles[result.tourKey]?.color || ""}
                  tourStyleName={tourStyles[result.tourKey]?.name || ""}
                  scopedSectionLabel={scopedSectionLabel}
                  scopedTourLabel={scopedTourLabel}
                  showInlineThumbnail={browseSource === "tour"}
                  onSelect={handleBrowseResultSelect}
                  onHoverChange={handleHoverBurialChange}
                />
              ))}
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
  onNavigateToBurial,
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
        const locationSummary = buildLocationSummary(burial);
        const lifeSummary = buildLifeDatesSummary(burial);

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
                    {locationSummary && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5, ...selectionTextWrapSx }}
                      >
                        {locationSummary}
                      </Typography>
                    )}
                    {lifeSummary && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={selectionTextWrapSx}
                      >
                        {lifeSummary}
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
              <SelectedRecordActionButtons
                burial={burial}
                isMobile={isMobile}
                isRouteActive={isRouteActive}
                onNavigateToBurial={onNavigateToBurial}
                onRemoveSelectedBurial={onRemoveSelectedBurial}
                showNavigate={isRouteActive}
              />
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
  onNavigateToBurial,
  onRemoveSelectedBurial,
  tourStyle,
}) {
  const locationSummary = buildLocationSummary(burial);
  const lifeSummary = buildLifeDatesSummary(burial);
  const popupView = useMemo(() => buildPopupViewModel(burial), [burial]);
  const popupKey = burial?.id || popupView.heading;
  const detailPresentation = buildSelectedPlaceDetailPresentation({
    detailLinkUrl: popupView.biographyLink || popupView.imageLinkUrl,
    isExpanded: true,
    rows: popupView.rows,
  });
  const [mediaUrl, setMediaUrl] = useState(() => popupView.imageUrl || "");

  useEffect(() => {
    setMediaUrl(popupView.imageUrl || "");
  }, [popupView.imageUrl]);

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
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.15 }}>
          <Box sx={{ position: "relative", flexShrink: 0, display: "flex" }}>
            <SelectedPlaceVisual
              fallbackLabel={getSelectedPlaceTypeLabel(burial)}
              heading={popupView.heading}
              imageAlt={popupView.imageAlt}
              imageLinkUrl=""
              mediaUrl={mediaUrl}
              markerColor={markerColor}
              onImageError={handleImageError}
            />
            <Box
              sx={{
                ...buildSelectionBadgeSx({
                  color: markerColor,
                  isLead: true,
                }),
                position: "absolute",
                top: -8,
                left: -8,
                mt: 0,
              }}
            >
              {burialIndex + 1}
            </Box>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{ lineHeight: 1.2, fontSize: "1.04rem", ...selectionTextWrapSx }}
            >
              {formatBrowseResultName(burial)}
            </Typography>
            {locationSummary && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.35, ...selectionTextWrapSx }}
              >
                {locationSummary}
              </Typography>
            )}
            {lifeSummary && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={selectionTextWrapSx}
              >
                {lifeSummary}
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
      {detailPresentation.allDetailRows.length > 0 && (
        <Box component="dl" className="left-sidebar__selected-place-facts">
          {detailPresentation.allDetailRows.map(({ label, value }) => (
            <Box key={`${popupKey}-lead-${label}`} className="left-sidebar__selected-place-fact">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </Box>
          ))}
        </Box>
      )}
      <SelectedRecordActionButtons
        burial={burial}
        detailLinkUrl={detailPresentation.detailLinkUrl}
        isMobile={isMobile}
        isRouteActive={isRouteActive}
        onNavigateToBurial={onNavigateToBurial}
        onRemoveSelectedBurial={onRemoveSelectedBurial}
      />
    </Box>
  );
}

const buildMobileLocationPersonOption = (record, sourceIndex) => {
  const name = formatBrowseResultName(record);
  const lifeSummary = buildLifeDatesSummary(record);

  return {
    id: record.id,
    lifeSummary,
    name,
    record,
    searchText: `${name} ${lifeSummary}`.toLocaleLowerCase(),
    sourceIndex,
  };
};

const filterMobileLocationPersonOptions = (options, query) => {
  const normalizedQuery = cleanRecordValue(query).toLocaleLowerCase();
  return normalizedQuery
    ? options.filter((option) => option.searchText.includes(normalizedQuery))
    : options;
};

const MobileLocationPersonOption = memo(function MobileLocationPersonOption({
  isActive,
  isFocused,
  onFocus,
  onKeyDown,
  onSelect,
  option,
  optionId,
  position,
  setSize,
  setOptionRef,
}) {
  return (
    <ButtonBase
      ref={(node) => setOptionRef(option.id, node)}
      component="button"
      type="button"
      role="option"
      id={optionId}
      aria-label={`${option.name}${option.lifeSummary ? `. ${option.lifeSummary}` : ""}`}
      aria-posinset={position}
      aria-selected={isActive}
      aria-setsize={setSize}
      tabIndex={isFocused ? 0 : -1}
      className={[
        "mobile-location-card__person-option",
        isActive ? "mobile-location-card__person-option--active" : "",
      ].filter(Boolean).join(" ")}
      onClick={() => onSelect(option.record)}
      onFocus={() => onFocus(option.id)}
      onKeyDown={(event) => onKeyDown(event, option)}
    >
      <span className="mobile-location-card__person-option-visual" aria-hidden="true">
        {buildSelectedPlaceInitials(option.name)}
      </span>
      <span className="mobile-location-card__person-option-copy">
        <span className="mobile-location-card__person-option-name">{option.name}</span>
        <span className="mobile-location-card__person-option-meta">
          {option.lifeSummary || "Burial record"}
        </span>
      </span>
      <CheckRoundedIcon
        className="mobile-location-card__person-option-check"
        aria-hidden="true"
      />
    </ButtonBase>
  );
});

function MobileLocationPeoplePicker({
  activeRecordId,
  children,
  onSelectRecord,
  pickerId,
  records,
}) {
  const initialVisibleLimit = records.length <= MOBILE_LOCATION_RENDER_ALL_PERSON_LIMIT
    ? records.length
    : MOBILE_LOCATION_INITIAL_PERSON_LIMIT;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(initialVisibleLimit);
  const [focusedRecordId, setFocusedRecordId] = useState(activeRecordId || records[0]?.id || "");
  const triggerRef = useRef(null);
  const optionRefs = useRef(new Map());
  const pickerPanelId = `${pickerId}-panel`;
  const listboxId = `${pickerId}-listbox`;
  const searchId = `${pickerId}-search`;
  const options = useMemo(() => (
    records
      .map(buildMobileLocationPersonOption)
      .sort((left, right) => (
        left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" })
        || left.sourceIndex - right.sourceIndex
      ))
  ), [records]);
  const activeOption = options.find((option) => option.id === activeRecordId) || options[0];
  const matchingOptions = useMemo(
    () => filterMobileLocationPersonOptions(options, query),
    [options, query]
  );
  const visibleOptions = useMemo(() => {
    const boundedOptions = matchingOptions.slice(0, visibleLimit);
    const activeMatch = matchingOptions.find((option) => option.id === activeOption?.id);
    return activeMatch && !boundedOptions.some((option) => option.id === activeMatch.id)
      ? [...boundedOptions, activeMatch]
      : boundedOptions;
  }, [activeOption?.id, matchingOptions, visibleLimit]);
  const hiddenOptionCount = Math.max(0, matchingOptions.length - visibleOptions.length);
  const shouldShowSearch = records.length > MOBILE_LOCATION_PERSON_SEARCH_THRESHOLD;

  const restoreTriggerFocus = useCallback(() => {
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const closePicker = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setVisibleLimit(initialVisibleLimit);
    restoreTriggerFocus();
  }, [initialVisibleLimit, restoreTriggerFocus]);

  const handleTogglePicker = useCallback(() => {
    if (isOpen) {
      closePicker();
      return;
    }

    setQuery("");
    setVisibleLimit(initialVisibleLimit);
    setFocusedRecordId(activeOption?.id || options[0]?.id || "");
    setIsOpen(true);
  }, [activeOption?.id, closePicker, initialVisibleLimit, isOpen, options]);

  const handleTriggerKeyDown = useCallback((event) => {
    if (event.key !== "Escape" || !isOpen) return;
    event.preventDefault();
    event.stopPropagation();
    closePicker();
  }, [closePicker, isOpen]);

  const handleQueryChange = useCallback((event) => {
    const nextQuery = event.target.value;
    const nextMatches = filterMobileLocationPersonOptions(options, nextQuery);
    const nextActiveOption = nextMatches.find((option) => option.id === activeRecordId);

    setQuery(nextQuery);
    setVisibleLimit(initialVisibleLimit);
    setFocusedRecordId(nextActiveOption?.id || nextMatches[0]?.id || "");
  }, [activeRecordId, initialVisibleLimit, options]);

  const handleSelectOption = useCallback((record) => {
    setIsOpen(false);
    setQuery("");
    setVisibleLimit(initialVisibleLimit);
    setFocusedRecordId(record.id);
    onSelectRecord?.(record);
    restoreTriggerFocus();
  }, [initialVisibleLimit, onSelectRecord, restoreTriggerFocus]);

  const setOptionRef = useCallback((recordId, node) => {
    if (node) {
      optionRefs.current.set(recordId, node);
      return;
    }

    optionRefs.current.delete(recordId);
  }, []);

  const focusOption = useCallback((option) => {
    if (!option) return;
    setFocusedRecordId(option.id);
    optionRefs.current.get(option.id)?.focus();
  }, []);

  const revealAndFocusOption = useCallback((option, nextVisibleLimit) => {
    if (!option) return;

    if (nextVisibleLimit > visibleLimit) {
      flushSync(() => {
        setVisibleLimit(Math.min(matchingOptions.length, nextVisibleLimit));
      });
    }

    focusOption(option);
  }, [focusOption, matchingOptions.length, visibleLimit]);

  const handleOptionKeyDown = useCallback((event, option) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePicker();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectOption(option.record);
      return;
    }

    const currentIndex = matchingOptions.findIndex((candidate) => candidate.id === option.id);
    if (currentIndex < 0) return;

    let nextOption = null;
    let nextVisibleLimit = visibleLimit;
    if (event.key === "ArrowDown") {
      if (currentIndex >= matchingOptions.length - 1) return;
      nextOption = matchingOptions[currentIndex + 1];
      nextVisibleLimit = Math.max(visibleLimit, currentIndex + 2);
    } else if (event.key === "ArrowUp") {
      if (currentIndex === 0) return;
      nextOption = matchingOptions[currentIndex - 1];
      nextVisibleLimit = Math.max(visibleLimit, currentIndex + 1);
    } else if (event.key === "Home") {
      nextOption = matchingOptions[0];
    } else if (event.key === "End") {
      nextOption = matchingOptions[matchingOptions.length - 1];
      nextVisibleLimit = matchingOptions.length;
    }

    if (!nextOption) return;
    event.preventDefault();
    revealAndFocusOption(nextOption, nextVisibleLimit);
  }, [
    closePicker,
    handleSelectOption,
    matchingOptions,
    revealAndFocusOption,
    visibleLimit,
  ]);

  const handleSearchKeyDown = useCallback((event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePicker();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(visibleOptions.find((option) => option.id === focusedRecordId) || visibleOptions[0]);
    }
  }, [closePicker, focusOption, focusedRecordId, visibleOptions]);

  const handleShowMore = useCallback(() => {
    const nextOption = matchingOptions[Math.min(visibleLimit, matchingOptions.length - 1)];
    const nextVisibleLimit = Math.min(
      matchingOptions.length,
      visibleLimit + MOBILE_LOCATION_INITIAL_PERSON_LIMIT
    );

    flushSync(() => {
      setVisibleLimit(nextVisibleLimit);
    });
    focusOption(nextOption);
  }, [focusOption, matchingOptions, visibleLimit]);

  const activeName = activeOption?.name || "Selected person";
  const triggerLabel = `Choose person. ${activeName} selected. ${records.length} people at this plot.`;

  return (
    <>
      <ButtonBase
        ref={triggerRef}
        component="button"
        type="button"
        className="mobile-location-card__person-picker-trigger"
        aria-controls={pickerPanelId}
        aria-expanded={isOpen}
        aria-label={triggerLabel}
        onClick={handleTogglePicker}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="mobile-location-card__person-picker-icon" aria-hidden="true">
          <PeopleAltOutlinedIcon />
        </span>
        <span className="mobile-location-card__person-picker-copy">
          <span className="mobile-location-card__person-picker-label">Choose a person</span>
          <span className="mobile-location-card__person-picker-value">{activeName}</span>
        </span>
        <span className="mobile-location-card__person-picker-count" aria-hidden="true">
          {records.length}
        </span>
        <ArrowDropDownIcon
          className="mobile-location-card__person-picker-chevron"
          aria-hidden="true"
        />
      </ButtonBase>

      {isOpen ? (
        <Box id={pickerPanelId} className="mobile-location-card__person-picker" onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closePicker();
          }
        }}>
          {shouldShowSearch && (
            <TextField
              id={searchId}
              className="mobile-location-card__person-picker-search"
              type="search"
              value={query}
              fullWidth
              placeholder={`Search ${records.length} people`}
              inputProps={{ "aria-label": "Search people at this plot" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon aria-hidden="true" />
                  </InputAdornment>
                ),
              }}
              onChange={handleQueryChange}
              onKeyDown={handleSearchKeyDown}
            />
          )}

          {shouldShowSearch && cleanRecordValue(query) && (
            <Box
              className="mobile-location-card__person-picker-results"
              role="status"
              aria-live="polite"
            >
              {matchingOptions.length === 1
                ? "1 matching person"
                : `${matchingOptions.length} matching people`}
            </Box>
          )}

          <Box className="mobile-location-card__person-picker-viewport">
            <Box
              component="ul"
              id={listboxId}
              className="mobile-location-card__person-listbox"
              role="listbox"
              aria-label={`Choose from ${records.length} people at this plot`}
            >
              {visibleOptions.map((option) => (
                <Box component="li" role="presentation" key={option.id}>
                  <MobileLocationPersonOption
                    isActive={option.id === activeOption?.id}
                    isFocused={option.id === focusedRecordId}
                    onFocus={setFocusedRecordId}
                    onKeyDown={handleOptionKeyDown}
                    onSelect={handleSelectOption}
                    option={option}
                    optionId={buildMobileLocationPersonOptionId(pickerId, option.id)}
                    position={matchingOptions.findIndex((candidate) => candidate.id === option.id) + 1}
                    setSize={matchingOptions.length}
                    setOptionRef={setOptionRef}
                  />
                </Box>
              ))}
            </Box>

            {visibleOptions.length === 0 && (
              <Box className="mobile-location-card__person-picker-empty" role="status">
                <strong>No people found</strong>
                <span>Try a different name or date.</span>
              </Box>
            )}

            {hiddenOptionCount > 0 && (
              <ButtonBase
                component="button"
                type="button"
                className="mobile-location-card__people-toggle"
                aria-controls={listboxId}
                aria-label={`Show ${Math.min(MOBILE_LOCATION_INITIAL_PERSON_LIMIT, hiddenOptionCount)} more people. ${visibleOptions.length} of ${matchingOptions.length} shown.`}
                onClick={handleShowMore}
              >
                <span>Show {Math.min(MOBILE_LOCATION_INITIAL_PERSON_LIMIT, hiddenOptionCount)} more</span>
                <span className="mobile-location-card__people-progress">
                  {visibleOptions.length} of {matchingOptions.length}
                </span>
              </ButtonBase>
            )}
          </Box>
        </Box>
      ) : children}
    </>
  );
}

function SelectedPlaceCard({
  burial,
  isRouteActive,
  locationLabel,
  locationRecordCount,
  markerColor,
  onNavigateToBurial,
  onStopRouting,
  stackList = null,
  tourStyle,
}) {
  const popupView = useMemo(() => buildPopupViewModel(burial), [burial]);
  const popupKey = burial?.id || popupView.heading;
  const locationRecords = stackList?.records || [burial];
  const pickerId = buildMobileLocationPickerId(locationRecords, popupKey);
  const selectedPersonHeadingId = `${pickerId}-selected-person`;
  const hasPeoplePicker = locationRecords.length > 1;
  const locationSummary = buildLocationSummary(burial);
  const lifeSummary = buildLifeDatesSummary(burial);
  const placeTypeLabel = getSelectedPlaceTypeLabel(burial);
  const recordContextLabel = popupView.sourceLabel || placeTypeLabel;
  const tourContextLabel = burial.tourName || tourStyle?.name || "";
  const summaryParagraphs = popupView.paragraphs || [];
  const detailRows = popupView.rows.filter(({ label, value }) => !(
    label === "Role" && summaryParagraphs.includes(cleanRecordValue(value))
  ));
  const shouldAppendTourContext = Boolean(
    tourStyle
    && cleanRecordValue(tourContextLabel)
    && cleanRecordValue(tourContextLabel) !== cleanRecordValue(recordContextLabel)
  );
  const [mediaUrl, setMediaUrl] = useState(() => popupView.imageUrl || "");
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const detailPresentation = buildSelectedPlaceDetailPresentation({
    detailLinkUrl: popupView.biographyLink || popupView.imageLinkUrl,
    isExpanded: isDetailExpanded,
    rows: detailRows,
    visibleRowLimit: DEFAULT_SELECTED_PLACE_DETAIL_ROW_LIMIT,
  });

  useEffect(() => {
    setMediaUrl(popupView.imageUrl || "");
    setIsDetailExpanded(false);
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

  const selectedPersonPanel = (
    <Box
      className="mobile-location-card__person-panel"
      role="region"
      aria-labelledby={selectedPersonHeadingId}
    >
        <Box className="mobile-location-card__active-person">
          <SelectedPlaceVisual
            fallbackLabel={placeTypeLabel}
            heading={popupView.heading}
            imageAlt={popupView.imageAlt}
            imageLinkUrl={popupView.imageLinkUrl}
            mediaUrl={mediaUrl}
            markerColor={markerColor}
            onImageError={handleImageError}
          />
          <Box className="mobile-location-card__active-copy">
            <Box
              component="h3"
              id={selectedPersonHeadingId}
              className="mobile-location-card__person-name"
            >
              {popupView.heading}
            </Box>
            {lifeSummary && (
              <Box component="p" className="mobile-location-card__life-dates">
                {lifeSummary}
              </Box>
            )}
            {summaryParagraphs.map((paragraph, index) => (
              <Box
                key={`${popupKey}-mobile-summary-${index}`}
                component="p"
                className="mobile-location-card__summary"
              >
                {paragraph}
              </Box>
            ))}
            <Box component="p" className="mobile-location-card__record-type">
              {recordContextLabel}
              {shouldAppendTourContext ? ` · ${tourContextLabel}` : ""}
            </Box>
          </Box>
        </Box>

        <Box className="mobile-location-card__actions">
          <Button
            className="mobile-location-card__action mobile-location-card__action--primary"
            fullWidth
            variant="contained"
            startIcon={<DirectionsIcon />}
            onClick={() => {
              if (isRouteActive) {
                onStopRouting?.();
                return;
              }

              onNavigateToBurial?.(burial);
            }}
          >
            {isRouteActive ? "Stop Navigation" : "Navigate"}
          </Button>
          <Button
            className="mobile-location-card__action mobile-location-card__action--secondary"
            fullWidth
            variant="text"
            color="inherit"
            startIcon={<InfoOutlinedIcon />}
            aria-expanded={isDetailExpanded}
            aria-controls={`mobile-location-details-${burial.id}`}
            onClick={() => setIsDetailExpanded((current) => !current)}
          >
            Details
          </Button>
        </Box>

        {isDetailExpanded && (
          <Box
            id={`mobile-location-details-${burial.id}`}
            className="mobile-location-card__details"
          >
            <Box component="dl" className="left-sidebar__selected-place-facts">
              <Box className="left-sidebar__selected-place-fact">
                <dt>Plot</dt>
                <dd>{locationLabel || locationSummary || "Location unavailable"}</dd>
              </Box>
              <Box className="left-sidebar__selected-place-fact">
                <dt>Records here</dt>
                <dd>{locationRecordCount}</dd>
              </Box>
              {detailPresentation.allDetailRows.map(({ label, value }) => (
                <Box key={`${popupKey}-mobile-${label}`} className="left-sidebar__selected-place-fact">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </Box>
              ))}
            </Box>
            {detailPresentation.detailLinkUrl && (
              <Button
                component="a"
                href={detailPresentation.detailLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                size="small"
              >
                View biography
              </Button>
            )}
          </Box>
        )}
    </Box>
  );

  return (
    <Box className="mobile-location-card">
      {hasPeoplePicker ? (
        <MobileLocationPeoplePicker
          key={pickerId}
          activeRecordId={burial.id}
          onSelectRecord={stackList?.onSelectRecord}
          pickerId={pickerId}
          records={locationRecords}
        >
          {selectedPersonPanel}
        </MobileLocationPeoplePicker>
      ) : selectedPersonPanel}
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
  isMobile,
  markerColors,
  onClearSelectedBurials,
  onFocusSelectedBurial,
  onHoverBurialChange,
  onNavigateToBurial,
  onRemoveSelectedBurial,
  onStopRouting,
  selectedBurialCoordinateGroups = [],
  selectedBurialRefs,
  selectedBurials,
  tourStyles,
}) {
  const summaryPresentation = useMemo(
    () => buildSelectedSummaryPresentation({
      activeBurialId,
      activeRouteBurialId,
      isMobile,
      selectedBurialCoordinateGroups,
      selectedBurials,
    }),
    [
      activeBurialId,
      activeRouteBurialId,
      isMobile,
      selectedBurialCoordinateGroups,
      selectedBurials,
    ]
  );
  const handleSelectLocationRecord = useCallback((record) => {
    onFocusSelectedBurial(record);
  }, [onFocusSelectedBurial]);

  if (!summaryPresentation) return null;

  const {
    isLeadBurialActive,
    isRouteActive,
    leadBurial,
    leadBurialIndex,
    leadStackList,
    locationLabel,
    secondarySelectedBurials,
    selectedBurialOrderById,
    selectionSummaryLabel,
    selectionSummaryTitle,
    shouldShowSecondarySelections,
  } = summaryPresentation;
  const leadTourStyle = tourStyles[leadBurial.tourKey];
  const interactiveLeadStackList = leadStackList
    ? {
        ...leadStackList,
        onSelectRecord: handleSelectLocationRecord,
      }
    : null;

  if (isMobile) {
    return (
      <SelectedPlaceCard
        burial={leadBurial}
        isRouteActive={isRouteActive}
        locationLabel={locationLabel}
        locationRecordCount={interactiveLeadStackList?.records.length || 1}
        markerColor={markerColors[leadBurialIndex % markerColors.length]}
        onNavigateToBurial={onNavigateToBurial}
        onStopRouting={onStopRouting}
        stackList={interactiveLeadStackList}
        tourStyle={leadTourStyle}
      />
    );
  }

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--selected-summary left-sidebar__panel--surface"
      sx={{
        ...panelSurfaceStyles,
        p: 2,
        display: "grid",
        gap: 0,
      }}
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
          <Typography variant="subtitle2">{selectionSummaryTitle}</Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Chip size="small" color="primary" label={selectedBurials.length} />
        </Box>
        {selectionSummaryLabel && (
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
        )}
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
          <Button size="small" color="inherit" onClick={onClearSelectedBurials}>
            Clear
          </Button>
        </Box>
      </Box>

      <SelectionLeadCard
        burial={leadBurial}
        burialIndex={leadBurialIndex}
        isActive={isLeadBurialActive}
        isHovered={hoveredBurialId === leadBurial.id}
        isMobile={false}
        isRouteActive={isRouteActive}
        markerColor={markerColors[leadBurialIndex % markerColors.length]}
        onFocusSelectedBurial={onFocusSelectedBurial}
        onHoverBurialChange={onHoverBurialChange}
        onNavigateToBurial={onNavigateToBurial}
        onRemoveSelectedBurial={onRemoveSelectedBurial}
        tourStyle={leadTourStyle}
      />

      {shouldShowSecondarySelections && (
        <Box
          className="left-sidebar__selected-scroll left-sidebar__selected-scroll--summary"
          sx={{
            mt: 1.65,
            maxHeight: "none",
            overflow: "visible",
            paddingRight: 0,
            marginRight: 0,
            scrollbarGutter: "auto",
          }}
        >
          <Divider sx={{ mb: 1.5 }} />
          <SelectedPeopleList
            activeBurialId={activeBurialId}
            activeRouteBurialId={activeRouteBurialId}
            hoveredBurialId={hoveredBurialId}
            isMobile={false}
            markerColors={markerColors}
            onFocusSelectedBurial={onFocusSelectedBurial}
            onHoverBurialChange={onHoverBurialChange}
            onNavigateToBurial={onNavigateToBurial}
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
  const hasNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const panelPresentation = useMemo(
    () => buildFieldPacketPanelPresentation({
      fieldPacket,
      fieldPacketNotice,
      hasNativeShare,
      installPromptEvent,
      iosAppStoreUrl,
      isInstalled,
      selectedBurials,
    }),
    [
      fieldPacket,
      fieldPacketNotice,
      hasNativeShare,
      installPromptEvent,
      iosAppStoreUrl,
      isInstalled,
      selectedBurials,
    ]
  );
  const {
    canCopyOrShare,
    canInstallApp,
    canOpenIosAppStore,
    canUseNativeShare,
    displayRecordCountLabel,
    emptyStateMessage,
    hasMapContext,
    hasPacket,
    hasSectionFilter,
    hasSelectedTour,
    noticeColor,
    panelPadding,
    savedDetailsHint,
    sharedSelectionPresentation,
  } = panelPresentation;

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--field-packet left-sidebar__panel--surface"
      sx={{ ...panelSurfaceStyles, p: panelPadding }}
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
          label={displayRecordCountLabel}
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
            {sharedSelectionPresentation.description}
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
            {hasSectionFilter && (
              <Chip size="small" variant="outlined" label={sharedSelectionPresentation.sectionLabel} />
            )}
            {hasSelectedTour && (
              <Chip size="small" variant="outlined" label={sharedSelectionPresentation.selectedTour} />
            )}
            {hasMapContext && (
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
            {savedDetailsHint}
          </Typography>
        </>
      ) : (
        <Typography variant="body2" sx={{ color: "var(--muted-text)" }}>
          {emptyStateMessage}
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
          disabled={!canCopyOrShare}
        >
          Copy share link
        </Button>
        {canUseNativeShare && (
          <Button
            size="small"
            variant="outlined"
            onClick={onShareFieldPacket}
            disabled={!canCopyOrShare}
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
  burialRecordsById,
  fieldPacket,
  fieldPacketNotice,
  filterType,
  getTourName,
  hasAppMenuActions = false,
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
  onLotTierFilterChange,
  onClearFieldPacket,
  onCopyFieldPacketLink,
  onInstallApp,
  onOpenAppMenu,
  onNavigateToBurial,
  onMobileSheetViewportChange,
  onRemoveSelectedBurial,
  onRequestBurialDataLoad,
  onRequestHideChrome,
  onRetryBurialDataLoad,
  onSectionChange,
  onShareFieldPacket,
  onStopRouting,
  onToggleSectionMarkers,
  onTourChange,
  onUpdateFieldPacket,
  rootRef,
  searchIndex,
  sectionRecordsOverride,
  sectionIndex,
  sectionFilter,
  selectedBurialCoordinateGroups = [],
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
    burialRecordsById,
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
  const browseResultScopeKey = useMemo(
    () => JSON.stringify([
      resultLimit,
      browseResults.length,
      browseSource,
      browseQuery,
      sectionFilter,
      selectedTour,
    ]),
    [
      browseQuery,
      browseResults.length,
      browseSource,
      resultLimit,
      sectionFilter,
      selectedTour,
    ]
  );
  const [browsePagination, setBrowsePagination] = useState(() => ({
    scopeKey: browseResultScopeKey,
    visibleCount: resultLimit,
  }));
  const visibleBrowseResultCount = browsePagination.scopeKey === browseResultScopeKey
    ? browsePagination.visibleCount
    : resultLimit;
  const setVisibleBrowseResultCount = useCallback((nextVisibleCount) => {
    setBrowsePagination((currentPagination) => {
      const currentVisibleCount = currentPagination.scopeKey === browseResultScopeKey
        ? currentPagination.visibleCount
        : resultLimit;
      const resolvedVisibleCount = typeof nextVisibleCount === "function"
        ? nextVisibleCount(currentVisibleCount)
        : nextVisibleCount;

      if (
        currentPagination.scopeKey === browseResultScopeKey
        && currentPagination.visibleCount === resolvedVisibleCount
      ) {
        return currentPagination;
      }

      return {
        scopeKey: browseResultScopeKey,
        visibleCount: resolvedVisibleCount,
      };
    });
  }, [browseResultScopeKey, resultLimit]);
  const {
    collapseMobileSheet,
    expandMobileSheet,
    handleSheetSpringEnd,
    maximizeMobileSheet,
    mobileDefaultSnap,
    mobileSnapPoints,
    resolvedMobileSheetState,
    sheetRef,
  } = useBurialSidebarMobileSheetState({
    hasActiveBrowseContext,
    initialBrowseSource,
    initialQuery,
    isMobile,
    selectedBurialsLength: selectedBurials.length,
  });
  const [isMobileSearchPanelCollapsedByControl, setIsMobileSearchPanelCollapsedByControl] = useState(false);
  const {
    hasGlobalResetState,
    hasMinimumBrowseQuery,
    hasSectionFilters,
    hasTourSelection,
    isCurrentTourLoading,
    isSectionBrowseVisible,
    isTourBrowseVisible,
  } = buildSidebarBrowseFlags({
    browseQuery,
    browseSource,
    hasTourBrowse,
    loadingTourName,
    lotTierFilter,
    sectionFilter,
    selectedBurialsLength: selectedBurials.length,
    selectedTour,
    tourResultCount: tourResults.length,
  });
  const sidebarScrollRef = useRef(null);
  const previousActiveBurialIdRef = useRef(null);
  const previousSectionFilterRef = useRef("");
  const previousSelectedTourRef = useRef("");
  const previousSelectionSignatureRef = useRef("");

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
    const intent = buildMobileSearchPanelCollapseResetIntent({
      isMobile,
      resolvedMobileSheetState,
    });

    if (intent.shouldSetMobileSearchPanelCollapsedByControl) {
      setIsMobileSearchPanelCollapsedByControl(
        intent.isMobileSearchPanelCollapsedByControlToSet
      );
    }
  }, [isMobile, resolvedMobileSheetState]);

  useEffect(() => {
    const previousActiveBurialId = previousActiveBurialIdRef.current;
    const previousSectionFilter = previousSectionFilterRef.current;
    const previousSelectedTour = previousSelectedTourRef.current;
    const previousSelectionSignature = previousSelectionSignatureRef.current;
    const revealIntent = buildMobileSheetRevealIntent({
      activeBurialId,
      isMobile,
      previousActiveBurialId,
      previousSectionFilter,
      previousSelectedTour,
      previousSelectionSignature,
      resolvedMobileSheetState,
      sectionFilter,
      selectedBurials,
      selectedTour,
    });

    previousActiveBurialIdRef.current = activeBurialId;
    previousSectionFilterRef.current = sectionFilter;
    previousSelectedTourRef.current = selectedTour;
    previousSelectionSignatureRef.current = revealIntent.currentSelectionSignature;

    if (!isMobile) {
      return;
    }

    if (!revealIntent.shouldRevealSelectedRecord && !revealIntent.shouldRevealBrowseContext) {
      return;
    }

    // Browse contexts keep the map visible at the peek height. A selected
    // location requests the full-content snap so the primary Navigate action
    // is immediately reachable; geometry keeps short cards content-sized.
    if (revealIntent.shouldExpandMobileSheet) {
      if (revealIntent.shouldRevealSelectedRecord) {
        maximizeMobileSheet();
      } else {
        expandMobileSheet();
      }
    }

    if (revealIntent.shouldScrollMobileSheetToTop) {
      scrollMobileSheetToTop("auto");
    }
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
    const intent = buildBrowseQueryChangeIntent({
      nextQuery: event.target.value,
    });

    if (intent.shouldRequestBurialDataLoad) {
      onRequestBurialDataLoad?.();
    }

    if (intent.shouldSetBrowseQuery) {
      setBrowseQuery(intent.browseQueryToSet);
    }
  }, [onRequestBurialDataLoad, setBrowseQuery]);

  const handleClearBrowseQuery = useCallback(() => {
    const intent = buildClearBrowseQueryIntent();

    if (intent.shouldSetBrowseQuery) {
      setBrowseQuery(intent.browseQueryToSet);
    }
  }, [setBrowseQuery]);

  const handleBrowseResultSelect = useCallback((result) => {
    onBrowseResultSelect(result);
  }, [onBrowseResultSelect]);

  const handleSectionSelection = useCallback((nextSection) => {
    const intent = buildSectionSelectionIntent({ nextSection });

    if (intent.shouldRequestBurialDataLoad) {
      onRequestBurialDataLoad?.();
    }

    if (intent.shouldSetBrowseSource) {
      setBrowseSource(intent.browseSourceToSet);
    }

    if (intent.shouldSetSectionFilter) {
      onSectionChange(intent.sectionFilterToSet);
    }

    if (intent.shouldMaximizeMobileSheet) {
      maximizeMobileSheet();
    }
  }, [maximizeMobileSheet, onRequestBurialDataLoad, onSectionChange, setBrowseSource]);

  const handleToggleSectionMarkers = useCallback(() => {
    const intent = buildToggleSectionMarkersIntent();

    if (intent.shouldRequestBurialDataLoad) {
      onRequestBurialDataLoad?.();
    }

    if (intent.shouldToggleSectionMarkers) {
      onToggleSectionMarkers();
    }

    if (intent.shouldMaximizeMobileSheet) {
      maximizeMobileSheet();
    }
  }, [maximizeMobileSheet, onRequestBurialDataLoad, onToggleSectionMarkers]);

  const handleFilterTypeSelection = useCallback((nextFilterType) => {
    const intent = buildFilterTypeSelectionIntent({ nextFilterType });

    if (intent.shouldSetFilterType) {
      onFilterTypeChange(intent.filterTypeToSet);
    }

    if (intent.shouldMaximizeMobileSheet) {
      maximizeMobileSheet();
    }
  }, [maximizeMobileSheet, onFilterTypeChange]);

  const handleLotTierChange = useCallback((nextValue) => {
    const intent = buildLotTierChangeIntent({ nextValue });

    if (intent.shouldSetLotTierFilter) {
      onLotTierFilterChange(intent.lotTierFilterToSet);
    }

    if (intent.shouldMaximizeMobileSheet) {
      maximizeMobileSheet();
    }
  }, [maximizeMobileSheet, onLotTierFilterChange]);

  const handleClearSectionFilters = useCallback(() => {
    const intent = buildClearSectionFiltersIntent();

    if (intent.shouldSetBrowseSource) {
      setBrowseSource(intent.browseSourceToSet);
    }

    if (intent.shouldClearSectionFilters) {
      onClearSectionFilters();
    }

    if (intent.shouldMaximizeMobileSheet) {
      maximizeMobileSheet();
    }
  }, [maximizeMobileSheet, onClearSectionFilters, setBrowseSource]);

  const handleTourSelection = useCallback((tourName) => {
    const intent = buildTourSelectionIntent({
      hasTourBrowse,
      tourName,
    });

    if (intent.shouldSetBrowseSource) {
      setBrowseSource(intent.browseSourceToSet);
    }

    if (intent.shouldSetTourSelection) {
      onTourChange(intent.selectedTourToSet);
    }

    if (intent.shouldMaximizeMobileSheet) {
      maximizeMobileSheet();
    }
  }, [hasTourBrowse, maximizeMobileSheet, onTourChange, setBrowseSource]);

  const handleClearTourSelection = useCallback(() => {
    const intent = buildClearTourSelectionIntent();

    if (intent.shouldSetBrowseSource) {
      setBrowseSource(intent.browseSourceToSet);
    }

    if (intent.shouldSetTourSelection) {
      onTourChange(intent.selectedTourToSet);
    }

    if (intent.shouldMaximizeMobileSheet) {
      maximizeMobileSheet();
    }
  }, [maximizeMobileSheet, onTourChange, setBrowseSource]);

  const handleBrowseSourceChange = useCallback((nextSource) => {
    const intent = buildBrowseSourceChangeIntent({
      browseSource,
      hasSectionFilters,
      hasTourBrowse,
      hasTourSelection,
      nextSource,
    });

    if (intent.shouldRequestBurialDataLoad) {
      onRequestBurialDataLoad?.();
    }

    if (intent.browseSourceToSet) {
      setBrowseSource(intent.browseSourceToSet);
    }

    if (intent.shouldClearSectionFilters) {
      onClearSectionFilters();
    }

    if (intent.shouldClearTourSelection) {
      onTourChange(null);
    }

    if (intent.shouldExpandMobileSheet) {
      expandMobileSheet();
    }

    if (intent.shouldMaximizeMobileSheet) {
      maximizeMobileSheet();
    }
  }, [
    browseSource,
    expandMobileSheet,
    hasSectionFilters,
    hasTourSelection,
    hasTourBrowse,
    onClearSectionFilters,
    onRequestBurialDataLoad,
    onTourChange,
    maximizeMobileSheet,
    setBrowseSource,
  ]);

  useEffect(() => {
    const intent = buildUnavailableTourBrowseResetIntent({
      browseSource,
      hasTourBrowse,
    });

    if (intent.shouldSetBrowseSource) {
      setBrowseSource(intent.browseSourceToSet);
    }
  }, [browseSource, hasTourBrowse, setBrowseSource]);

  const handleToggleMobileSearchPanel = useCallback(() => {
    const intent = buildMobileSearchPanelToggleIntent({
      canRequestHideChrome: Boolean(onRequestHideChrome),
      isMobile,
      isMobileSearchPanelCollapsedByControl,
      resolvedMobileSheetState,
    });

    if (intent.shouldSetMobileSearchPanelCollapsedByControl) {
      setIsMobileSearchPanelCollapsedByControl(
        intent.isMobileSearchPanelCollapsedByControlToSet
      );
    }

    if (intent.shouldExpandMobileSheet) {
      expandMobileSheet();
    }

    if (intent.shouldRequestHideChrome) {
      onRequestHideChrome();
    }

    if (intent.shouldCollapseMobileSheet) {
      collapseMobileSheet();
    }
  }, [
    collapseMobileSheet,
    expandMobileSheet,
    isMobile,
    isMobileSearchPanelCollapsedByControl,
    onRequestHideChrome,
    resolvedMobileSheetState,
  ]);

  const handleClearAllBrowseState = useCallback(() => {
    const intent = buildClearAllBrowseStateIntent({
      lotTierFilter,
      sectionFilter,
      selectedTour,
    });

    setBrowseQuery(intent.browseQueryToSet);
    setBrowseSource(intent.browseSourceToSet);

    if (intent.shouldClearSectionFilters) {
      onClearSectionFilters();
    } else if (intent.shouldClearLotTierFilter) {
      onLotTierFilterChange(intent.lotTierFilterToSet);
    }

    if (intent.shouldClearTourSelection) {
      onTourChange(intent.selectedTourToSet);
    }

    if (intent.shouldClearSelectedBurials) {
      onClearSelectedBurials();
    }

    if (intent.shouldExpandMobileSheet) {
      expandMobileSheet();
    }
  }, [
    expandMobileSheet,
    lotTierFilter,
    onClearSectionFilters,
    onClearSelectedBurials,
    onLotTierFilterChange,
    onTourChange,
    sectionFilter,
    selectedTour,
    setBrowseQuery,
    setBrowseSource,
  ]);

  const sidebarClassName = getSidebarClassName({ isMobile });
  const autocompletePresentation = useMemo(
    () => buildAutocompletePresentation({ isMobile }),
    [isMobile]
  );
  const autocompleteComponentsProps = autocompletePresentation.componentsProps;
  const autocompleteListboxProps = autocompletePresentation.listboxProps;
  const selectedSectionOption = useMemo(
    () => getSelectedSectionOption({ sectionFilter, uniqueSections }),
    [sectionFilter, uniqueSections]
  );
  const searchPlaceholder = getSearchPlaceholder({
    browseSource,
    isBurialDataLoading,
    isCompact: isMobile,
    sectionFilter,
    selectedTour,
  });
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
  const desktopMoreButton = !isMobile && hasAppMenuActions ? (
    <Button
      variant="text"
      size="small"
      color="inherit"
      onClick={onOpenAppMenu}
      startIcon={<MoreHorizIcon />}
      className="left-sidebar__more-button"
    >
      More
    </Button>
  ) : null;
  const mobileMoreButton = isMobile && hasAppMenuActions ? (
    <IconButton
      size="small"
      color="inherit"
      onClick={onOpenAppMenu}
      aria-label="More options"
      className="mobile-sheet-header__icon-button"
    >
      <MoreHorizIcon fontSize="small" />
    </IconButton>
  ) : null;
  const mobileSearchPanelTogglePresentation = useMemo(
    () => buildMobileSearchPanelTogglePresentation({
      collapsedSheetState: MOBILE_SHEET_STATES.COLLAPSED,
      isMobileSearchPanelCollapsedByControl,
      resolvedMobileSheetState,
    }),
    [isMobileSearchPanelCollapsedByControl, resolvedMobileSheetState]
  );
  const mobileSearchPanelToggleButton = isMobile ? (
    <IconButton
      size="small"
      color="inherit"
      onClick={handleToggleMobileSearchPanel}
      aria-label={mobileSearchPanelTogglePresentation.label}
      title={mobileSearchPanelTogglePresentation.label}
      aria-pressed={mobileSearchPanelTogglePresentation.isCollapsed}
      className="mobile-sheet-header__icon-button"
    >
      <ArrowDropDownIcon
        fontSize="small"
        sx={mobileSearchPanelTogglePresentation.iconSx}
      />
    </IconButton>
  ) : null;
  const {
    shouldShowBrowseResults,
    shouldShowFieldPacketPanel,
  } = buildSidebarContentVisibility({
    areFieldPacketsEnabled,
    browseQuery,
    hasFieldPacketContent: hasFieldPacketContent(fieldPacket),
    isBrowsePending,
    isCurrentTourLoading,
    sectionFilter,
    selectedBurialsLength: selectedBurials.length,
    selectedTour,
  });

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
      setVisibleCount={setVisibleBrowseResultCount}
      scopeChips={browseScopeChips}
      tourStyles={tourStyles}
      visibleCount={visibleBrowseResultCount}
    />
  ) : null;

  const selectedSummaryContent = selectedBurials.length > 0 ? (
    <SelectedSummaryPanel
      activeBurialId={activeBurialId}
      activeRouteBurialId={activeRouteBurialId}
      hoveredBurialId={hoveredBurialId}
      isMobile={isMobile}
      markerColors={markerColors}
      onClearSelectedBurials={onClearSelectedBurials}
      onFocusSelectedBurial={onFocusSelectedBurial}
      onHoverBurialChange={onHoverBurialChange}
      onNavigateToBurial={onNavigateToBurial}
      onRemoveSelectedBurial={onRemoveSelectedBurial}
      onStopRouting={onStopRouting}
      selectedBurialCoordinateGroups={selectedBurialCoordinateGroups}
      selectedBurialRefs={selectedBurialRefs}
      selectedBurials={selectedBurials}
      tourStyles={tourStyles}
    />
  ) : null;
  const mobileActiveBurial = selectedBurials.find((burial) => burial.id === activeBurialId)
    || selectedBurials[0]
    || null;
  const mobileActiveLocationGroup = mobileActiveBurial
    ? selectedBurialCoordinateGroups.find((group) => group.recordIds.includes(mobileActiveBurial.id))
    : null;
  const mobileLocationRecordCount = mobileActiveLocationGroup?.records.length
    || (mobileActiveBurial ? 1 : 0);
  const mobileLocationLabel = mobileActiveBurial
    ? buildSelectedLocationLabel(mobileActiveBurial)
    : "";
  const hasMobileLocationSelection = isMobile && Boolean(mobileActiveBurial);

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
      onLotTierChange={handleLotTierChange}
      onRequestBurialDataLoad={onRequestBurialDataLoad}
      onSectionSelection={handleSectionSelection}
      onToggleSectionMarkers={handleToggleSectionMarkers}
      onTourSelection={handleTourSelection}
      priorityContent={selectedSummaryContent}
      resultsContent={browseResultsContent}
      searchPlaceholder={searchPlaceholder}
      searchShellNotices={searchShellNotices}
      sectionFilter={sectionFilter}
      selectedSectionOption={selectedSectionOption}
      selectedTour={selectedTour}
      showAllBurials={showAllBurials}
      showSearchField={!isMobile}
      surfaceSx={panelSurfaceStyles}
      tourDefinitions={tourDefinitions}
      tourLabel={TOUR_LABEL}
      tourStyles={tourStyles}
      uniqueSections={uniqueSections}
    />
  );

  const devChip = isDev ? (
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
  ) : null;

  const dataErrorContent = (burialDataError || mapDataError || tourLayerError) ? (
    <Box sx={{ display: "grid", gap: 0.75, mt: 1 }}>
      {burialDataError && (
        <Box
          role="alert"
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Typography variant="body2" color="error">
            {burialDataError}
          </Typography>
          {onRetryBurialDataLoad && (
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={onRetryBurialDataLoad}
            >
              Try again
            </Button>
          )}
        </Box>
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
  ) : null;

  const headerContent = (
    <Box className="left-sidebar__header" sx={{ p: 1.75 }}>
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
            {devChip}
          </Box>
        </Box>
      </Box>

      {dataErrorContent}
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
  // The header is pinned by the sheet itself: the grabber, brand line, and
  // search field stay visible at every snap height while the body scrolls
  // underneath. The collapsed snap point equals this header's measured height,
  // so nothing in it can ever be clipped.
  const mobileSheetHeader = hasMobileLocationSelection ? (
    <Box className="mobile-location-header">
      <ButtonBase
        component="button"
        type="button"
        className="mobile-location-header__back"
        onClick={onClearSelectedBurials}
      >
        <ArrowBackIosNewIcon fontSize="small" />
        <span>Back to results</span>
      </ButtonBase>
      <Box className="mobile-location-header__copy">
        <Typography component="h2" className="mobile-location-header__title">
          {mobileLocationLabel || (mobileLocationRecordCount === 1
            ? "1 person at this plot"
            : `${mobileLocationRecordCount} people at this plot`)}
        </Typography>
        {mobileLocationLabel && (
          <Typography component="p" className="mobile-location-header__subtitle">
            {mobileLocationRecordCount === 1
              ? "1 person at this plot"
              : `${mobileLocationRecordCount} people at this plot`}
          </Typography>
        )}
      </Box>
    </Box>
  ) : (
    <Box className="mobile-sheet-header">
      <Box className="mobile-sheet-header__top">
        <Box
          component="a"
          href={APP_HOME_URL}
          className="mobile-sheet-header__brand"
        >
          <Typography component="span" className="mobile-sheet-header__title">
            {APP_HEADER_TITLE}
          </Typography>
          <Typography component="span" className="mobile-sheet-header__eyebrow">
            {APP_HEADER_EYEBROW}
          </Typography>
        </Box>
        {devChip}
        <Box className="mobile-sheet-header__actions">
          {mobileSearchPanelToggleButton}
          {mobileMoreButton}
        </Box>
      </Box>
      <BrowseSearchField
        browseQuery={browseQuery}
        burialDataError={burialDataError}
        isBrowsePending={isBrowsePending}
        isBurialDataLoading={isBurialDataLoading}
        onBrowseQueryChange={handleBrowseQueryChange}
        onClearBrowseQuery={handleClearBrowseQuery}
        onFocus={maximizeMobileSheet}
        onRequestBurialDataLoad={onRequestBurialDataLoad}
        searchPlaceholder={searchPlaceholder}
      />
      {dataErrorContent}
    </Box>
  );

  const mobileSheetBody = (
    <Box
      ref={(node) => {
        setSidebarRootNode(node);
        setSidebarScrollNode(node);
      }}
      className="left-sidebar__mobile-body"
      data-mobile-sheet-state={resolvedMobileSheetState}
    >
      {hasMobileLocationSelection ? selectedSummaryContent : bodyContent}
    </Box>
  );

  // Keep content dragging disabled so vertical lists own finger scrolling;
  // the sheet header and grabber remain the dedicated resize gesture.
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
      header={mobileSheetHeader}
      onSpringEnd={handleMobileSheetSpringEnd}
    >
      {mobileSheetBody}
    </BottomSheet>
  );
}

export default memo(BurialSidebar);
