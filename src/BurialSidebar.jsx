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
import AppsIcon from "@mui/icons-material/Apps";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import DirectionsIcon from "@mui/icons-material/Directions";
import {
  buildBrowseResults,
  buildLocationSummary,
  formatBrowseResultName,
  getBrowseSourceMode,
  MIN_BROWSE_QUERY_LENGTH,
} from "./lib/browseResults";

const rowShellStyles = {
  cursor: "pointer",
  transition: "all 0.2s ease",
  borderRadius: 2,
  p: 1.5,
  contentVisibility: "auto",
  containIntrinsicSize: "88px",
};

const panelSurfaceStyles = {
  border: "1px solid rgba(18, 47, 40, 0.12)",
  backgroundColor: "rgba(255, 255, 255, 0.72)",
  borderRadius: 3,
};

const BROWSE_SOURCE_OPTIONS = [
  { key: "all", label: "All records" },
  { key: "section", label: "Section" },
  { key: "tour", label: "Tour" },
];

const MOBILE_RESULT_BATCH_SIZE = 40;
const DESKTOP_RESULT_BATCH_SIZE = 80;

const getBrowseSourceLabel = (browseSource) => {
  if (browseSource === "section") return "Section";
  if (browseSource === "tour") return "Tour";
  return "All records";
};

const getBrowseSourceChip = ({ browseSource }) => getBrowseSourceLabel(browseSource);

const getSearchPlaceholder = ({
  browseSource,
  isBurialDataLoading,
  sectionFilter,
  selectedTour,
}) => {
  if (isBurialDataLoading) {
    return "Loading burial records…";
  }

  if (browseSource === "section") {
    return sectionFilter ? "Search within this section…" : "Choose a section, then search within it…";
  }

  if (browseSource === "tour") {
    return selectedTour ? "Search within this tour…" : "Choose a tour, then search within it…";
  }

  return "Search all burial records…";
};

const getBrowseEmptyState = ({
  browseSource,
  query,
  sectionFilter,
  selectedTour,
  isCurrentTourLoading,
}) => {
  if (isCurrentTourLoading) {
    return "Loading tour stops…";
  }

  if (browseSource === "section" && !sectionFilter) {
    return "Choose a section to browse its burials.";
  }

  if (browseSource === "tour" && !selectedTour) {
    return "Choose a tour to browse its stops.";
  }

  if (browseSource === "all" && query.trim().length < MIN_BROWSE_QUERY_LENGTH) {
    return `Type at least ${MIN_BROWSE_QUERY_LENGTH} characters to search all burial records.`;
  }

  if (browseSource === "section") {
    return `No burials match Section ${sectionFilter}${query.trim() ? ` for "${query.trim()}"` : ""}.`;
  }

  if (browseSource === "tour") {
    return `No stops match ${selectedTour}${query.trim() ? ` for "${query.trim()}"` : ""}.`;
  }

  return `No records match "${query.trim()}".`;
};

function BrowseResultsPanel({
  activeBurialId,
  browseResults,
  browseSourceChip,
  browseSource,
  isExpanded,
  isMobile,
  isBrowsePending,
  isCurrentTourLoading,
  onBrowseResultSelect,
  onToggleExpanded,
  query,
  sectionFilter,
  selectedBurials,
  selectedTour,
  tourStyles,
}) {
  const emptyMessage = getBrowseEmptyState({
    browseSource,
    query,
    sectionFilter,
    selectedTour,
    isCurrentTourLoading,
  });
  const batchSize = isMobile ? MOBILE_RESULT_BATCH_SIZE : DESKTOP_RESULT_BATCH_SIZE;
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
  const hasMoreResults = visibleCount < browseResults.length;
  const isTrimmed = browseResults.length > batchSize;

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--browse left-sidebar__panel--surface"
      sx={{
        ...panelSurfaceStyles,
        p: 2,
        pb: isMobile ? 2.5 : 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
          Results
        </Typography>
        <Chip size="small" label={browseSourceChip} sx={{ maxWidth: "100%" }} />
        {browseResults.length > 0 && (
          <Chip
            size="small"
            variant="outlined"
            label={`${browseResults.length.toLocaleString()} result${browseResults.length === 1 ? "" : "s"}`}
          />
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
          {isBrowsePending && <CircularProgress size={14} />}
          <Button
            size="small"
            color="inherit"
            variant={isExpanded ? "text" : "outlined"}
            onClick={onToggleExpanded}
          >
            {isExpanded ? "Hide" : "Show"}
          </Button>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ color: "var(--muted-text)", mb: 1.25 }}>
        {browseResults.length
          ? isTrimmed
            ? `Showing ${visibleResults.length.toLocaleString()} of ${browseResults.length.toLocaleString()} result${browseResults.length === 1 ? "" : "s"}`
            : `${browseResults.length.toLocaleString()} result${browseResults.length === 1 ? "" : "s"}`
          : emptyMessage}
      </Typography>

      {isExpanded && browseResults.length > 0 && (
        <>
          <Box className="left-sidebar__results-scroll">
            <List disablePadding>
              {visibleResults.map((result) => {
                const isPinned = selectedBurialIds.has(result.id);
                const isActive = activeBurialId === result.id;
                const tourStyle = tourStyles[result.tourKey];

                return (
                  <ListItem key={result.id} disablePadding sx={{ display: "block", pb: 1 }}>
                    <Box
                      onClick={() => onBrowseResultSelect(result)}
                      sx={{
                        ...rowShellStyles,
                        border: isActive
                          ? "1px solid rgba(18, 94, 74, 0.35)"
                          : "1px solid rgba(18, 47, 40, 0.12)",
                        borderLeft: isActive
                          ? "4px solid var(--accent)"
                          : "4px solid transparent",
                        backgroundColor: isActive
                          ? "rgba(18, 94, 74, 0.08)"
                          : "rgba(255, 255, 255, 0.72)",
                        "&:hover": {
                          backgroundColor: isActive
                            ? "rgba(18, 94, 74, 0.12)"
                            : "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ lineHeight: 1.25 }}>
                        {formatBrowseResultName(result)}
                      </Typography>
                      {result.secondaryText && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {result.secondaryText}
                        </Typography>
                      )}
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                        {isActive && <Chip size="small" color="primary" label="Active" />}
                        {isPinned && !isActive && (
                          <Chip
                            size="small"
                            label="Pinned"
                            sx={{
                              backgroundColor: "rgba(18, 94, 74, 0.14)",
                              color: "var(--accent)",
                            }}
                          />
                        )}
                        {tourStyle && (
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
          {isTrimmed && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.25 }}>
              {hasMoreResults && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setVisibleCount((current) => Math.min(current + batchSize, browseResults.length))}
                >
                  Show {Math.min(batchSize, browseResults.length - visibleCount)} more
                </Button>
              )}
              {hasMoreResults && (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setVisibleCount(browseResults.length)}
                >
                  Show all
                </Button>
              )}
              {!hasMoreResults && visibleCount > batchSize && (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setVisibleCount(batchSize)}
                >
                  Collapse list
                </Button>
              )}
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
  hoveredIndex,
  isMobile,
  markerColors,
  onFocusSelectedBurial,
  onHoverIndexChange,
  onOpenDirectionsMenu,
  onRemoveSelectedBurial,
  selectedBurialRefs,
  selectedBurials,
  tourStyles,
}) {
  return (
    <List disablePadding>
      {selectedBurials.map((burial, index) => {
        const isActive = activeBurialId === burial.id;
        const isRouteActive = activeRouteBurialId === burial.id;
        const tourStyle = tourStyles[burial.tourKey];

        return (
          <ListItem key={burial.id} disablePadding sx={{ display: "block", pb: 1.5 }}>
            <Box
              ref={(node) => {
                if (node) {
                  selectedBurialRefs.current.set(burial.id, node);
                } else {
                  selectedBurialRefs.current.delete(burial.id);
                }
              }}
              onMouseEnter={() => onHoverIndexChange(index)}
              onMouseLeave={() => onHoverIndexChange(null)}
              onClick={() => onFocusSelectedBurial(burial)}
              sx={{
                ...rowShellStyles,
                border: isActive
                  ? "1px solid rgba(18, 94, 74, 0.35)"
                  : "1px solid rgba(18, 47, 40, 0.12)",
                borderLeft: isActive
                  ? "4px solid var(--accent)"
                  : "4px solid transparent",
                backgroundColor: isActive
                  ? "rgba(18, 94, 74, 0.08)"
                  : hoveredIndex === index
                    ? "rgba(0, 0, 0, 0.04)"
                    : "rgba(255, 255, 255, 0.72)",
                "&:hover": {
                  backgroundColor: isActive
                    ? "rgba(18, 94, 74, 0.12)"
                    : "rgba(0, 0, 0, 0.04)",
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box
                  sx={{
                    width: isActive || hoveredIndex === index ? "32px" : "24px",
                    height: isActive || hoveredIndex === index ? "32px" : "24px",
                    borderRadius: "50%",
                    backgroundColor: markerColors[index % markerColors.length],
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: isActive || hoveredIndex === index ? "16px" : "14px",
                    border: isActive || hoveredIndex === index ? "3px solid white" : "2px solid white",
                    boxShadow: isActive || hoveredIndex === index
                      ? "0 0 8px rgba(0,0,0,0.6)"
                      : "0 0 4px rgba(0,0,0,0.4)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {index + 1}
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
                            backgroundColor: "rgba(18, 94, 74, 0.14)",
                            color: "var(--accent)",
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
                  aria-label="remove"
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

function SelectedPeoplePanel({
  activeBurialId,
  activeRouteBurialId,
  hoveredIndex,
  isMobile,
  markerColors,
  onClearSelectedBurials,
  onFocusSelectedBurial,
  onHoverIndexChange,
  onOpenDirectionsMenu,
  onRemoveSelectedBurial,
  selectedBurialRefs,
  selectedBurials,
  tourStyles,
}) {
  if (selectedBurials.length === 0) return null;

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--selected left-sidebar__panel--surface"
      sx={{ ...panelSurfaceStyles, p: 2, pb: isMobile ? 2.5 : 2 }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5, mb: 1.25 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">Selected People</Typography>
          <Typography variant="body2" sx={{ color: "var(--muted-text)", mt: 0.5 }}>
            {selectedBurials.length === 1
              ? "Pinned for map focus and directions"
              : `${selectedBurials.length} people pinned for map focus and directions`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Chip size="small" color="primary" label={selectedBurials.length} />
          <IconButton onClick={onClearSelectedBurials} size="small" aria-label="clear selected people">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
      <SelectedPeopleList
        activeBurialId={activeBurialId}
        activeRouteBurialId={activeRouteBurialId}
        hoveredIndex={hoveredIndex}
        isMobile={isMobile}
        markerColors={markerColors}
        onFocusSelectedBurial={onFocusSelectedBurial}
        onHoverIndexChange={onHoverIndexChange}
        onOpenDirectionsMenu={onOpenDirectionsMenu}
        onRemoveSelectedBurial={onRemoveSelectedBurial}
        selectedBurialRefs={selectedBurialRefs}
        selectedBurials={selectedBurials}
        tourStyles={tourStyles}
      />
    </Box>
  );
}

function SelectedSummaryPanel({
  activeBurialId,
  activeRouteBurialId,
  hoveredIndex,
  isExpanded,
  markerColors,
  onClearSelectedBurials,
  onFocusSelectedBurial,
  onHoverIndexChange,
  onOpenDirectionsMenu,
  onRemoveSelectedBurial,
  onToggleExpanded,
  selectedBurialRefs,
  selectedBurials,
  tourStyles,
}) {
  if (selectedBurials.length === 0) return null;

  const leadBurial = selectedBurials.find((burial) => burial.id === activeBurialId) || selectedBurials[0];

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--selected-summary left-sidebar__panel--surface"
      sx={{ ...panelSurfaceStyles, p: 2 }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">Selected People</Typography>
          <Typography variant="body2" sx={{ color: "var(--muted-text)", mt: 0.5 }}>
            {selectedBurials.length === 1
              ? formatBrowseResultName(leadBurial)
              : `${selectedBurials.length} people pinned for map and directions`}
          </Typography>
        </Box>
        <Chip size="small" color="primary" label={selectedBurials.length} />
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
          {isExpanded ? "Hide" : "Show"}
        </Button>
        <Button size="small" color="inherit" onClick={onClearSelectedBurials}>
          Clear
        </Button>
      </Box>
      {isExpanded && (
        <Box sx={{ mt: 1.5 }}>
          <Divider sx={{ mb: 1.5 }} />
          <SelectedPeopleList
            activeBurialId={activeBurialId}
            activeRouteBurialId={activeRouteBurialId}
            hoveredIndex={hoveredIndex}
            isMobile
            markerColors={markerColors}
            onFocusSelectedBurial={onFocusSelectedBurial}
            onHoverIndexChange={onHoverIndexChange}
            onOpenDirectionsMenu={onOpenDirectionsMenu}
            onRemoveSelectedBurial={onRemoveSelectedBurial}
            selectedBurialRefs={selectedBurialRefs}
            selectedBurials={selectedBurials}
            tourStyles={tourStyles}
          />
        </Box>
      )}
    </Box>
  );
}

function BurialSidebar({
  activeBurialId,
  activeRouteBurialId,
  burialDataError,
  burialRecords,
  filterType,
  getTourName,
  hoveredIndex,
  initialQuery,
  installPromptEvent,
  isBurialDataLoading,
  isInstalled,
  isMobile,
  isOnline,
  isSearchIndexReady,
  loadingTourName,
  lotTierFilter,
  markerColors,
  onBrowseResultSelect,
  onClearSectionFilters,
  onClearSelectedBurials,
  onFilterTypeChange,
  onFocusSelectedBurial,
  onHoverIndexChange,
  onLocateMarker,
  onLotTierFilterChange,
  onOpenAppMenu,
  onOpenDirectionsMenu,
  onRemoveSelectedBurial,
  onSectionChange,
  onToggleSectionMarkers,
  onTourChange,
  searchIndex,
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
  const initialBrowseSource = useMemo(
    () => getBrowseSourceMode({ sectionFilter, selectedTour }),
    [sectionFilter, selectedTour]
  );
  const initialMobileContext = Boolean(
    (initialQuery || "").trim() || initialBrowseSource !== "all" || selectedBurials.length
  );
  const [browseSource, setBrowseSource] = useState(initialBrowseSource);
  const [browseQuery, setBrowseQuery] = useState(initialQuery || "");
  const [browseResults, setBrowseResults] = useState(() => (
    buildBrowseResults({
      browseSource: initialBrowseSource,
      query: initialQuery || "",
      burialRecords,
      searchIndex,
      getTourName,
      sectionFilter,
      lotTierFilter,
      filterType,
      selectedTour,
      tourResults,
    }).results
  ));
  const [isBrowsePending, setIsBrowsePending] = useState(false);
  const [isMobileSheetExpanded, setIsMobileSheetExpanded] = useState(
    () => isMobile && initialMobileContext
  );
  const [isResultsExpanded, setIsResultsExpanded] = useState(true);
  const [isSelectedSummaryExpanded, setIsSelectedSummaryExpanded] = useState(
    () => selectedBurials.length > 0
  );
  const previousSelectedCountRef = useRef(selectedBurials.length);
  const previousIsMobileRef = useRef(isMobile);
  const browseSourceChip = useMemo(
    () => getBrowseSourceChip({ browseSource }),
    [browseSource]
  );
  const hasActiveBrowseContext = useMemo(
    () => Boolean(browseQuery.trim() || lotTierFilter || sectionFilter || selectedTour || browseSource !== "all"),
    [browseQuery, browseSource, lotTierFilter, sectionFilter, selectedTour]
  );
  const isCurrentTourLoading = Boolean(
    selectedTour && loadingTourName === selectedTour && tourResults.length === 0
  );

  useEffect(() => {
    if (selectedTour) {
      setBrowseSource("tour");
      return;
    }

    if (sectionFilter) {
      setBrowseSource("section");
    }
  }, [sectionFilter, selectedTour]);

  useEffect(() => {
    setBrowseQuery(initialQuery || "");
  }, [initialQuery]);

  useEffect(() => {
    let cancelled = false;
    setIsBrowsePending(true);

    const buildResults = () => {
      const nextResults = buildBrowseResults({
        browseSource,
        query: browseQuery,
        burialRecords,
        searchIndex,
        getTourName,
        sectionFilter,
        lotTierFilter,
        filterType,
        selectedTour,
        tourResults,
      }).results;

      if (!cancelled) {
        setBrowseResults(nextResults);
        setIsBrowsePending(false);
      }
    };

    let handle;
    if ("requestIdleCallback" in window) {
      handle = window.requestIdleCallback(buildResults, { timeout: 250 });
    } else {
      handle = window.setTimeout(buildResults, 16);
    }

    return () => {
      cancelled = true;
      if ("cancelIdleCallback" in window && typeof handle === "number") {
        window.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, [
    browseSource,
    browseQuery,
    burialRecords,
    filterType,
    getTourName,
    lotTierFilter,
    searchIndex,
    sectionFilter,
    selectedTour,
    tourResults,
  ]);

  useEffect(() => {
    if (isMobile !== previousIsMobileRef.current && isMobile) {
      setIsMobileSheetExpanded(Boolean(selectedBurials.length || hasActiveBrowseContext));
      setIsSelectedSummaryExpanded(selectedBurials.length > 0);
    }

    previousIsMobileRef.current = isMobile;
  }, [hasActiveBrowseContext, isMobile, selectedBurials.length]);

  useEffect(() => {
    if (!isMobile) {
      previousSelectedCountRef.current = selectedBurials.length;
      return;
    }

    const previousCount = previousSelectedCountRef.current;

    if (selectedBurials.length > 0 && previousCount === 0) {
      setIsMobileSheetExpanded(true);
      setIsSelectedSummaryExpanded(true);
    } else if (selectedBurials.length === 0 && previousCount > 0) {
      setIsSelectedSummaryExpanded(false);
    }

    previousSelectedCountRef.current = selectedBurials.length;
  }, [isMobile, selectedBurials.length]);

  const expandMobileSheet = useCallback(() => {
    if (isMobile) {
      setIsMobileSheetExpanded(true);
    }
  }, [isMobile]);

  const collapseMobileSheet = useCallback(() => {
    if (isMobile) {
      setIsMobileSheetExpanded(false);
    }
  }, [isMobile]);

  const toggleSelectedSummary = useCallback(() => {
    setIsSelectedSummaryExpanded((current) => !current);
  }, []);

  const toggleResultsExpanded = useCallback(() => {
    setIsResultsExpanded((current) => !current);
  }, []);

  const handleBrowseQueryChange = useCallback((event) => {
    setBrowseQuery(event.target.value);
    setIsResultsExpanded(true);
    expandMobileSheet();
  }, [expandMobileSheet]);

  const handleClearBrowseQuery = useCallback(() => {
    setBrowseQuery("");
  }, []);

  const handleBrowseResultSelect = useCallback((result) => {
    onBrowseResultSelect(result);
    if (isMobile) {
      setIsMobileSheetExpanded(true);
      if (selectedBurials.length === 0) {
        setIsSelectedSummaryExpanded(true);
      }
    }
  }, [isMobile, onBrowseResultSelect, selectedBurials.length]);

  const handleSectionSelection = useCallback((nextSection) => {
    setBrowseSource("section");
    setIsResultsExpanded(true);
    onSectionChange(nextSection || "");
    expandMobileSheet();
  }, [expandMobileSheet, onSectionChange]);

  const handleToggleSectionMarkers = useCallback(() => {
    onToggleSectionMarkers();
    expandMobileSheet();
  }, [expandMobileSheet, onToggleSectionMarkers]);

  const handleFilterTypeSelection = useCallback((nextFilterType) => {
    setIsResultsExpanded(true);
    onFilterTypeChange(nextFilterType);
    expandMobileSheet();
  }, [expandMobileSheet, onFilterTypeChange]);

  const handleLotTierChange = useCallback((nextValue) => {
    setIsResultsExpanded(true);
    onLotTierFilterChange(nextValue);
    expandMobileSheet();
  }, [expandMobileSheet, onLotTierFilterChange]);

  const handleClearSectionFilters = useCallback(() => {
    onClearSectionFilters();
    expandMobileSheet();
  }, [expandMobileSheet, onClearSectionFilters]);

  const handleTourSelection = useCallback((tourName) => {
    setBrowseSource("tour");
    setIsResultsExpanded(true);
    onTourChange(tourName);
    expandMobileSheet();
  }, [expandMobileSheet, onTourChange]);

  const handleBrowseSourceChange = useCallback((nextSource) => {
    if (!nextSource || nextSource === browseSource) {
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
      expandMobileSheet();
      return;
    }

    if (sectionFilter || lotTierFilter) {
      onClearSectionFilters();
    }

    expandMobileSheet();
  }, [
    browseSource,
    expandMobileSheet,
    lotTierFilter,
    onClearSectionFilters,
    onTourChange,
    sectionFilter,
    selectedTour,
  ]);

  const handleLocateUser = useCallback(() => {
    onLocateMarker();
    expandMobileSheet();
  }, [expandMobileSheet, onLocateMarker]);

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
  }, [
    lotTierFilter,
    onClearSectionFilters,
    onClearSelectedBurials,
    onLotTierFilterChange,
    onTourChange,
    sectionFilter,
    selectedTour,
  ]);

  const handleClearLotTierFilter = useCallback(() => {
    onLotTierFilterChange("");
  }, [onLotTierFilterChange]);

  const activeBrowseChips = useMemo(() => {
    const chips = [];

    if (browseQuery.trim()) {
      chips.push({
        key: "query",
        label: `Search: ${browseQuery.trim()}`,
        onDelete: handleClearBrowseQuery,
        deleteTestId: "clear-query-chip",
      });
    }

    if (sectionFilter) {
      chips.push({
        key: "section",
        label: `Section ${sectionFilter}`,
        onDelete: handleClearSectionFilters,
        deleteTestId: "clear-section-chip",
      });
    }

    if (lotTierFilter) {
      chips.push({
        key: "lot-tier",
        label: `${filterType === "lot" ? "Lot" : "Tier"} ${lotTierFilter}`,
        onDelete: handleClearLotTierFilter,
        deleteTestId: "clear-lot-tier-chip",
      });
    }

    if (selectedTour) {
      chips.push({
        key: "tour",
        label: selectedTour,
        onDelete: () => onTourChange(null),
        deleteTestId: "clear-tour-chip",
      });
    }

    if (browseSource === "section" && !sectionFilter) {
      chips.push({
        key: "browse-source-section",
        label: "Browse: Section",
        onDelete: () => handleBrowseSourceChange("all"),
        deleteTestId: "clear-source-section-chip",
      });
    }

    if (browseSource === "tour" && !selectedTour) {
      chips.push({
        key: "browse-source-tour",
        label: "Browse: Tour",
        onDelete: () => handleBrowseSourceChange("all"),
        deleteTestId: "clear-source-tour-chip",
      });
    }

    return chips;
  }, [
    browseQuery,
    browseSource,
    filterType,
    handleClearBrowseQuery,
    handleBrowseSourceChange,
    handleClearLotTierFilter,
    handleClearSectionFilters,
    lotTierFilter,
    onTourChange,
    sectionFilter,
    selectedTour,
  ]);

  const showSidebarBody = !isMobile || isMobileSheetExpanded;
  const sidebarClassName = [
    "left-sidebar",
    isMobile ? "left-sidebar--mobile" : "left-sidebar--desktop",
    isMobile ? (isMobileSheetExpanded ? "left-sidebar--expanded" : "left-sidebar--collapsed") : "",
  ].filter(Boolean).join(" ");
  const autocompleteListboxProps = isMobile
    ? {
      sx: {
        maxHeight: 240,
      },
    }
    : undefined;
  const searchPlaceholder = getSearchPlaceholder({
    browseSource,
    isBurialDataLoading,
    sectionFilter,
    selectedTour,
  });

  const statusItems = [
    {
      key: "records",
      label: isBurialDataLoading
        ? "Loading records"
        : burialDataError
          ? "Record load failed"
          : isSearchIndexReady
            ? "Records ready"
            : "Indexing records",
      tone: burialDataError
        ? "#b04b3f"
        : (isBurialDataLoading || !isSearchIndexReady)
          ? "#9a6c19"
          : "var(--accent)",
    },
    {
      key: "connectivity",
      label: isOnline ? "Online" : "Offline",
      tone: isOnline ? "var(--accent)" : "#9a6c19",
    },
    ...(loadingTourName
      ? [{
        key: "tour",
        label: `Loading ${loadingTourName}`,
        tone: "#9a6c19",
      }]
      : []),
    ...((isInstalled || installPromptEvent || showIosInstallHint)
      ? [{
        key: "install",
        label: isInstalled ? "Installed" : "Install available",
        tone: isInstalled ? "var(--accent)" : "rgba(18, 94, 74, 0.72)",
      }]
      : []),
  ];
  const activeFilterCount = activeBrowseChips.length;

  const appMenuButton = (
    <Button
      variant="text"
      size="small"
      color="inherit"
      onClick={onOpenAppMenu}
      startIcon={<AppsIcon />}
      endIcon={<ArrowDropDownIcon />}
    >
      App
    </Button>
  );

  const activeBrowseChipsContent = activeBrowseChips.length > 0 && (
    <Box
      className="left-sidebar__panel left-sidebar__panel--active-filters left-sidebar__panel--surface"
      sx={{ ...panelSurfaceStyles, p: 2 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Active Filters</Typography>
        <Button
          size="small"
          color="inherit"
          onClick={handleClearAllBrowseState}
          aria-label="Clear all browse filters"
        >
          Clear all
        </Button>
      </Box>
      <Box className="left-sidebar__chip-row">
        {activeBrowseChips.map((chip) => (
          <Chip
            key={chip.key}
            size="small"
            label={chip.label}
            onDelete={chip.onDelete}
            deleteIcon={<CloseIcon data-testid={chip.deleteTestId} fontSize="small" />}
          />
        ))}
      </Box>
    </Box>
  );

  const browseToolsContent = (
    <Box className="left-sidebar__browse-controls" sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">Browse</Typography>
          <Typography variant="caption" sx={{ display: "block", color: "var(--muted-text)", mt: 0.5 }}>
            Refine the result source and map filters.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 0.75 }}>
          {activeFilterCount > 0 && (
            <Chip size="small" color="primary" label={`${activeFilterCount} active`} />
          )}
          <Chip size="small" variant="outlined" label={browseSourceChip} />
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Browse by
        </Typography>
        <ButtonGroup
          fullWidth
          size="small"
          aria-label="Browse source"
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            boxShadow: "none",
            borderRadius: 999,
            overflow: "hidden",
            border: "1px solid rgba(18, 47, 40, 0.12)",
            "& .MuiButton-root": {
              borderRadius: 0,
              border: "none",
              textTransform: "none",
              letterSpacing: 0,
              paddingBlock: 0.7,
            },
          }}
        >
          {BROWSE_SOURCE_OPTIONS.map((option) => (
            <Button
              key={option.key}
              aria-pressed={browseSource === option.key}
              variant={browseSource === option.key ? "contained" : "text"}
              onClick={() => handleBrowseSourceChange(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </ButtonGroup>
      </Box>

      {browseSource === "section" && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Choose section
          </Typography>
          <Autocomplete
            disablePortal={isMobile}
            ListboxProps={autocompleteListboxProps}
            options={uniqueSections}
            value={sectionFilter || null}
            disabled={isBurialDataLoading || !!burialDataError}
            onChange={(event, newValue) => handleSectionSelection(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Section"
                size="small"
                fullWidth
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                Section {option}
              </li>
            )}
            getOptionLabel={(option) => `Section ${option}`}
            isOptionEqualToValue={(option, value) => option === value}
          />
        </Box>
      )}

      {browseSource === "section" && sectionFilter && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
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
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={handleClearSectionFilters}
            >
              Clear section selection
            </Button>
          </Box>
        </Box>
      )}

      {browseSource === "tour" && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Choose tour
          </Typography>
          <Autocomplete
            disablePortal={isMobile}
            ListboxProps={autocompleteListboxProps}
            options={tourDefinitions}
            value={tourDefinitions.find((definition) => definition.name === selectedTour) || null}
            disabled={isBurialDataLoading || !!burialDataError}
            getOptionLabel={(option) => option.name}
            onChange={(event, newValue) => handleTourSelection(newValue ? newValue.name : null)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tour"
                size="small"
                fullWidth
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
  );

  const browseControlsPanel = (
    <Box
      className="left-sidebar__panel left-sidebar__panel--tools left-sidebar__panel--surface"
      sx={{
        ...panelSurfaceStyles,
        p: 2,
      }}
    >
      {browseToolsContent}
    </Box>
  );

  return (
    <Paper elevation={3} className={sidebarClassName}>
      <Box className="left-sidebar__header" sx={{ p: isMobile ? 1.5 : 2 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 1.25 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ display: "block", letterSpacing: 1.2, color: "var(--muted-text)", lineHeight: 1.1 }}
            >
              Albany Rural Cemetery
            </Typography>
            <Box
              component="a"
              href="https://www.albany.edu/arce/"
              sx={{ color: "inherit", display: "inline-block", textDecoration: "none", mt: 0.35 }}
            >
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                Burial Finder
              </Typography>
            </Box>
          </Box>

          {isMobile && (
            <Button
              size="small"
              color="inherit"
              variant={isMobileSheetExpanded ? "text" : "outlined"}
              onClick={isMobileSheetExpanded ? collapseMobileSheet : expandMobileSheet}
              endIcon={(
                <ArrowDropDownIcon
                  sx={{
                    transform: isMobileSheetExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              )}
            >
              {isMobileSheetExpanded ? "Collapse" : "Expand"}
          </Button>
        )}
        </Box>

        {burialDataError && (
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            {burialDataError}
          </Typography>
        )}
        {tourLayerError && (
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            {tourLayerError}
          </Typography>
        )}

        <Box
          className="left-sidebar__search-shell"
          sx={{
            mt: 1,
            p: 1.5,
            borderRadius: 3,
            border: "1px solid rgba(18, 47, 40, 0.12)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.84), rgba(255,255,255,0.72))",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 1.1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2">Search</Typography>
              <Typography variant="caption" sx={{ display: "block", color: "var(--muted-text)", mt: 0.4 }}>
                Find people, graves, sections, and tour stops.
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 0.75 }}>
              <Chip size="small" variant="outlined" label={browseSourceChip} />
              {selectedBurials.length > 0 && (
                <Chip size="small" color="primary" label={`${selectedBurials.length} selected`} />
              )}
            </Box>
          </Box>

          <TextField
            fullWidth
            placeholder={searchPlaceholder}
            variant="outlined"
            size="small"
            value={browseQuery}
            disabled={isBurialDataLoading || !!burialDataError}
            onChange={handleBrowseQueryChange}
            onClick={expandMobileSheet}
            onFocus={expandMobileSheet}
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
            className="left-sidebar__utility-row"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              mt: 1.25,
            }}
          >
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              <Button
                onClick={handleLocateUser}
                variant="text"
                color="inherit"
                size="small"
                startIcon={<PinDropIcon />}
              >
                My location
              </Button>
              {appMenuButton}
            </Box>
            <Typography variant="caption" sx={{ color: "var(--muted-text)" }}>
              {status}
            </Typography>
          </Box>

          <Box className="left-sidebar__status-line" sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
            {statusItems.map((item) => (
              <Box
                key={item.key}
                className="left-sidebar__status-item"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1,
                  py: 0.55,
                  borderRadius: 999,
                  backgroundColor: "rgba(255, 255, 255, 0.62)",
                  border: "1px solid rgba(18, 47, 40, 0.08)",
                }}
              >
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: item.tone,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="caption" sx={{ color: "var(--muted-text)" }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {!isInstalled && showIosInstallHint && (
            <Typography variant="caption" sx={{ display: "block", color: "var(--muted-text)", mt: 1 }}>
              <InstallMobileIcon fontSize="inherit" sx={{ verticalAlign: "text-bottom", mr: 0.5 }} />
              Safari: Share → Add to Home Screen
            </Typography>
          )}

          {isMobile && !isMobileSheetExpanded && (
            <Box className="left-sidebar__compact-meta" sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.25 }}>
              {selectedBurials.length > 0 && (
                <Chip size="small" color="primary" label={`${selectedBurials.length} selected`} />
              )}
              {hasActiveBrowseContext && activeBrowseChips.map((chip) => (
                <Chip key={`compact-${chip.key}`} size="small" label={chip.label} />
              ))}
              {!hasActiveBrowseContext && selectedBurials.length === 0 && (
                <Chip size="small" label={browseSourceChip} />
              )}
            </Box>
          )}
        </Box>
      </Box>

      {showSidebarBody && <Divider />}

      {showSidebarBody && (
        <Box
          className={`left-sidebar__body ${isMobile ? "left-sidebar__body--mobile" : ""}`}
          sx={{ minHeight: 0, overflow: "auto", flex: 1 }}
        >
          <Box sx={{ p: 1.5, display: "grid", gap: 1.5 }}>
            {browseControlsPanel}

            {activeBrowseChipsContent}

            {selectedBurials.length > 0 && (
              isMobile ? (
                <SelectedSummaryPanel
                  activeBurialId={activeBurialId}
                  activeRouteBurialId={activeRouteBurialId}
                  hoveredIndex={hoveredIndex}
                  isExpanded={isSelectedSummaryExpanded}
                  markerColors={markerColors}
                  onClearSelectedBurials={onClearSelectedBurials}
                  onFocusSelectedBurial={onFocusSelectedBurial}
                  onHoverIndexChange={onHoverIndexChange}
                  onOpenDirectionsMenu={onOpenDirectionsMenu}
                  onRemoveSelectedBurial={onRemoveSelectedBurial}
                  onToggleExpanded={toggleSelectedSummary}
                  selectedBurialRefs={selectedBurialRefs}
                  selectedBurials={selectedBurials}
                  tourStyles={tourStyles}
                />
              ) : (
                <SelectedPeoplePanel
                  activeBurialId={activeBurialId}
                  activeRouteBurialId={activeRouteBurialId}
                  hoveredIndex={hoveredIndex}
                  isMobile={isMobile}
                  markerColors={markerColors}
                  onClearSelectedBurials={onClearSelectedBurials}
                  onFocusSelectedBurial={onFocusSelectedBurial}
                  onHoverIndexChange={onHoverIndexChange}
                  onOpenDirectionsMenu={onOpenDirectionsMenu}
                  onRemoveSelectedBurial={onRemoveSelectedBurial}
                  selectedBurialRefs={selectedBurialRefs}
                  selectedBurials={selectedBurials}
                  tourStyles={tourStyles}
                />
              )
            )}

            <BrowseResultsPanel
              activeBurialId={activeBurialId}
              browseResults={browseResults}
              browseSourceChip={browseSourceChip}
              browseSource={browseSource}
              isExpanded={isResultsExpanded}
              isBrowsePending={isBrowsePending}
              isCurrentTourLoading={isCurrentTourLoading}
              isMobile={isMobile}
              onBrowseResultSelect={handleBrowseResultSelect}
              onToggleExpanded={toggleResultsExpanded}
              query={browseQuery}
              sectionFilter={sectionFilter}
              selectedBurials={selectedBurials}
              selectedTour={selectedTour}
              tourStyles={tourStyles}
            />
          </Box>
        </Box>
      )}
    </Paper>
  );
}

export default memo(BurialSidebar);
