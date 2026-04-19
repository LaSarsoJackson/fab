export const formatLocationNoticeLabel = ({
  status,
  activeStatus,
  locatingStatus,
}) => {
  if (status === activeStatus) {
    return "Using your current location for directions.";
  }

  if (status === locatingStatus) {
    return "Finding your location…";
  }

  return status;
};

export const getLocationNoticeTone = ({
  status,
  activeStatus,
  locatingStatus,
}) => {
  if (status === activeStatus) return "success";
  if (status === locatingStatus) return "neutral";
  return "warning";
};

export const getSearchShellNoticeStyles = (tone) => {
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

export const buildSearchShellNotices = ({
  burialRecordCount = 0,
  defaultLocationStatus = "Location inactive",
  activeLocationStatus = "Location active",
  locatingLocationStatus = "Locating...",
  isBurialDataLoading,
  isInstalled,
  isOnline,
  isSearchIndexReady,
  loadingTourName,
  showIosInstallHint,
  status,
}) => {
  const notices = [];
  const normalizedStatus = String(status || "").trim();

  if (normalizedStatus && normalizedStatus !== defaultLocationStatus) {
    notices.push({
      key: "location",
      tone: getLocationNoticeTone({
        status: normalizedStatus,
        activeStatus: activeLocationStatus,
        locatingStatus: locatingLocationStatus,
      }),
      label: formatLocationNoticeLabel({
        status: normalizedStatus,
        activeStatus: activeLocationStatus,
        locatingStatus: locatingLocationStatus,
      }),
    });
  }

  if (!isOnline) {
    notices.push({
      key: "offline",
      tone: "warning",
      label: "Offline. Search stays available, but live links may be limited.",
    });
  } else if (isBurialDataLoading) {
    notices.push({
      key: "records-loading",
      tone: "neutral",
      label: "Loading burials…",
    });
  } else if (burialRecordCount > 0 && !isSearchIndexReady) {
    notices.push({
      key: "search-readying",
      tone: "neutral",
      label: "Preparing fast search…",
    });
  } else if (loadingTourName) {
    notices.push({
      key: "tour-loading",
      tone: "neutral",
      label: `Loading ${loadingTourName}…`,
    });
  }

  if (!isInstalled && showIosInstallHint) {
    notices.push({
      key: "install",
      tone: "neutral",
      label: "Safari: Share → Add to Home Screen",
    });
  }

  return notices.slice(0, 2);
};

export const getSearchPlaceholder = ({
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

export const getBrowseEmptyState = ({
  browseSource,
  isBurialDataLoading,
  isCurrentTourLoading,
  minBrowseQueryLength = 2,
  query,
  sectionFilter,
  selectedTour,
  tourLabel = "Tour",
}) => {
  if (isBurialDataLoading && browseSource !== "tour") {
    return "Loading burials…";
  }

  if (isCurrentTourLoading) {
    return "Loading tour stops…";
  }

  if (browseSource === "section" && !sectionFilter) {
    return "Choose a section above.";
  }

  if (browseSource === "tour" && !selectedTour) {
    return `Choose a ${tourLabel.toLowerCase()} above.`;
  }

  if (browseSource === "all" && query.trim().length < minBrowseQueryLength) {
    return `Type at least ${minBrowseQueryLength} characters to search.`;
  }

  if (browseSource === "section") {
    return `No results in Section ${sectionFilter}${query.trim() ? ` for "${query.trim()}"` : ""}.`;
  }

  if (browseSource === "tour") {
    return `No results in ${selectedTour}${query.trim() ? ` for "${query.trim()}"` : ""}.`;
  }

  return `No results for "${query.trim()}".`;
};

export const buildBrowseScopeChips = ({
  browseSource,
  filterType,
  lotTierFilter,
  sectionFilter,
  selectedTour,
  showAllBurials,
}) => {
  const accentChipSx = {
    backgroundColor: "var(--accent-soft)",
    color: "var(--accent-strong)",
    borderColor: "rgba(47, 107, 87, 0.12)",
  };

  if (browseSource === "section") {
    if (!sectionFilter) {
      return [];
    }

    const chips = [
      { key: "scope", label: `Section ${sectionFilter}`, sx: accentChipSx },
    ];

    if (lotTierFilter) {
      chips.push({
        key: "detail",
        label: `${filterType === "tier" ? "Tier" : "Lot"} ${lotTierFilter}`,
      });
    }

    if (showAllBurials) {
      chips.push({ key: "markers", label: "Markers visible" });
    }

    return chips;
  }

  if (browseSource === "tour") {
    if (!selectedTour) {
      return [];
    }

    return [
      { key: "scope", label: selectedTour, sx: accentChipSx },
    ];
  }

  return [];
};

export const buildBrowseEmptyActionSpecs = ({
  browseResultCount,
  browseSource,
  hasMinimumBrowseQuery,
  isCurrentTourLoading,
  sectionFilter,
  selectedTour,
  tourLabel = "Tour",
}) => {
  if (browseResultCount > 0 || isCurrentTourLoading) {
    return [];
  }

  if (browseSource === "all") {
    if (!hasMinimumBrowseQuery) {
      return [];
    }

    return [
      {
        key: "clear-search",
        action: "clear-search",
        label: "Clear search",
        variant: "contained",
      },
    ];
  }

  if (browseSource === "section") {
    if (!sectionFilter) {
      return [];
    }

    const actions = [];

    if (hasMinimumBrowseQuery) {
      actions.push({
        key: "clear-search",
        action: "clear-search",
        label: "Clear search",
        variant: "contained",
      });
    }

    actions.push({
      key: "reset-section",
      action: "reset-section",
      label: "Choose another section",
      variant: hasMinimumBrowseQuery ? "text" : "contained",
    });

    return actions;
  }

  if (browseSource === "tour") {
    if (!selectedTour) {
      return [];
    }

    const actions = [];

    if (hasMinimumBrowseQuery) {
      actions.push({
        key: "clear-search",
        action: "clear-search",
        label: "Clear search",
        variant: "contained",
      });
    }

    actions.push({
      key: "change-tour",
      action: "change-tour",
      label: `Choose another ${tourLabel.toLowerCase()}`,
      variant: hasMinimumBrowseQuery ? "text" : "contained",
    });

    return actions;
  }

  return [];
};

export const buildLifeDatesSummary = (record = {}) => (
  [record.Birth && `Born ${record.Birth}`, record.Death && `Died ${record.Death}`]
    .filter(Boolean)
    .join(" • ")
);
