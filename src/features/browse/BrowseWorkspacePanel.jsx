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
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import PinDropIcon from "@mui/icons-material/PinDrop";

import { getSearchShellNoticeStyles } from "./sidebarPresentation";

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

export default function BrowseWorkspacePanel({
  autocompleteComponentsProps,
  autocompleteListboxProps,
  burialDataError,
  browseQuery,
  desktopMoreButton = null,
  filterType,
  hasGlobalResetState,
  hasSectionFilters,
  hasTourBrowse,
  hasTourSelection,
  isBrowsePending,
  isBurialDataLoading,
  isMobile,
  isSectionBrowseVisible,
  isTourBrowseVisible,
  lotTierFilter,
  onBrowseQueryChange,
  onBrowseSourceChange,
  onClearAllBrowseState,
  onClearBrowseQuery,
  onClearSectionFilters,
  onClearTourSelection,
  onFilterTypeSelection,
  onLocateUser,
  onLotTierChange,
  onRequestBurialDataLoad,
  onSectionSelection,
  onToggleSectionMarkers,
  onTourSelection,
  resultsContent = null,
  searchPlaceholder,
  searchShellNotices = [],
  sectionFilter,
  selectedSectionOption,
  selectedTour,
  showAllBurials,
  surfaceSx = {},
  tourDefinitions = [],
  tourLabel = "Tour",
  tourStyles = {},
  uniqueSections = [],
}) {
  const selectedTourDefinition = tourDefinitions.find((definition) => definition.name === selectedTour) || null;

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
              Search directly, or narrow the map with one section or one curated tour.
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

        <Box
          className="left-sidebar__browse-toolbar"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box
            aria-label="Browse the map"
            className="left-sidebar__browse-contexts"
            role="group"
            sx={{ flex: isMobile ? "1 1 100%" : "0 1 auto" }}
          >
            <Button
              color="inherit"
              variant="text"
              aria-pressed={isSectionBrowseVisible}
              className={[
                "left-sidebar__browse-context-button",
                isSectionBrowseVisible ? "left-sidebar__browse-context-button--active" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => onBrowseSourceChange("section")}
            >
              Sections
            </Button>
            {hasTourBrowse && (
              <Button
                color="inherit"
                variant="text"
                aria-pressed={isTourBrowseVisible}
                className={[
                  "left-sidebar__browse-context-button",
                  isTourBrowseVisible ? "left-sidebar__browse-context-button--active" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onBrowseSourceChange("tour")}
              >
                {`${tourLabel}s`}
              </Button>
            )}
          </Box>
          <Box
            className="left-sidebar__browse-actions"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 0.5,
              width: isMobile ? "100%" : "auto",
            }}
          >
            <Button
              onClick={onLocateUser}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<PinDropIcon />}
            >
              My location
            </Button>
            {hasGlobalResetState && (
              <Button
                onClick={onClearAllBrowseState}
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
        </Box>

        <Box className="left-sidebar__browse-controls" sx={{ display: "grid", gap: 1.2 }}>
          {isSectionBrowseVisible && (
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
                    Pick one section, then refine inside it.
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
                    <Button
                      className={[
                        "left-sidebar__marker-toggle",
                        showAllBurials ? "left-sidebar__marker-toggle--active" : "",
                      ].filter(Boolean).join(" ")}
                      variant="text"
                      color="inherit"
                      size="small"
                      onClick={onToggleSectionMarkers}
                      startIcon={showAllBurials ? <RemoveIcon /> : <AddIcon />}
                    >
                      {showAllBurials ? "Hide section markers" : "Show section markers"}
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {isTourBrowseVisible && (
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
          )}
        </Box>

        <SearchNoticeStack notices={searchShellNotices} />
      </Box>

      {resultsContent ? (
        <>
          <Divider className="left-sidebar__browse-workspace-divider" />
          {resultsContent}
        </>
      ) : null}
    </Box>
  );
}
