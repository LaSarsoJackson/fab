import React from "react";
import {
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import MapIcon from "@mui/icons-material/Map";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

import { getSearchShellNoticeStyles } from "./sidebarPresentation";

/**
 * Presentational controls for the sidebar workspace. The parent owns state and
 * map actions; this module keeps repeated search/filter UI markup together.
 */
function SearchNoticeStack({ notices }) {
  return (
    <Box
      className="left-sidebar__notice-stack"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      sx={{
        display: "grid",
        gap: 0.75,
        mt: notices.length === 0 ? 0 : 1.2,
        maxHeight: notices.length === 0 ? 0 : 120,
        opacity: notices.length === 0 ? 0 : 1,
        overflow: "hidden",
        transition: "max-height 0.18s ease, opacity 0.16s ease, margin-top 0.18s ease",
      }}
    >
      {notices.map((notice) => {
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
  );
}

const getVisitTaskClassName = (isActive = false) => [
  "left-sidebar__visit-task",
  isActive ? "left-sidebar__visit-task--active" : "",
].filter(Boolean).join(" ");

const getMarkerToggleClassName = (showAllBurials = false) => [
  "left-sidebar__marker-toggle",
  showAllBurials ? "left-sidebar__marker-toggle--active" : "",
].filter(Boolean).join(" ");

export function BrowseSearchField({
  browseQuery,
  burialDataError,
  isBrowsePending,
  isBurialDataLoading,
  onBrowseQueryChange,
  onClearBrowseQuery,
  onFocus,
  onRequestBurialDataLoad,
  searchPlaceholder,
}) {
  return (
    <TextField
      fullWidth
      placeholder={searchPlaceholder}
      variant="outlined"
      size="small"
      value={browseQuery}
      error={Boolean(burialDataError)}
      onFocus={() => {
        onRequestBurialDataLoad?.();
        onFocus?.();
      }}
      onChange={onBrowseQueryChange}
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
                  onClick={onClearBrowseQuery}
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
  );
}

function VisitTaskSelector({
  browseSource,
  hasTourBrowse,
  onBrowseSourceChange,
}) {
  const taskSpecs = [
    hasTourBrowse ? {
      key: "tour",
      source: "tour",
      ariaLabel: "Start a Tour",
      label: "Tours",
      icon: <AltRouteIcon fontSize="small" />,
    } : null,
    {
      key: "section",
      source: "section",
      ariaLabel: "Explore Sections",
      label: "Sections",
      icon: <MapIcon fontSize="small" />,
    },
  ].filter(Boolean);

  return (
    <Box
      className="left-sidebar__visit-flow"
      role="group"
      aria-label="Choose visit task"
    >
      <Box className="left-sidebar__visit-tasks">
        {taskSpecs.map((task) => {
          const isActive = browseSource === task.source;

          return (
            <Button
              key={task.key}
              color="inherit"
              variant="text"
              aria-label={task.ariaLabel}
              aria-pressed={isActive}
              className={getVisitTaskClassName(isActive)}
              onClick={() => onBrowseSourceChange(task.source)}
              startIcon={task.icon}
            >
              <span className="left-sidebar__visit-task-copy">
                <span className="left-sidebar__visit-task-label">{task.label}</span>
              </span>
            </Button>
          );
        })}
      </Box>
    </Box>
  );
}

function BrowseToolbar({
  desktopMoreButton,
  hasGlobalResetState,
  isMobile,
  onClearAllBrowseState,
}) {
  if (!hasGlobalResetState && !desktopMoreButton) {
    return null;
  }

  return (
    <Box
      className="left-sidebar__browse-toolbar left-sidebar__browse-toolbar--utilities"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Box
        className="left-sidebar__browse-actions"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          width: isMobile ? "100%" : "auto",
        }}
      >
        {hasGlobalResetState && (
          <Button
            onClick={onClearAllBrowseState}
            variant="text"
            color="inherit"
            size="small"
            startIcon={<CloseIcon />}
            aria-label="Clear all browse filters"
          >
            Reset
          </Button>
        )}
      </Box>
      {desktopMoreButton}
    </Box>
  );
}

function SectionRefinementControls({
  filterType,
  isBurialDataLoading,
  isMobile,
  lotTierFilter,
  onFilterTypeSelection,
  onLotTierChange,
  onToggleSectionMarkers,
  sectionFilter,
  showAllBurials,
  burialDataError,
}) {
  if (!sectionFilter) {
    return null;
  }

  const markerToggleLabel = showAllBurials
    ? "Hide grave markers in this section"
    : "Show grave markers in this section";
  const markerToggleIcon = showAllBurials
    ? <VisibilityOffIcon fontSize="small" />
    : <VisibilityIcon fontSize="small" />;

  return (
    <Box sx={{ mt: 1.2 }}>
      <Button
        className={getMarkerToggleClassName(showAllBurials)}
        variant="text"
        color="inherit"
        size="small"
        onClick={onToggleSectionMarkers}
        startIcon={markerToggleIcon}
        aria-label={markerToggleLabel}
        aria-pressed={showAllBurials}
      >
        {showAllBurials ? "Hide graves" : "Show graves"}
      </Button>

      <Typography variant="subtitle2" className="left-sidebar__browse-detail-title" gutterBottom>
        Filter records
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
              onClick={() => onFilterTypeSelection("lot")}
            >
              Lot
            </Button>
            <Button
              variant={filterType === "tier" ? "contained" : "outlined"}
              onClick={() => onFilterTypeSelection("tier")}
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
          onChange={(event) => onLotTierChange(event.target.value)}
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
      </Box>
    </Box>
  );
}

function SectionBrowseControls({
  autocompleteComponentsProps,
  autocompleteListboxProps,
  burialDataError,
  filterType,
  hasSectionFilters,
  isBurialDataLoading,
  isMobile,
  lotTierFilter,
  onClearSectionFilters,
  onFilterTypeSelection,
  onLotTierChange,
  onSectionSelection,
  onToggleSectionMarkers,
  sectionFilter,
  selectedSectionOption,
  showAllBurials,
  uniqueSections,
}) {
  return (
    <Box
      className="left-sidebar__browse-detail left-sidebar__browse-detail--section"
      sx={{ p: isMobile ? 1.2 : 1.3 }}
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
            {sectionFilter ? "Focused on this section." : "Choose a section to zoom in."}
          </Typography>
        </Box>
        {hasSectionFilters && (
          <Button
            size="small"
            color="inherit"
            variant="text"
            className="left-sidebar__browse-detail-clear"
            onClick={onClearSectionFilters}
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
        onChange={(event, newValue) => onSectionSelection(newValue)}
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

      <SectionRefinementControls
        burialDataError={burialDataError}
        filterType={filterType}
        isBurialDataLoading={isBurialDataLoading}
        isMobile={isMobile}
        lotTierFilter={lotTierFilter}
        onFilterTypeSelection={onFilterTypeSelection}
        onLotTierChange={onLotTierChange}
        onToggleSectionMarkers={onToggleSectionMarkers}
        sectionFilter={sectionFilter}
        showAllBurials={showAllBurials}
      />
    </Box>
  );
}

function TourBrowseControls({
  autocompleteComponentsProps,
  autocompleteListboxProps,
  burialDataError,
  hasTourSelection,
  isBurialDataLoading,
  isMobile,
  onClearTourSelection,
  onTourSelection,
  selectedTourDefinition,
  tourDefinitions,
  tourLabel,
  tourStyles,
}) {
  return (
    <Box
      className="left-sidebar__browse-detail left-sidebar__browse-detail--tour"
      sx={{ p: isMobile ? 1.2 : 1.3 }}
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
            Choose {tourLabel.toLowerCase()}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.35, color: "var(--muted-text)" }}>
            Switch to one curated route when you want guided stops.
          </Typography>
        </Box>
        {hasTourSelection && (
          <Button
            size="small"
            color="inherit"
            variant="text"
            className="left-sidebar__browse-detail-clear"
            onClick={onClearTourSelection}
          >
            Clear
          </Button>
        )}
      </Box>
      <Autocomplete
        ListboxProps={autocompleteListboxProps}
        componentsProps={autocompleteComponentsProps}
        options={tourDefinitions}
        value={selectedTourDefinition}
        disabled={isBurialDataLoading || !!burialDataError}
        getOptionLabel={(option) => option.name}
        onChange={(event, newValue) => onTourSelection(newValue ? newValue.name : null)}
        renderInput={(params) => (
          <TextField
            {...params}
            label={tourLabel}
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
                backgroundColor: tourStyles[option.key]?.color,
                display: "inline-block",
              }}
            />
            {option.name}
          </li>
        )}
        isOptionEqualToValue={(option, value) => option.name === value.name}
      />
    </Box>
  );
}

function BrowseControlPanels({
  autocompleteComponentsProps,
  autocompleteListboxProps,
  burialDataError,
  filterType,
  hasSectionFilters,
  hasTourSelection,
  isBurialDataLoading,
  isMobile,
  isSectionBrowseVisible,
  isTourBrowseVisible,
  lotTierFilter,
  onClearSectionFilters,
  onClearTourSelection,
  onFilterTypeSelection,
  onLotTierChange,
  onSectionSelection,
  onToggleSectionMarkers,
  onTourSelection,
  searchShellNotices,
  sectionFilter,
  selectedSectionOption,
  selectedTourDefinition,
  showAllBurials,
  tourDefinitions,
  tourLabel,
  tourStyles,
  uniqueSections,
}) {
  return (
    <>
      <Box className="left-sidebar__browse-controls" sx={{ display: "grid", gap: 1.2 }}>
        {isSectionBrowseVisible && (
          <SectionBrowseControls
            autocompleteComponentsProps={autocompleteComponentsProps}
            autocompleteListboxProps={autocompleteListboxProps}
            burialDataError={burialDataError}
            filterType={filterType}
            hasSectionFilters={hasSectionFilters}
            isBurialDataLoading={isBurialDataLoading}
            isMobile={isMobile}
            lotTierFilter={lotTierFilter}
            onClearSectionFilters={onClearSectionFilters}
            onFilterTypeSelection={onFilterTypeSelection}
            onLotTierChange={onLotTierChange}
            onSectionSelection={onSectionSelection}
            onToggleSectionMarkers={onToggleSectionMarkers}
            sectionFilter={sectionFilter}
            selectedSectionOption={selectedSectionOption}
            showAllBurials={showAllBurials}
            uniqueSections={uniqueSections}
          />
        )}

        {isTourBrowseVisible && (
          <TourBrowseControls
            autocompleteComponentsProps={autocompleteComponentsProps}
            autocompleteListboxProps={autocompleteListboxProps}
            burialDataError={burialDataError}
            hasTourSelection={hasTourSelection}
            isBurialDataLoading={isBurialDataLoading}
            isMobile={isMobile}
            onClearTourSelection={onClearTourSelection}
            onTourSelection={onTourSelection}
            selectedTourDefinition={selectedTourDefinition}
            tourDefinitions={tourDefinitions}
            tourLabel={tourLabel}
            tourStyles={tourStyles}
          />
        )}
      </Box>

      <SearchNoticeStack notices={searchShellNotices} />
    </>
  );
}

export default function BrowseWorkspacePanel({
  autocompleteComponentsProps, autocompleteListboxProps,
  burialDataError, browseQuery,
  desktopMoreButton = null,
  filterType, hasGlobalResetState, hasSectionFilters, hasTourBrowse, hasTourSelection,
  isBrowsePending, isBurialDataLoading, isMobile, isSectionBrowseVisible, isTourBrowseVisible,
  lotTierFilter,
  onBrowseQueryChange, onBrowseSourceChange, onClearAllBrowseState, onClearBrowseQuery,
  onClearSectionFilters, onClearTourSelection, onFilterTypeSelection,
  onLotTierChange, onRequestBurialDataLoad, onSectionSelection,
  onToggleSectionMarkers, onTourSelection,
  priorityContent = null,
  resultsContent = null,
  searchPlaceholder, searchShellNotices = [],
  sectionFilter, selectedSectionOption, selectedTour, showAllBurials,
  showSearchField = true,
  surfaceSx = {},
  tourDefinitions = [], tourLabel = "Tour", tourStyles = {}, uniqueSections = [],
}) {
  const selectedTourDefinition = tourDefinitions.find((definition) => definition.name === selectedTour) || null;
  const shouldPromotePriorityContent = Boolean(priorityContent);
  // Once a grave is selected, keep that record ahead of search and filters so
  // the sidebar follows the user's current map focus.
  const inlinePriorityContent = shouldPromotePriorityContent ? null : priorityContent;
  // While a query is active on mobile, drop the visit-task shortcuts so results
  // land directly under the pinned search bar, the way Maps switches modes.
  const shouldShowVisitTasks = !shouldPromotePriorityContent
    && !(isMobile && browseQuery.trim());

  return (
    <Box
      className="left-sidebar__panel left-sidebar__panel--browse left-sidebar__panel--surface left-sidebar__browse-workspace"
      sx={{
        ...surfaceSx,
        p: isMobile ? 1.5 : 1.7,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Box
        className="left-sidebar__browse-composer left-sidebar__browse-composer--embedded"
        sx={{
          display: "grid",
          gap: 1.1,
        }}
      >
        {shouldPromotePriorityContent && (
          <Box
            className={[
              "left-sidebar__browse-priority",
              isMobile ? "left-sidebar__browse-priority--mobile" : "",
            ].filter(Boolean).join(" ")}
          >
            {priorityContent}
          </Box>
        )}

        {showSearchField && (
          <BrowseSearchField
            browseQuery={browseQuery}
            burialDataError={burialDataError}
            isBrowsePending={isBrowsePending}
            isBurialDataLoading={isBurialDataLoading}
            onBrowseQueryChange={onBrowseQueryChange}
            onClearBrowseQuery={onClearBrowseQuery}
            onRequestBurialDataLoad={onRequestBurialDataLoad}
            searchPlaceholder={searchPlaceholder}
          />
        )}

        {shouldShowVisitTasks && (
          <VisitTaskSelector
            browseSource={isTourBrowseVisible ? "tour" : isSectionBrowseVisible ? "section" : "all"}
            hasTourBrowse={hasTourBrowse}
            onBrowseSourceChange={onBrowseSourceChange}
          />
        )}

        <BrowseToolbar
          desktopMoreButton={desktopMoreButton}
          hasGlobalResetState={hasGlobalResetState}
          isMobile={isMobile}
          onClearAllBrowseState={onClearAllBrowseState}
        />

        <BrowseControlPanels
          autocompleteComponentsProps={autocompleteComponentsProps}
          autocompleteListboxProps={autocompleteListboxProps}
          burialDataError={burialDataError}
          filterType={filterType}
          hasSectionFilters={hasSectionFilters}
          hasTourSelection={hasTourSelection}
          isBurialDataLoading={isBurialDataLoading}
          isMobile={isMobile}
          isSectionBrowseVisible={isSectionBrowseVisible}
          isTourBrowseVisible={isTourBrowseVisible}
          lotTierFilter={lotTierFilter}
          onClearSectionFilters={onClearSectionFilters}
          onClearTourSelection={onClearTourSelection}
          onFilterTypeSelection={onFilterTypeSelection}
          onLotTierChange={onLotTierChange}
          onSectionSelection={onSectionSelection}
          onToggleSectionMarkers={onToggleSectionMarkers}
          onTourSelection={onTourSelection}
          searchShellNotices={searchShellNotices}
          sectionFilter={sectionFilter}
          selectedSectionOption={selectedSectionOption}
          selectedTourDefinition={selectedTourDefinition}
          showAllBurials={showAllBurials}
          tourDefinitions={tourDefinitions}
          tourLabel={tourLabel}
          tourStyles={tourStyles}
          uniqueSections={uniqueSections}
        />
      </Box>

      {(inlinePriorityContent || resultsContent) ? (
        <>
          <Divider className="left-sidebar__browse-workspace-divider" />
          {inlinePriorityContent ? (
            <Box className="left-sidebar__browse-priority" sx={{ mt: 1.2 }}>
              {inlinePriorityContent}
            </Box>
          ) : null}
          {inlinePriorityContent && resultsContent ? (
            <Divider className="left-sidebar__browse-workspace-divider" sx={{ mt: 1.2 }} />
          ) : null}
          {resultsContent ? (
            <Box sx={{ mt: inlinePriorityContent ? 1.2 : 0 }}>
              {resultsContent}
            </Box>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
