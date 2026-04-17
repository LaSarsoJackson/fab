/** @jest-environment jsdom */

import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

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
        <div data-testid="mock-bottom-sheet">
          <div data-testid="mock-bottom-sheet-header">{props.header}</div>
          <div data-testid="mock-bottom-sheet-body">{props.children}</div>
        </div>
      );
    }),
  };
});

import BurialSidebar from "./BurialSidebar";
import { buildBurialBrowseResult, buildSearchIndex } from "./features/browse";

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
  onCreateFieldPacket: jest.fn(),
  onOpenAppMenu: jest.fn(),
  onOpenDirectionsMenu: jest.fn(),
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

  domTest("supports mobile query entry and clearing from the search field without forcing drawer expansion", () => {
    renderSidebar({ isMobile: true });

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tour" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Section" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Select a section to browse/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More options" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "My location" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Clear all browse filters")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All" }));

    const input = screen.getByPlaceholderText(/Search by name, section, or lot/i);
    fireEvent.focus(input);

    fireEvent.change(input, { target: { value: "anna" } });
    flushBrowseTimers();

    expect(screen.queryByText("Search: anna")).not.toBeInTheDocument();
    expect(screen.getByText("Anna Tracy")).toBeInTheDocument();
    expect(screen.queryByText("Thomas Tracy")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Clear search query"));

    expect(input).toHaveValue("");
  });

  domTest("keeps the mobile drawer at peek when a point selection arrives", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({ isMobile: true });

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(500);

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

  domTest("re-expands a collapsed mobile drawer when a map selection arrives", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({ isMobile: true });

    act(() => {
      mockBottomSheetState.currentHeight = 120;
      mockBottomSheetState.lastProps.onSpringEnd({ type: "SNAP" });
    });

    mockBottomSheetState.snapTo.mockReset();

    act(() => {
      rerender(
        <BurialSidebar
          {...rerenderProps}
          isMobile
          activeBurialId={burialRecords[0].id}
          selectedBurials={[burialRecords[0]]}
        />
      );
    });

    expect(mockBottomSheetState.snapTo).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetState.snapTo.mock.calls[0][0]({ maxHeight: 1000 })).toBeCloseTo(500);
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

  domTest("preserves a minimized mobile results panel when a point selection arrives", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({
      isMobile: true,
      sectionFilter: "99",
      showAllBurials: true,
    });

    const resultsPanel = screen.getByText("Results").closest(".left-sidebar__panel");
    fireEvent.click(within(resultsPanel).getByRole("button", { name: "Collapse" }));

    expect(within(resultsPanel).queryByText("Anna Tracy")).not.toBeInTheDocument();
    expect(within(resultsPanel).getByRole("button", { name: "View list" })).toBeInTheDocument();

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

    const nextResultsPanel = screen.getByText("Results").closest(".left-sidebar__panel");
    expect(within(nextResultsPanel).queryByText("Anna Tracy")).not.toBeInTheDocument();
    expect(within(nextResultsPanel).getByRole("button", { name: "View list" })).toBeInTheDocument();
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
    expect(screen.getAllByText("Lot 18").length).toBeGreaterThan(0);
    expect(screen.queryByText("Browse: Section")).not.toBeInTheDocument();
    const annaResultCard = screen.getByText("Anna Tracy").closest(".left-sidebar__result-card");
    expect(within(annaResultCard).queryByText("Section 99")).not.toBeInTheDocument();
    expect(within(annaResultCard).getByText("Lot 18")).toBeInTheDocument();

    const sectionPanel = screen.getByRole("combobox", { name: "Section" }).closest(".left-sidebar__browse-detail");
    fireEvent.click(within(sectionPanel).getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByLabelText("Clear search query"));

    expect(onClearSectionFilters).toHaveBeenCalledTimes(1);
    expect(onClearSelectedBurials).not.toHaveBeenCalled();
    expect(onLotTierFilterChange).not.toHaveBeenCalled();
    expect(onTourChange).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/Search this section/i)).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear all browse filters" })).not.toBeInTheDocument();
  });

  domTest("keeps the tour browse mode active when the contextual clear action resets the selected tour", () => {
    const onTourChange = jest.fn();
    const { rerender } = renderSidebar({
      isMobile: true,
      selectedTour: "Notables Tour 2020",
      onTourChange,
    });

    flushBrowseTimers();

    expect(screen.getByRole("button", { name: "Tour" })).toHaveAttribute("aria-pressed", "true");
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

    expect(screen.getByRole("button", { name: "Tour" })).toHaveAttribute("aria-pressed", "true");
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

    fireEvent.click(screen.getByRole("button", { name: /Section/ }));

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

    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(screen.queryByText("Choose section")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by name, section, or lot/i)).toBeInTheDocument();
  });

  domTest("shows scope chips and empty-state shortcuts before a global search starts", () => {
    renderSidebar();

    flushBrowseTimers();

    expect(screen.getByText("Search by name or keyword.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse sections" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Browse sections" }));

    expect(screen.getByRole("button", { name: "Section" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Section" })).toBeInTheDocument();
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

  domTest("renders the Burial Finder header link to the ARCE homepage", () => {
    renderSidebar();

    const link = screen.getByRole("link", { name: "Burial Finder" });

    expect(link).toHaveAttribute("href", "https://www.albany.edu/arce/");
  });

  domTest("shows the field packet panel in dev and creates a packet from the current selection", () => {
    const onCreateFieldPacket = jest.fn();

    renderSidebar({
      selectedBurials: [burialRecords[0]],
      onCreateFieldPacket,
    });

    expect(screen.getByText("Field Packet")).toBeInTheDocument();
    expect(screen.getByText("1 selected record ready to capture.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create packet" }));

    expect(onCreateFieldPacket).toHaveBeenCalled();
  });

  domTest("edits and clears an existing field packet", () => {
    const onUpdateFieldPacket = jest.fn();
    const onCopyFieldPacketLink = jest.fn();
    const onClearFieldPacket = jest.fn();

    renderSidebar({
      selectedBurials: [burialRecords[0]],
      fieldPacket: {
        version: 1,
        name: "Section 99 packet",
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
        message: "Field packet link copied.",
        tone: "success",
      },
      onUpdateFieldPacket,
      onCopyFieldPacketLink,
      onClearFieldPacket,
    });

    fireEvent.change(screen.getByLabelText("Packet name"), {
      target: { value: "Updated packet name" },
    });
    fireEvent.change(screen.getByLabelText("Field note"), {
      target: { value: "Updated note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear packet" }));

    expect(onUpdateFieldPacket).toHaveBeenNthCalledWith(1, { name: "Updated packet name" });
    expect(onUpdateFieldPacket).toHaveBeenNthCalledWith(2, { note: "Updated note" });
    expect(onCopyFieldPacketLink).toHaveBeenCalled();
    expect(onClearFieldPacket).toHaveBeenCalled();
    expect(screen.getByText("Field packet link copied.")).toBeInTheDocument();
  });

  domTest("shows selected summary and results together in the mobile sheet", () => {
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

    expect(screen.getByText("Selection")).toBeInTheDocument();
    expect(screen.getByText("Results")).toBeInTheDocument();
    expect(within(screen.getByText("Selection").closest(".left-sidebar__panel")).getByRole("button", { name: "Route on map" })).toBeInTheDocument();

    const selectedSummary = screen.getByText("Selection").closest(".left-sidebar__panel");
    expect(within(selectedSummary).getByRole("button", { name: "Show list" })).toBeInTheDocument();

    fireEvent.click(within(selectedSummary).getByRole("button", { name: "Show list" }));

    expect(within(selectedSummary).getByText("Thomas Tracy")).toBeInTheDocument();

    fireEvent.click(within(selectedSummary).getByRole("button", { name: "Hide list" }));

    expect(within(selectedSummary).queryByText("Thomas Tracy")).not.toBeInTheDocument();
    expect(within(selectedSummary).getByRole("button", { name: "Show list" })).toBeInTheDocument();
    expect(screen.getByText("Results")).toBeInTheDocument();

    fireEvent.click(within(selectedSummary).getByRole("button", { name: "Clear" }));

    expect(onClearSelectedBurials).toHaveBeenCalled();
  });

  domTest("bounds the desktop selected people list so browse results stay in the sidebar flow", () => {
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

    const selectedPanel = screen.getByText("Selection").closest(".left-sidebar__panel");
    const selectedScroll = selectedPanel.querySelector(".left-sidebar__selected-scroll");
    const resultsPanel = screen.getByText("Results").closest(".left-sidebar__panel");

    expect(selectedScroll).not.toBeNull();
    expect(within(selectedScroll).getByRole("list")).toBeInTheDocument();
    expect(resultsPanel).not.toBeNull();
    expect(within(resultsPanel).getByText("Anna Tracy")).toBeInTheDocument();
  });

  domTest("tracks selected row hover by burial id and clears stale hover when the selection changes", () => {
    const onHoverBurialChange = jest.fn();
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({
      selectedBurials: burialRecords,
      onHoverBurialChange,
    });

    const selectedPanel = screen.getByText("Selection").closest(".left-sidebar__panel");
    const annaRow = within(selectedPanel).getByText("Anna Tracy").closest(".left-sidebar__selected-row");

    fireEvent.mouseEnter(annaRow);
    fireEvent.mouseLeave(annaRow);

    expect(onHoverBurialChange).toHaveBeenNthCalledWith(1, burialRecords[0].id);
    expect(onHoverBurialChange).toHaveBeenNthCalledWith(2, null);

    onHoverBurialChange.mockClear();

    rerender(
      <BurialSidebar
        {...rerenderProps}
        hoveredBurialId={burialRecords[0].id}
        onHoverBurialChange={onHoverBurialChange}
        selectedBurials={[]}
      />
    );

    expect(onHoverBurialChange).toHaveBeenCalledWith(null);
  });

  domTest("uses the correct mobile snap immediately when the layout switches to mobile", () => {
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
    expect(screen.getByText("Offline. Search stays available, but live links may be limited.")).toBeInTheDocument();
  });
});
