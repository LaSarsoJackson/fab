/** @jest-environment jsdom */

import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import BurialSidebar from "./BurialSidebar";
import { APP_PROFILE } from "./features/fab/profile";
import { buildBurialBrowseResult } from "./features/browse/browseResults";
import { buildSearchIndex } from "./features/browse/burialSearch";

const mockBottomSheetState = { currentHeight: 0, lastProps: null, snapTo: jest.fn() };

jest.mock("react-spring-bottom-sheet", () => {
  const React = require("react");

  return {
    BottomSheet: React.forwardRef(function MockBottomSheet(props, ref) {
      mockBottomSheetState.lastProps = props;

      React.useImperativeHandle(ref, () => ({
        get height() {
          return mockBottomSheetState.currentHeight;
        },
        snapTo: mockBottomSheetState.snapTo,
      }), []);

      return (
        <div data-testid="mock-bottom-sheet" data-rsbs-overlay>
          <div data-testid="mock-bottom-sheet-header">{props.header}</div>
          <div data-testid="mock-bottom-sheet-body">{props.children}</div>
        </div>
      );
    }),
  };
});

const getTourName = (record) => {
  if (record.title === "Notable") return "Notables Tour 2020";
  return "";
};

const burialRecords = [
  buildBurialBrowseResult(
    {
      properties: {
        OBJECTID: 1,
        First_Name: "Anna",
        Last_Name: "Tracy",
        Section: "99",
        Lot: "18",
        Tier: "0",
        Grave: "0",
        Birth: "12/2/1858",
        Death: "1/28/1945",
      },
      geometry: {
        coordinates: [-73.733659, 42.711919],
      },
    },
    { getTourName }
  ),
  buildBurialBrowseResult(
    {
      properties: {
        OBJECTID: 2,
        First_Name: "Thomas",
        Last_Name: "Tracy",
        Section: "99",
        Lot: "18",
        Tier: "0",
        Grave: "1",
        Birth: "7/12/1855",
        Death: "4/23/1926",
      },
      geometry: {
        coordinates: [-73.73366, 42.71192],
      },
    },
    { getTourName }
  ),
];

const createBaseProps = () => ({
  activeBurialId: null,
  activeRouteBurialId: null,
  burialDataError: "",
  burialRecords,
  burialRecordsById: new Map(burialRecords.map((record) => [record.id, record])),
  fieldPacket: null,
  fieldPacketNotice: null,
  filterType: "lot",
  getTourName,
  hoveredBurialId: null,
  initialQuery: "",
  installPromptEvent: null,
  isFieldPacketsEnabled: true,
  isBurialDataLoading: false,
  isInstalled: false,
  isMobile: false,
  isOnline: true,
  isSearchIndexReady: true,
  iosAppStoreUrl: "",
  loadingTourName: "",
  lotTierFilter: "",
  markerColors: ["#e41a1c", "#377eb8"],
  onBrowseResultSelect: jest.fn(),
  onClearSectionFilters: jest.fn(),
  onClearSelectedBurials: jest.fn(),
  onFilterTypeChange: jest.fn(),
  onFocusSelectedBurial: jest.fn(),
  onHoverBurialChange: jest.fn(),
  onOpenExternalDirections: jest.fn(),
  onLocateMarker: jest.fn(),
  onLotTierFilterChange: jest.fn(),
  onClearFieldPacket: jest.fn(),
  onCopyFieldPacketLink: jest.fn(),
  onInstallApp: jest.fn(),
  onOpenAppMenu: jest.fn(),
  onOpenDirectionsMenu: jest.fn(),
  onMobileSheetViewportChange: jest.fn(),
  onRemoveSelectedBurial: jest.fn(),
  onSectionChange: jest.fn(),
  onShareFieldPacket: jest.fn(),
  onStartRouting: jest.fn(),
  onStopRouting: jest.fn(),
  onToggleSectionMarkers: jest.fn(),
  onTourChange: jest.fn(),
  onUpdateFieldPacket: jest.fn(),
  searchIndex: buildSearchIndex(burialRecords, { getTourName }),
  sectionFilter: "",
  selectedBurialRefs: { current: new Map() },
  selectedBurials: [],
  selectedTour: "",
  showAllBurials: false,
  showIosInstallHint: false,
  sharedLinkLandingState: null,
  status: "Location inactive",
  tourDefinitions: [{ key: "Notable", name: "Notables Tour 2020" }],
  tourLayerError: "",
  tourResults: [],
  tourStyles: {
    Notable: { name: "Notables Tour 2020", color: "#ff7700" },
  },
  uniqueSections: ["99"],
});

const domTest = typeof document === "undefined" ? test.skip : test;

const flushBrowseTimers = () => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
};

const getCurrentMobileSheetSnap = (maxHeight = 1000) => {
  const { defaultSnap, snapPoints } = mockBottomSheetState.lastProps;
  const resolvedSnapPoints = snapPoints({ maxHeight });
  return defaultSnap({ maxHeight, snapPoints: resolvedSnapPoints });
};

const renderSidebar = (props = {}) => render(<BurialSidebar {...createBaseProps()} {...props} />);

describe("BurialSidebar", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockBottomSheetState.currentHeight = 0;
    mockBottomSheetState.lastProps = null;
    mockBottomSheetState.snapTo.mockReset();
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: query === "(prefers-reduced-motion: reduce)" ? false : false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    mockBottomSheetState.currentHeight = 0;
    mockBottomSheetState.lastProps = null;
    mockBottomSheetState.snapTo.mockReset();
    jest.clearAllMocks();
  });

  domTest("updates the query immediately, filters results synchronously, and selects a result row", () => {
    const onBrowseResultSelect = jest.fn();

    renderSidebar({
      onBrowseResultSelect,
      sectionFilter: "99",
      showAllBurials: true,
    });

    flushBrowseTimers();

    expect(screen.getByText("Anna Tracy")).toBeInTheDocument();
    expect(screen.getByText("Thomas Tracy")).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Search this section/i);
    fireEvent.change(input, { target: { value: "anna" } });

    expect(input).toHaveValue("anna");
    expect(screen.getByText("Anna Tracy")).toBeInTheDocument();
    expect(screen.queryByText("Thomas Tracy")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Anna Tracy"));

    expect(onBrowseResultSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Anna Tracy",
        Section: "99",
        Lot: "18",
      })
    );
  });

  domTest("shows section browse results when a section is selected after initial render", () => {
    const { rerender } = renderSidebar();

    expect(screen.getByPlaceholderText(/Search by name, section, or lot/i)).toBeInTheDocument();
    expect(screen.queryByText("Anna Tracy")).not.toBeInTheDocument();

    rerender(
      <BurialSidebar
        {...createBaseProps()}
        sectionFilter="99"
        showAllBurials
      />
    );
    flushBrowseTimers();

    expect(screen.getByRole("button", { name: "Sections" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText(/Search this section/i)).toBeInTheDocument();

    const browseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");
    expect(within(browseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);
    expect(within(browseWorkspace).getAllByText("Thomas Tracy").length).toBeGreaterThan(0);
  });

  domTest("supports mobile query entry and clearing from the search field without forcing drawer expansion", () => {
    renderSidebar({ isMobile: true });

    expect(screen.getByRole("button", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tours" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Section" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by name, section, or lot/i)).toBeInTheDocument();
    expect(screen.queryByText("Start with a section")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More options" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My location" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Clear all browse filters")).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Search by name, section, or lot/i);
    fireEvent.focus(input);

    fireEvent.change(input, { target: { value: "anna" } });
    flushBrowseTimers();

    expect(screen.queryByText("Search: anna")).not.toBeInTheDocument();
    expect(screen.getByText("Anna Tracy")).toBeInTheDocument();
    expect(screen.queryByText("Thomas Tracy")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Clear search query"));

    expect(input).toHaveValue("");
    const snapHeights = mockBottomSheetState.snapTo.mock.calls.map((call) => (
      call[0]({ maxHeight: 1000 })
    ));
    expect(snapHeights.every((height) => height <= 80)).toBe(true);
  });

  domTest("lets mobile users collapse and reopen the search panel", () => {
    renderSidebar({ isMobile: true });

    fireEvent.click(screen.getByRole("button", { name: "Hide search panel" }));
    expect(mockBottomSheetState.snapTo).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetState.snapTo.mock.calls[0][0]({ maxHeight: 1000 })).toBeCloseTo(80);

    fireEvent.click(screen.getByRole("button", { name: "Show search panel" }));
    expect(mockBottomSheetState.snapTo).toHaveBeenCalledTimes(2);
    expect(mockBottomSheetState.snapTo.mock.calls[1][0]({ maxHeight: 1000 })).toBeCloseTo(500);
  });

  domTest("lets the map shell fully hide mobile chrome when that control is available", () => {
    const onRequestHideChrome = jest.fn();
    renderSidebar({ isMobile: true, onRequestHideChrome });

    fireEvent.click(screen.getByRole("button", { name: "Hide search panel" }));

    expect(onRequestHideChrome).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetState.snapTo).not.toHaveBeenCalled();
  });

  domTest("shows actionable GPS guidance when location is unavailable", () => {
    renderSidebar({
      status: APP_PROFILE.map.locationMessages.unavailable,
    });

    flushBrowseTimers();

    expect(screen.getByText(/GPS is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/search by name or section/i)).toBeInTheDocument();
  });

  domTest("expands the mobile drawer from the collapsed browse shell when a point selection arrives", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({ isMobile: true });

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(80);

    rerender(
      <BurialSidebar
        {...rerenderProps}
        isMobile
        activeBurialId={burialRecords[0].id}
        selectedBurials={[burialRecords[0]]}
      />
    );

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(500);
    expect(mockBottomSheetState.snapTo).toHaveBeenCalledTimes(1);
  });

  domTest("re-expands a collapsed mobile drawer when a map selection arrives", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({ isMobile: true });

    act(() => {
      mockBottomSheetState.currentHeight = 80;
      mockBottomSheetState.lastProps.onSpringEnd({ type: "SNAP" });
    });

    mockBottomSheetState.snapTo.mockReset();

    rerender(
      <BurialSidebar
        {...rerenderProps}
        isMobile
        activeBurialId={burialRecords[0].id}
        selectedBurials={[burialRecords[0]]}
      />
    );

    expect(mockBottomSheetState.snapTo.mock.calls.length).toBeLessThanOrEqual(1);
    expect(getCurrentMobileSheetSnap()).toBeCloseTo(500);
  });

  domTest("keeps map-driven section browse at mobile peek height", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({ isMobile: true });

    act(() => {
      mockBottomSheetState.currentHeight = 80;
      mockBottomSheetState.lastProps.onSpringEnd({ type: "SNAP" });
    });

    mockBottomSheetState.snapTo.mockReset();

    rerender(
      <BurialSidebar
        {...rerenderProps}
        isMobile
        sectionFilter="99"
        showAllBurials
      />
    );

    expect(mockBottomSheetState.snapTo.mock.calls.length).toBeLessThanOrEqual(1);
    expect(getCurrentMobileSheetSnap()).toBeCloseTo(500);
  });

  domTest("uses direct mobile preview actions for routing and external maps", () => {
    const onStartRouting = jest.fn();
    const onOpenExternalDirections = jest.fn();

    renderSidebar({
      isMobile: true,
      activeBurialId: burialRecords[0].id,
      selectedBurials: [burialRecords[0]],
      onStartRouting,
      onOpenExternalDirections,
    });

    const selectedSummary = screen.getByText("Selection").closest(".left-sidebar__panel");

    fireEvent.click(within(selectedSummary).getByRole("button", { name: "Route on map" }));
    fireEvent.click(within(selectedSummary).getByRole("button", { name: "Open in Maps" }));

    expect(onStartRouting).toHaveBeenCalledWith(expect.objectContaining({ id: burialRecords[0].id }));
    expect(onOpenExternalDirections).toHaveBeenCalledWith(expect.objectContaining({ id: burialRecords[0].id }));
  });

  domTest("renders tour portrait media in the compact mobile selection card", () => {
    const selectedTourRecord = {
      ...burialRecords[0],
      id: "tour:Notable:1:99:18",
      source: "tour",
      title: "Notable",
      tourKey: "Notable",
      tourName: "Notables Tour 2020",
      portraitImageName: "Schuyler70a.jpg",
      biographyLink: "Schuyler70",
    };

    renderSidebar({
      isMobile: true,
      activeBurialId: selectedTourRecord.id,
      selectedBurials: [selectedTourRecord],
    });

    const selectedSummary = screen.getByText("Selection").closest(".left-sidebar__panel");
    const portrait = within(selectedSummary).getByAltText("Anna Tracy portrait");

    expect(within(selectedSummary).getByText("Tap the image to open the ARCE biography.")).toBeInTheDocument();
    expect(portrait).toHaveAttribute("src", expect.stringContaining("Schuyler70a.jpg"));
    expect(within(selectedSummary).getByRole("link", { name: "Anna Tracy portrait" })).toHaveAttribute(
      "href",
      "https://www.albany.edu/arce/Schuyler70.html"
    );
  });

  domTest("renders small portrait thumbnails inline for tour browse rows", () => {
    const tourRecord = {
      ...burialRecords[0],
      id: "tour:Notable:1:99:18",
      source: "tour",
      title: "Notable",
      tourKey: "Notable",
      tourName: "Notables Tour 2020",
      portraitImageName: "Schuyler70a.jpg",
      biographyLink: "Schuyler70",
    };

    renderSidebar({
      isMobile: true,
      selectedTour: "Notables Tour 2020",
      tourResults: [tourRecord],
    });

    flushBrowseTimers();

    const browseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");
    const resultCard = within(browseWorkspace).getByText("Anna Tracy").closest(".left-sidebar__result-card");
    const thumbnail = resultCard.querySelector(".left-sidebar__result-thumbnail-image");

    expect(resultCard.querySelector(".left-sidebar__result-card-layout--with-thumbnail")).not.toBeNull();
    expect(thumbnail).not.toBeNull();
    expect(thumbnail).toHaveAttribute("src", expect.stringContaining("Schuyler70a.jpg"));
  });

  domTest("keeps the mobile drawer at peek when a browse result is selected", () => {
    const onBrowseResultSelect = jest.fn();

    renderSidebar({
      isMobile: true,
      onBrowseResultSelect,
      sectionFilter: "99",
      showAllBurials: true,
    });

    flushBrowseTimers();

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(500);

    fireEvent.click(screen.getByText("Anna Tracy"));

    expect(onBrowseResultSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Anna Tracy",
        Section: "99",
        Lot: "18",
      })
    );
    expect(getCurrentMobileSheetSnap()).toBeCloseTo(500);
  });

  domTest("keeps the section results visible when a point selection arrives on mobile", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({
      isMobile: true,
      sectionFilter: "99",
      showAllBurials: true,
    });

    const browseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");
    expect(within(browseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);

    rerender(
      <BurialSidebar
        {...rerenderProps}
        isMobile
        sectionFilter="99"
        showAllBurials
        activeBurialId={burialRecords[0].id}
        selectedBurials={[burialRecords[0]]}
      />
    );

    const nextBrowseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");
    expect(within(nextBrowseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);
    expect(getCurrentMobileSheetSnap()).toBeCloseTo(500);
  });

  domTest("uses contextual clear controls without duplicating browse state", () => {
    const onClearSectionFilters = jest.fn();
    const onClearSelectedBurials = jest.fn();
    const onLotTierFilterChange = jest.fn();
    const onTourChange = jest.fn();

    renderSidebar({
      initialQuery: "anna",
      sectionFilter: "99",
      lotTierFilter: "18",
      selectedTour: "",
      showAllBurials: true,
      onClearSectionFilters,
      onClearSelectedBurials,
      onLotTierFilterChange,
      onTourChange,
    });

    flushBrowseTimers();

    expect(screen.queryByText("Search: anna")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Section" })).toHaveValue("Section 99");
    expect(screen.getAllByText(/Lot 18/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("Browse: Section")).not.toBeInTheDocument();
    const annaResultCard = screen.getByText("Anna Tracy").closest(".left-sidebar__result-card");
    expect(within(annaResultCard).queryByText("Section 99")).not.toBeInTheDocument();
    expect(within(annaResultCard).getByText(/Lot 18 • Tier 0/i)).toBeInTheDocument();

    const sectionPanel = screen.getByRole("combobox", { name: "Section" }).closest(".left-sidebar__browse-detail");
    fireEvent.click(within(sectionPanel).getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByLabelText("Clear search query"));

    expect(onClearSectionFilters).toHaveBeenCalledTimes(1);
    expect(onClearSelectedBurials).not.toHaveBeenCalled();
    expect(onLotTierFilterChange).not.toHaveBeenCalled();
    expect(onTourChange).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/Search this section/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Clear all browse filters" })).toBeInTheDocument();
  });

  domTest("keeps the tour browse mode active when the contextual clear action resets the selected tour", () => {
    const onTourChange = jest.fn();
    const { rerender } = renderSidebar({
      isMobile: true,
      selectedTour: "Notables Tour 2020",
      onTourChange,
    });

    flushBrowseTimers();

    expect(screen.getByRole("button", { name: "Tours" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Tour" })).toHaveValue("Notables Tour 2020");

    const tourPanel = screen.getByText(/Choose tour/i).closest(".left-sidebar__browse-detail");
    fireEvent.click(within(tourPanel).getByRole("button", { name: "Clear" }));

    expect(onTourChange).toHaveBeenCalledWith(null);

    rerender(
      <BurialSidebar
        {...createBaseProps()}
        isMobile
        selectedTour=""
        onTourChange={onTourChange}
      />
    );

    flushBrowseTimers();

    expect(screen.getByRole("button", { name: "Tours" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Choose tour/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tour" })).toHaveValue("");
    expect(screen.getByPlaceholderText(/Select a tour to browse/i)).toBeInTheDocument();
  });

  domTest("switches between browse sources and updates the visible controls", () => {
    const onClearSectionFilters = jest.fn();
    const onTourChange = jest.fn();
    const { rerender } = renderSidebar({
      selectedTour: "Notables Tour 2020",
      onClearSectionFilters,
      onTourChange,
    });

    flushBrowseTimers();

    fireEvent.click(screen.getByRole("button", { name: "Sections" }));

    expect(onTourChange).toHaveBeenCalledWith(null);

    rerender(
      <BurialSidebar
        {...createBaseProps()}
        selectedTour=""
        onClearSectionFilters={onClearSectionFilters}
        onTourChange={onTourChange}
      />
    );

    flushBrowseTimers();

    expect(screen.getByRole("combobox", { name: "Section" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Select a section to browse/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sections" }));

    expect(screen.queryByText("Choose section")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Section" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by name, section, or lot/i)).toBeInTheDocument();
  });

  domTest("keeps the idle state focused on browse controls before a global search starts", () => {
    renderSidebar();

    flushBrowseTimers();

    expect(screen.queryByText("Results")).not.toBeInTheDocument();
    expect(screen.queryByText("Type at least 2 characters to search.")).not.toBeInTheDocument();
    expect(screen.queryByText("Start with a section")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sections" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Sections" }));

    expect(screen.getByRole("button", { name: "Sections" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Section" })).toBeInTheDocument();
    expect(screen.queryByText("Results")).not.toBeInTheDocument();
  });

  domTest("offers a clear-search action when a global query has no matches", () => {
    renderSidebar();

    flushBrowseTimers();

    const input = screen.getByPlaceholderText(/Search by name, section, or lot/i);
    fireEvent.change(input, { target: { value: "zz" } });

    flushBrowseTimers();

    expect(screen.getByText('No results for "zz".')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(input).toHaveValue("");
  });

  domTest("renders the configured header link target", () => {
    renderSidebar();

    const link = screen.getByRole("link", {
      name: APP_PROFILE.shell?.headerTitle || "Burial Finder",
    });

    expect(link).toHaveAttribute("href", APP_PROFILE.shell?.homeUrl || "#");
  });

  domTest("keeps the share link panel hidden until there is a selection or saved link state", () => {
    renderSidebar();

    expect(screen.queryByText("Share Link")).not.toBeInTheDocument();
  });

  domTest("keeps global search results visible after a selection so browse context stays available", () => {
    const onBrowseResultSelect = jest.fn();

    renderSidebar({ onBrowseResultSelect });
    flushBrowseTimers();

    const input = screen.getByPlaceholderText(/Search by name, section, or lot/i);
    fireEvent.change(input, { target: { value: "anna" } });
    flushBrowseTimers();

    expect(screen.getByText("Anna Tracy")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Anna Tracy"));

    expect(onBrowseResultSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Anna Tracy",
        Section: "99",
      })
    );
    expect(screen.getByText("Anna Tracy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View list" })).not.toBeInTheDocument();
  });

  domTest("shows the share link panel and copies a link from the current selection", () => {
    const onCopyFieldPacketLink = jest.fn();

    renderSidebar({
      selectedBurials: [burialRecords[0]],
      onCopyFieldPacketLink,
    });

    expect(screen.getByText("Share Link")).toBeInTheDocument();
    expect(screen.getByText("1 selected record ready to share.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy share link" }));

    expect(onCopyFieldPacketLink).toHaveBeenCalled();
  });

  domTest("edits and clears an existing shared link state", () => {
    const onUpdateFieldPacket = jest.fn();
    const onCopyFieldPacketLink = jest.fn();
    const onClearFieldPacket = jest.fn();

    renderSidebar({
      selectedBurials: [burialRecords[0]],
      fieldPacket: {
        version: 1,
        name: "Section 99",
        note: "Check the stone alignment.",
        activeBurialId: burialRecords[0].id,
        selectedBurialIds: [burialRecords[0].id],
        selectedRecords: [burialRecords[0]],
        sectionFilter: "99",
        selectedTour: "",
        mapBounds: [
          [42.70, -73.74],
          [42.71, -73.73],
        ],
      },
      fieldPacketNotice: {
        message: "Share link copied.",
        tone: "success",
      },
      onUpdateFieldPacket,
      onCopyFieldPacketLink,
      onClearFieldPacket,
    });

    fireEvent.change(screen.getByLabelText("Link title"), {
      target: { value: "Updated share title" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Updated note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy share link" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear saved details" }));

    expect(onUpdateFieldPacket).toHaveBeenNthCalledWith(1, { name: "Updated share title" });
    expect(onUpdateFieldPacket).toHaveBeenNthCalledWith(2, { note: "Updated note" });
    expect(onCopyFieldPacketLink).toHaveBeenCalled();
    expect(onClearFieldPacket).toHaveBeenCalled();
    expect(screen.getByText("Share link copied.")).toBeInTheDocument();
  });

  domTest("shows install and native-app CTAs when a shared link is restored", () => {
    const onInstallApp = jest.fn();

    renderSidebar({
      selectedBurials: [burialRecords[0]],
      fieldPacket: {
        version: 1,
        name: "Anna Tracy",
        note: "Bring the preservation report.",
        activeBurialId: burialRecords[0].id,
        selectedBurialIds: [burialRecords[0].id],
        selectedRecords: [burialRecords[0]],
        sectionFilter: "99",
        selectedTour: "",
        mapBounds: null,
      },
      installPromptEvent: {},
      iosAppStoreUrl: "https://apps.apple.com/us/app/albany-grave-finder/id6746413050",
      onInstallApp,
      sharedLinkLandingState: {
        restoredAt: Date.now(),
      },
      showIosInstallHint: true,
    });

    expect(screen.getByText("Opened from a shared link")).toBeInTheDocument();
    expect(screen.getAllByText("Bring the preservation report.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Install app" }));

    expect(onInstallApp).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Get iPhone app" })).toHaveAttribute(
      "href",
      "https://apps.apple.com/us/app/albany-grave-finder/id6746413050"
    );
  });

  domTest("summarizes selected count in browse results on the mobile sheet", () => {
    const onClearSelectedBurials = jest.fn();
    const { rerender } = renderSidebar({ isMobile: true, sectionFilter: "99", showAllBurials: true });

    flushBrowseTimers();

    const rerenderProps = createBaseProps();
    rerender(
      <BurialSidebar
        {...rerenderProps}
        isMobile
        sectionFilter="99"
        showAllBurials
        activeBurialId={burialRecords[0].id}
        selectedBurials={burialRecords}
        onClearSelectedBurials={onClearSelectedBurials}
      />
    );

    flushBrowseTimers();

    const browseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");
    const selectedChip = within(browseWorkspace).getByText("2 selected");
    expect(within(browseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);
    expect(within(browseWorkspace).queryByText("Selection")).not.toBeInTheDocument();

    fireEvent.click(within(selectedChip.closest(".left-sidebar__results-header")).getByRole("button", { name: "Clear selected" }));

    expect(onClearSelectedBurials).toHaveBeenCalled();
  });

  domTest("uses the bottom-sheet overlay as the mobile viewport padding root", () => {
    const rootRef = React.createRef();

    renderSidebar({ isMobile: true, rootRef });

    expect(rootRef.current).toHaveAttribute("data-rsbs-overlay");
  });

  domTest("notifies the map shell after the mobile sheet settles", () => {
    const onMobileSheetViewportChange = jest.fn();

    renderSidebar({ isMobile: true, onMobileSheetViewportChange });

    act(() => {
      mockBottomSheetState.currentHeight = 500;
      mockBottomSheetState.lastProps.onSpringEnd({ type: "SNAP" });
    });

    expect(onMobileSheetViewportChange).toHaveBeenCalledTimes(1);
  });

  domTest("reveals an existing mobile selection on first render instead of collapsing the sheet", () => {
    renderSidebar({
      isMobile: true,
      activeBurialId: burialRecords[0].id,
      selectedBurials: [burialRecords[0]],
    });

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(500);
    expect(mockBottomSheetState.snapTo).not.toHaveBeenCalled();
  });

  domTest("keeps browse controls and results in the same workspace panel", () => {
    renderSidebar({ sectionFilter: "99", showAllBurials: true });

    flushBrowseTimers();

    const browseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");

    expect(browseWorkspace).not.toBeNull();
    expect(within(browseWorkspace).getByText("Browse")).toBeInTheDocument();
    expect(within(browseWorkspace).getByLabelText("Search burials")).toBeInTheDocument();
    expect(within(browseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);
  });

  domTest("folds the current selection count into browse results when both are present", () => {
    const extraSectionRecord = buildBurialBrowseResult(
      {
        properties: {
          OBJECTID: 3,
          First_Name: "Clara",
          Last_Name: "Section",
          Section: "99",
          Lot: "44",
          Tier: "0",
          Grave: "0",
        },
        geometry: {
          coordinates: [-73.73367, 42.71193],
        },
      },
      { getTourName }
    );
    const sectionRecords = [...burialRecords, extraSectionRecord];

    renderSidebar({
      activeBurialId: burialRecords[1].id,
      burialRecords: sectionRecords,
      sectionFilter: "99",
      selectedBurials: burialRecords,
      searchIndex: buildSearchIndex(sectionRecords, { getTourName }),
      showAllBurials: true,
    });

    flushBrowseTimers();

    const browseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");
    const selectedChip = within(browseWorkspace).getByText("2 selected");
    expect(within(browseWorkspace).getByText("Selected records")).toBeInTheDocument();
    expect(within(browseWorkspace).queryByText("3 results")).not.toBeInTheDocument();
    const resultsList = within(browseWorkspace)
      .getAllByRole("list")
      .find((list) => !list.closest(".left-sidebar__selected-scroll"));

    expect(within(browseWorkspace).queryByText("Selection")).not.toBeInTheDocument();
    expect(resultsList).not.toBeNull();
    expect(within(resultsList).queryByText("Clara Section")).not.toBeInTheDocument();
    const thomasResult = within(resultsList).getByText("Thomas Tracy");
    const annaResult = within(resultsList).getByText("Anna Tracy");

    expect(
      selectedChip.compareDocumentPosition(resultsList) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      thomasResult.compareDocumentPosition(annaResult) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  domTest("keeps selected mobile state compact when browse results are active", () => {
    renderSidebar({
      isMobile: true,
      activeBurialId: burialRecords[0].id,
      initialQuery: "anna",
      selectedBurials: [burialRecords[0]],
    });

    flushBrowseTimers();

    const browseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");
    const searchInput = within(browseWorkspace).getByLabelText("Search burials");
    const selectedChip = within(browseWorkspace).getByText("1 selected");

    expect(within(browseWorkspace).queryByText("Selection")).not.toBeInTheDocument();
    expect(within(selectedChip.closest(".left-sidebar__results-header")).getByRole("button", { name: "Clear selected" })).toBeInTheDocument();
    expect(
      searchInput.compareDocumentPosition(selectedChip) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  domTest("keeps selection-only state inside the browse workspace without idle results", () => {
    renderSidebar({
      activeBurialId: burialRecords[0].id,
      selectedBurials: [burialRecords[0]],
    });

    flushBrowseTimers();

    const browseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");
    const selectionPanel = within(browseWorkspace).getByText("Selection").closest(".left-sidebar__panel");

    expect(screen.queryByText("Results")).not.toBeInTheDocument();
    expect(selectionPanel.closest(".left-sidebar__browse-workspace")).toBe(browseWorkspace);
  });

  domTest("keeps desktop selected lists out of the browse-results flow", () => {
    const crowdedSelection = Array.from({ length: 8 }, (_, index) => ({
      ...burialRecords[index % burialRecords.length],
      id: `selected-${index}`,
    }));

    renderSidebar({
      selectedBurials: crowdedSelection,
      sectionFilter: "99",
      showAllBurials: true,
    });

    flushBrowseTimers();

    const browseWorkspace = screen.getByText("Browse").closest(".left-sidebar__panel");

    expect(within(browseWorkspace).queryByText("Selection")).not.toBeInTheDocument();
    expect(browseWorkspace.querySelector(".left-sidebar__selected-scroll")).toBeNull();
    expect(within(browseWorkspace).getByText("8 selected")).toBeInTheDocument();
    expect(browseWorkspace).not.toBeNull();
    expect(within(browseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);
  });

  domTest("tracks selected row hover by burial id", () => {
    const onHoverBurialChange = jest.fn();
    renderSidebar({
      selectedBurials: burialRecords,
      onHoverBurialChange,
    });

    const selectedPanel = screen.getByText("Selection").closest(".left-sidebar__panel");
    const annaRow = within(selectedPanel).getByText("Anna Tracy").closest(".left-sidebar__selected-row");

    fireEvent.mouseEnter(annaRow);
    fireEvent.mouseLeave(annaRow);

    expect(onHoverBurialChange).toHaveBeenNthCalledWith(1, burialRecords[0].id);
    expect(onHoverBurialChange).toHaveBeenNthCalledWith(2, null);
  });

  domTest("labels the lead selection as selected when records remain selected but no burial is actively focused", () => {
    renderSidebar({
      activeBurialId: null,
      selectedBurials: [burialRecords[0]],
    });

    expect(screen.getByText("Selected burial")).toBeInTheDocument();
    expect(screen.queryByText("Current selection")).not.toBeInTheDocument();
  });

  domTest("uses the current selection context when the layout switches to mobile", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({
      activeBurialId: burialRecords[0].id,
      selectedBurials: [burialRecords[0]],
    });

    rerender(
      <BurialSidebar
        {...rerenderProps}
        isMobile
        activeBurialId={burialRecords[0].id}
        selectedBurials={[burialRecords[0]]}
      />
    );

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(500);
    expect(mockBottomSheetState.snapTo).not.toHaveBeenCalled();
  });

  domTest("defaults the results selector to 10 and removes always-on status pills", () => {
    renderSidebar({ sectionFilter: "99", showAllBurials: true });

    flushBrowseTimers();

    expect(screen.getByText("2 results")).toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
    expect(screen.queryByText("Records ready")).not.toBeInTheDocument();
  });

  domTest("shows contextual offline and location notices in the search shell", () => {
    renderSidebar({
      isOnline: false,
      status: "Location active",
    });

    flushBrowseTimers();

    expect(screen.getByText("Using your current location for directions.")).toBeInTheDocument();
    expect(screen.getByText(
      "Offline. Cached searches and cemetery layers may still work after a prior load; live maps, links, and GPS can be limited."
    )).toBeInTheDocument();
  });
});
