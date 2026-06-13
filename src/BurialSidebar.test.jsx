/** @jest-environment jsdom */

import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import BurialSidebar from "./BurialSidebar";
import { APP_PROFILE } from "./features/fab/profile";
import { buildBurialBrowseResult } from "./features/browse/browseResults";
import { buildSearchIndex } from "./features/browse/burialSearch";
import { buildRecordCoordinateGroups } from "./features/map/mapDomain";
import { buildLifeDatesSummary } from "./features/browse/sidebarPresentation";

jest.mock("./features/browse/sidebarPresentation", () => {
  const actual = jest.requireActual("./features/browse/sidebarPresentation");

  return {
    ...actual,
    buildLifeDatesSummary: jest.fn(actual.buildLifeDatesSummary),
  };
});

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
          <div data-testid="mock-bottom-sheet-scroll" data-rsbs-scroll>
            <div data-testid="mock-bottom-sheet-header">{props.header}</div>
            <div data-testid="mock-bottom-sheet-body">{props.children}</div>
          </div>
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

const tourBrowseRecords = burialRecords.map((record, index) => ({
  ...record,
  id: `tour:Notable:${index + 1}:99:18`,
  source: "tour",
  title: "Notable",
  tourKey: "Notable",
  tourName: "Notables Tour 2020",
}));

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
  onLocateMarker: jest.fn(),
  onLotTierFilterChange: jest.fn(),
  onClearFieldPacket: jest.fn(),
  onCopyFieldPacketLink: jest.fn(),
  onInstallApp: jest.fn(),
  onOpenAppMenu: jest.fn(),
  onNavigateToBurial: jest.fn(),
  onMobileSheetViewportChange: jest.fn(),
  onRemoveSelectedBurial: jest.fn(),
  onSectionChange: jest.fn(),
  onShareFieldPacket: jest.fn(),
  onStopRouting: jest.fn(),
  onToggleSectionMarkers: jest.fn(),
  onTourChange: jest.fn(),
  onUpdateFieldPacket: jest.fn(),
  searchIndex: buildSearchIndex(burialRecords, { getTourName }),
  sectionFilter: "",
  selectedBurialCoordinateGroups: [],
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
// The search field lives inside the browse panel on desktop but in the pinned
// sheet header on mobile, so resolve the workspace panel by its own class.
const getBrowseWorkspace = () => document.querySelector(".left-sidebar__browse-workspace");
const getLeadSelectionCard = () => {
  const leadCard = document.querySelector(".left-sidebar__selected-row--lead");
  if (!leadCard) {
    throw new Error("Expected a lead selected-record card.");
  }
  return leadCard;
};

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

  domTest("keeps the search field interactive while burial records are loading", () => {
    const onRequestBurialDataLoad = jest.fn();

    renderSidebar({
      isBurialDataLoading: true,
      isSearchIndexReady: false,
      onRequestBurialDataLoad,
    });

    const input = screen.getByLabelText("Search burials");

    expect(input).not.toBeDisabled();
    fireEvent.focus(input);
    expect(onRequestBurialDataLoad).toHaveBeenCalled();
  });

  domTest("shows an actionable retry when burial records fail to load", () => {
    const onRetryBurialDataLoad = jest.fn();

    renderSidebar({
      burialDataError: "Burial records failed to load.",
      isSearchIndexReady: false,
      onRetryBurialDataLoad,
    });

    const input = screen.getByLabelText("Search burials");
    expect(input).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetryBurialDataLoad).toHaveBeenCalledTimes(1);
  });

  domTest("shows section browse results when a section is selected after initial render", () => {
    const { rerender } = renderSidebar();

    expect(screen.getByPlaceholderText(/Search burials/i)).toBeInTheDocument();
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

    const browseWorkspace = getBrowseWorkspace();
    expect(within(browseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);
    expect(within(browseWorkspace).getAllByText("Thomas Tracy").length).toBeGreaterThan(0);
  });

  domTest("supports mobile query entry and clearing from the guided peek sheet", () => {
    renderSidebar({ isMobile: true });

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);
    expect(screen.getByRole("button", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tours" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Section" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search graves & landmarks/i)).toBeInTheDocument();
    expect(screen.queryByText("Start with a section")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More options" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Clear all browse filters")).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Search graves & landmarks/i);
    fireEvent.focus(input);

    // Focusing search expands the drawer to full height, like Apple Maps.
    expect(mockBottomSheetState.snapTo).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetState.snapTo.mock.calls[0][0]({ maxHeight: 1000 })).toBeCloseTo(920);

    fireEvent.change(input, { target: { value: "anna" } });
    flushBrowseTimers();

    expect(screen.queryByText("Search: anna")).not.toBeInTheDocument();
    expect(screen.getByText("Anna Tracy")).toBeInTheDocument();
    expect(screen.queryByText("Thomas Tracy")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Clear search query"));

    expect(input).toHaveValue("");
    expect(getCurrentMobileSheetSnap()).toBeCloseTo(920);
    expect(mockBottomSheetState.snapTo).toHaveBeenCalledTimes(1);
  });

  domTest("lets mobile users collapse and reopen the search panel", () => {
    renderSidebar({ isMobile: true });

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(mockBottomSheetState.snapTo).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetState.snapTo.mock.calls[0][0]({ maxHeight: 1000 })).toBeCloseTo(80);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(mockBottomSheetState.snapTo).toHaveBeenCalledTimes(2);
    expect(mockBottomSheetState.snapTo.mock.calls[1][0]({ maxHeight: 1000 })).toBeCloseTo(390);
  });

  domTest("lets mobile users reopen the search panel after dragging the sheet closed", () => {
    renderSidebar({ isMobile: true });

    act(() => {
      mockBottomSheetState.currentHeight = 80;
      mockBottomSheetState.lastProps.onSpringEnd({ type: "SNAP" });
    });

    mockBottomSheetState.snapTo.mockReset();

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(mockBottomSheetState.snapTo).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetState.snapTo.mock.calls[0][0]({ maxHeight: 1000 })).toBeCloseTo(390);
  });

  domTest("lets the map shell fully hide mobile chrome when that control is available", () => {
    const onRequestHideChrome = jest.fn();
    renderSidebar({ isMobile: true, onRequestHideChrome });

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));

    expect(onRequestHideChrome).toHaveBeenCalledTimes(1);
    expect(mockBottomSheetState.snapTo).not.toHaveBeenCalled();
  });

  domTest("shows actionable GPS guidance when location is unavailable", () => {
    renderSidebar({
      status: APP_PROFILE.map.locationMessages.unavailable,
    });

    flushBrowseTimers();

    expect(screen.getByText(/Location is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/search by name or section/i)).toBeInTheDocument();
  });

  domTest("opens the mobile visit sheet before a point selection arrives", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({ isMobile: true });

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);

    rerender(
      <BurialSidebar
        {...rerenderProps}
        isMobile
        activeBurialId={burialRecords[0].id}
        selectedBurials={[burialRecords[0]]}
      />
    );

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);
    expect(mockBottomSheetState.snapTo).not.toHaveBeenCalled();
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
    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);
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
    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);
  });

  domTest("uses one direct mobile preview action for navigation", () => {
    const onNavigateToBurial = jest.fn();

    renderSidebar({
      isMobile: true,
      activeBurialId: burialRecords[0].id,
      selectedBurials: [burialRecords[0]],
      onNavigateToBurial,
    });

    const selectedSummary = screen.getByText("Selected grave").closest(".left-sidebar__panel");

    fireEvent.click(within(selectedSummary).getByRole("button", { name: "Navigate" }));

    expect(onNavigateToBurial).toHaveBeenCalledWith(expect.objectContaining({ id: burialRecords[0].id }));
    expect(within(selectedSummary).queryByRole("button", { name: "Open in Maps" })).not.toBeInTheDocument();
    expect(within(selectedSummary).queryByRole("button", { name: "Get to road" })).not.toBeInTheDocument();
  });

  domTest("shows same-marker stack list in the compact mobile selection card while browse results are visible", () => {
    const stackedSecondRecord = {
      ...burialRecords[1],
      coordinates: burialRecords[0].coordinates,
    };
    const onFocusSelectedBurial = jest.fn();

    renderSidebar({
      isMobile: true,
      activeBurialId: burialRecords[0].id,
      sectionFilter: "99",
      selectedBurialCoordinateGroups: buildRecordCoordinateGroups([burialRecords[0], stackedSecondRecord]),
      selectedBurials: [burialRecords[0], stackedSecondRecord],
      showAllBurials: true,
      onFocusSelectedBurial,
    });

    const selectedSummary = screen.getByText("2 graves here").closest(".left-sidebar__panel");

    expect(within(selectedSummary).getByText("2 graves at this marker")).toBeInTheDocument();

    // The active record (Anna Tracy) should have aria-current="true" in the stack list
    const annaButtons = within(selectedSummary).getAllByRole("button", { name: /Anna Tracy/i });
    const annaStackOption = annaButtons.find((btn) => btn.classList.contains("popup-card__stack-option"));
    expect(annaStackOption).toHaveAttribute("aria-current", "true");

    // Clicking the second record's stack-option calls onFocusSelectedBurial with that record
    const thomasButtons = within(selectedSummary).getAllByRole("button", { name: /Thomas Tracy/i });
    const thomasStackOption = thomasButtons.find((btn) => btn.classList.contains("popup-card__stack-option"));
    fireEvent.click(thomasStackOption);

    expect(onFocusSelectedBurial).toHaveBeenCalledWith(expect.objectContaining({
      id: stackedSecondRecord.id,
    }));
  });

  domTest("keeps the mobile sheet in place when paging through graves at the same marker", () => {
    const stackedSecondRecord = {
      ...burialRecords[1],
      coordinates: burialRecords[0].coordinates,
    };
    const selectedBurials = [burialRecords[0], stackedSecondRecord];
    const selectedBurialCoordinateGroups = buildRecordCoordinateGroups(selectedBurials);
    const { rerender } = renderSidebar({
      isMobile: true,
      activeBurialId: burialRecords[0].id,
      selectedBurialCoordinateGroups,
      selectedBurials,
    });
    const scrollContainer = screen.getByTestId("mock-bottom-sheet-scroll");
    const rerenderProps = createBaseProps();

    scrollContainer.scrollTop = 180;
    rerender(
      <BurialSidebar
        {...rerenderProps}
        isMobile
        activeBurialId={stackedSecondRecord.id}
        selectedBurialCoordinateGroups={selectedBurialCoordinateGroups}
        selectedBurials={selectedBurials}
      />
    );

    expect(scrollContainer.scrollTop).toBe(180);
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

    const selectedSummary = screen.getByText("Selected grave").closest(".left-sidebar__panel");
    const portrait = within(selectedSummary).getByAltText("Anna Tracy portrait");

    expect(portrait).toHaveAttribute("src", expect.stringContaining("Schuyler70a.jpg"));
    expect(within(selectedSummary).getByRole("link", { name: "Anna Tracy portrait" })).toHaveAttribute(
      "href",
      "https://www.albany.edu/arce/Schuyler70.html"
    );
    expect(within(selectedSummary).getByRole("link", { name: "Details" })).toHaveAttribute(
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

    const browseWorkspace = getBrowseWorkspace();
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

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);

    fireEvent.click(screen.getByText("Anna Tracy"));

    expect(onBrowseResultSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Anna Tracy",
        Section: "99",
        Lot: "18",
      })
    );
    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);
  });

  domTest("keeps the section results visible when a point selection arrives on mobile", () => {
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({
      isMobile: true,
      sectionFilter: "99",
      showAllBurials: true,
    });

    const browseWorkspace = getBrowseWorkspace();
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

    const nextBrowseWorkspace = getBrowseWorkspace();
    expect(within(nextBrowseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);
    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);
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
    expect(screen.getByPlaceholderText(/Search burials/i)).toBeInTheDocument();
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

    const input = screen.getByPlaceholderText(/Search burials/i);
    fireEvent.change(input, { target: { value: "zz" } });

    flushBrowseTimers();

    expect(screen.getByText('No matches for "zz". Check spelling or try a section number.')).toBeInTheDocument();

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

    const input = screen.getByPlaceholderText(/Search burials/i);
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

  domTest("does not re-render unchanged search result cards when hover ids change", () => {
    const stableProps = createBaseProps();
    const { rerender } = render(
      <BurialSidebar
        {...stableProps}
        initialQuery="tracy"
      />
    );

    flushBrowseTimers();
    buildLifeDatesSummary.mockClear();

    rerender(
      <BurialSidebar
        {...stableProps}
        initialQuery="tracy"
        hoveredBurialId={burialRecords[0].id}
        onBrowseResultSelect={jest.fn()}
        onHoverBurialChange={jest.fn()}
      />
    );

    expect(buildLifeDatesSummary).toHaveBeenCalledTimes(1);
    expect(buildLifeDatesSummary).toHaveBeenCalledWith(
      expect.objectContaining({ id: burialRecords[0].id })
    );
  });

  domTest("does not re-render unchanged section result cards when hover and active ids change", () => {
    const { rerender } = renderSidebar({
      sectionFilter: "99",
      showAllBurials: true,
    });

    flushBrowseTimers();
    buildLifeDatesSummary.mockClear();

    rerender(
      <BurialSidebar
        {...createBaseProps()}
        sectionFilter="99"
        showAllBurials
        hoveredBurialId={burialRecords[0].id}
      />
    );

    expect(buildLifeDatesSummary).toHaveBeenCalledTimes(1);
    expect(buildLifeDatesSummary).toHaveBeenCalledWith(
      expect.objectContaining({ id: burialRecords[0].id })
    );

    buildLifeDatesSummary.mockClear();

    rerender(
      <BurialSidebar
        {...createBaseProps()}
        sectionFilter="99"
        showAllBurials
        activeBurialId={burialRecords[1].id}
        hoveredBurialId={burialRecords[0].id}
      />
    );

    expect(buildLifeDatesSummary).toHaveBeenCalledTimes(1);
    expect(buildLifeDatesSummary).toHaveBeenCalledWith(
      expect.objectContaining({ id: burialRecords[1].id })
    );
  });

  domTest("does not re-render unchanged tour result cards when hover ids change", () => {
    const { rerender } = renderSidebar({
      selectedTour: "Notables Tour 2020",
      tourResults: tourBrowseRecords,
    });

    flushBrowseTimers();
    buildLifeDatesSummary.mockClear();

    rerender(
      <BurialSidebar
        {...createBaseProps()}
        hoveredBurialId={tourBrowseRecords[0].id}
        selectedTour="Notables Tour 2020"
        tourResults={tourBrowseRecords}
      />
    );

    expect(buildLifeDatesSummary).toHaveBeenCalledTimes(1);
    expect(buildLifeDatesSummary).toHaveBeenCalledWith(
      expect.objectContaining({ id: tourBrowseRecords[0].id })
    );
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

    const browseWorkspace = getBrowseWorkspace();
    const selectedChip = within(browseWorkspace).getByText("2 selected");
    const selectionPanel = within(browseWorkspace).getByText("2 graves here").closest(".left-sidebar__panel--selected-summary");

    expect(selectionPanel).not.toBeNull();
    expect(within(selectionPanel).queryByText("2 graves share this map location.")).not.toBeInTheDocument();
    expect(selectionPanel.querySelector(".MuiChip-root")).toBeNull();
    expect(within(selectionPanel).getAllByRole("button", { name: "Navigate" }).length).toBeGreaterThan(0);
    expect(within(browseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);

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

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);
    expect(mockBottomSheetState.snapTo).not.toHaveBeenCalled();
  });

  domTest("keeps browse controls and results in the same workspace panel", () => {
    renderSidebar({ sectionFilter: "99", showAllBurials: true });

    flushBrowseTimers();

    const browseWorkspace = getBrowseWorkspace();

    expect(browseWorkspace).not.toBeNull();
    expect(within(browseWorkspace).getByLabelText("Search burials")).toBeInTheDocument();
    expect(within(browseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);
  });

  domTest("keeps browse results visible with selected count when both are present", () => {
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

    const browseWorkspace = getBrowseWorkspace();
    const selectedChip = within(browseWorkspace).getByText("2 selected");
    const selectionPanel = within(browseWorkspace).getByText("Graves at this spot").closest(".left-sidebar__panel--selected-summary");
    expect(within(browseWorkspace).getByText("Results")).toBeInTheDocument();
    expect(within(browseWorkspace).getByText("3 results")).toBeInTheDocument();
    const resultsList = within(browseWorkspace)
      .getAllByRole("list")
      .find((list) => !list.closest(".left-sidebar__selected-scroll"));

    expect(selectionPanel).not.toBeNull();
    expect(within(selectionPanel).getAllByRole("button", { name: "Navigate" }).length).toBeGreaterThan(0);
    expect(resultsList).not.toBeNull();
    expect(within(resultsList).getByText("Clara Section")).toBeInTheDocument();
    const thomasResult = within(resultsList).getByText("Thomas Tracy");

    expect(
      selectedChip.compareDocumentPosition(resultsList) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(within(thomasResult.closest(".left-sidebar__result-card")).getByText("Active")).toBeInTheDocument();
  });

  domTest("keeps selected mobile actions available when browse results are active", () => {
    renderSidebar({
      isMobile: true,
      activeBurialId: burialRecords[0].id,
      initialQuery: "anna",
      selectedBurials: [burialRecords[0]],
    });

    flushBrowseTimers();

    const browseWorkspace = getBrowseWorkspace();
    const searchInput = screen.getByLabelText("Search burials");
    const selectedChip = within(browseWorkspace).getByText("1 selected");
    const selectionHeading = within(browseWorkspace).getByText("Selected grave");
    const selectionPanel = selectionHeading.closest(".left-sidebar__panel--selected-summary");

    expect(selectionPanel).not.toBeNull();
    expect(within(selectionPanel).getByRole("button", { name: "Navigate" })).toBeInTheDocument();
    expect(within(selectedChip.closest(".left-sidebar__results-header")).getByRole("button", { name: "Clear selected" })).toBeInTheDocument();
    // Search lives in the pinned sheet header above the body; the selected
    // grave stays the first card in the body, ahead of browse results.
    expect(
      selectionHeading.compareDocumentPosition(selectedChip) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      searchInput.compareDocumentPosition(selectionHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  domTest("keeps selection-only state inside the browse workspace without idle results", () => {
    renderSidebar({
      activeBurialId: burialRecords[0].id,
      selectedBurials: [burialRecords[0]],
    });

    flushBrowseTimers();

    const browseWorkspace = getBrowseWorkspace();
    const selectionPanel = within(browseWorkspace).getByText("Selected grave").closest(".left-sidebar__panel");

    expect(screen.queryByText("Results")).not.toBeInTheDocument();
    expect(selectionPanel.closest(".left-sidebar__browse-workspace")).toBe(browseWorkspace);
    expect(within(browseWorkspace).getByRole("button", { name: "Tours" })).toBeInTheDocument();
    expect(within(browseWorkspace).getByRole("button", { name: "Sections" })).toBeInTheDocument();
  });

  domTest("keeps desktop selected actions visible above browse results", () => {
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

    const browseWorkspace = getBrowseWorkspace();
    const selectionPanel = within(browseWorkspace).getByText("Graves at this spot").closest(".left-sidebar__panel--selected-summary");
    const searchInput = within(browseWorkspace).getByLabelText("Search burials");
    const sectionModeButton = within(browseWorkspace).getByRole("button", { name: "Sections" });

    expect(selectionPanel).not.toBeNull();
    expect(within(selectionPanel).getAllByRole("button", { name: "Navigate" }).length).toBeGreaterThan(0);
    expect(selectionPanel.querySelector(".left-sidebar__selected-scroll")).not.toBeNull();
    expect(
      selectionPanel.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      selectionPanel.compareDocumentPosition(sectionModeButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(within(browseWorkspace).getByText("8 selected")).toBeInTheDocument();
    expect(browseWorkspace).not.toBeNull();
    expect(within(browseWorkspace).getAllByText("Anna Tracy").length).toBeGreaterThan(0);
  });

  domTest("keeps navigation on the lead selection only when multiple desktop graves are selected", () => {
    const onFocusSelectedBurial = jest.fn();
    const onNavigateToBurial = jest.fn();
    const onRemoveSelectedBurial = jest.fn();

    renderSidebar({
      activeBurialId: burialRecords[0].id,
      selectedBurials: burialRecords,
      onFocusSelectedBurial,
      onNavigateToBurial,
      onRemoveSelectedBurial,
    });

    const selectionPanel = screen.getByText("Graves at this spot").closest(".left-sidebar__panel--selected-summary");
    const leadCard = within(selectionPanel).getByText("Anna Tracy").closest(".left-sidebar__selected-row--lead");
    const secondaryRow = within(selectionPanel).getByText("Thomas Tracy").closest(".left-sidebar__selected-row");

    expect(within(selectionPanel).getAllByRole("button", { name: "Navigate" })).toHaveLength(1);
    fireEvent.click(within(leadCard).getByRole("button", { name: "Navigate" }));
    expect(onNavigateToBurial).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: burialRecords[0].id }));

    expect(within(secondaryRow).queryByRole("button", { name: "Navigate" })).not.toBeInTheDocument();
    fireEvent.click(within(secondaryRow).getByRole("button", { name: "Close" }));
    expect(onRemoveSelectedBurial).toHaveBeenCalledWith(burialRecords[1].id);

    fireEvent.click(within(secondaryRow).getByRole("button", { name: /Thomas Tracy/i }));
    expect(onFocusSelectedBurial).toHaveBeenCalledWith(expect.objectContaining({ id: burialRecords[1].id }));
  });

  domTest("renders tour portrait media in the desktop lead selection card", () => {
    const selectedTourRecord = {
      ...burialRecords[0],
      id: "tour:Notable:desktop:99:18",
      source: "tour",
      title: "Notable",
      tourKey: "Notable",
      tourName: "Notables Tour 2020",
      portraitImageName: "Schuyler70a.jpg",
      biographyLink: "Schuyler70",
    };

    renderSidebar({
      activeBurialId: selectedTourRecord.id,
      selectedBurials: [selectedTourRecord],
    });

    const selectedPanel = getLeadSelectionCard();
    const portrait = within(selectedPanel).getByAltText("Anna Tracy portrait");

    expect(portrait).toHaveAttribute("src", expect.stringContaining("Schuyler70a.jpg"));
    expect(within(selectedPanel).queryByRole("link", { name: "Anna Tracy portrait" })).not.toBeInTheDocument();
  });

  domTest("renders scoped browse results as a single scrollable list without pagination buttons", () => {
    const sectionRecords = Array.from({ length: 12 }, (_, index) => buildBurialBrowseResult(
      {
        properties: {
          OBJECTID: 100 + index,
          First_Name: `Result${index + 1}`,
          Last_Name: "Person",
          Section: "99",
          Lot: `${index + 1}`,
          Tier: "0",
          Grave: "0",
        },
        geometry: {
          coordinates: [-73.73367 + (index * 0.00001), 42.71193],
        },
      },
      { getTourName }
    ));

    renderSidebar({
      burialRecords: sectionRecords,
      searchIndex: buildSearchIndex(sectionRecords, { getTourName }),
      sectionFilter: "99",
      showAllBurials: true,
    });

    flushBrowseTimers();

    const browseWorkspace = getBrowseWorkspace();
    const resultsList = within(browseWorkspace)
      .getAllByRole("list")
      .find((list) => !list.closest(".left-sidebar__selected-scroll"));

    expect(within(browseWorkspace).getByText("12 results")).toBeInTheDocument();
    expect(within(resultsList).getAllByRole("button")).toHaveLength(12);
    expect(within(resultsList).getByText("Result12 Person")).toBeInTheDocument();
    expect(within(browseWorkspace).queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
    expect(within(browseWorkspace).queryByRole("button", { name: "Show fewer" })).not.toBeInTheDocument();
  });

  domTest("tracks selected row hover by burial id", () => {
    const onHoverBurialChange = jest.fn();
    renderSidebar({
      selectedBurials: burialRecords,
      onHoverBurialChange,
    });

    const selectedPanel = screen.getByText("Graves at this spot").closest(".left-sidebar__panel");
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

    expect(screen.getByText("Selected grave")).toBeInTheDocument();
    expect(screen.queryByText("Selected burial")).not.toBeInTheDocument();
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

    expect(getCurrentMobileSheetSnap()).toBeCloseTo(390);
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

  // Build a burial record that produces >4 filtered detail rows (Role, Rank,
  // Initial term, Subsequent term, Unit, Headstone, Service — minus Location/Born/Died).
  const buildRichBurialRecord = () => buildBurialBrowseResult(
    {
      properties: {
        OBJECTID: 99,
        First_Name: "Margaret",
        Last_Name: "Wellstone",
        Section: "12",
        Lot: "7",
        Tier: "1",
        Grave: "3",
        Birth: "3/15/1880",
        Death: "11/2/1955",
        Titles: "Mayor",
        Highest_Ra: "Colonel",
        Initial_Te: "1920–1924",
        Subsequent: "1928–1932",
        Unit: "3rd Albany Volunteers",
        Headstone_: "Present",
        Service_Re: "Civil War veteran",
      },
      geometry: {
        coordinates: [-73.733, 42.712],
      },
    },
    { getTourName }
  );

  domTest("mobile compact card shows first 4 detail rows and a More-details toggle when record has more", () => {
    const richRecord = buildRichBurialRecord();

    renderSidebar({
      isMobile: true,
      activeBurialId: richRecord.id,
      selectedBurials: [richRecord],
    });

    const selectedSummary = screen.getByText("Selected grave").closest(".left-sidebar__panel");

    // Should show exactly the first 4 filtered rows (Role, Rank, Initial term, Subsequent term)
    expect(within(selectedSummary).getByText("Mayor")).toBeInTheDocument();
    expect(within(selectedSummary).getByText("Colonel")).toBeInTheDocument();
    expect(within(selectedSummary).getByText("1920–1924")).toBeInTheDocument();
    expect(within(selectedSummary).getByText("1928–1932")).toBeInTheDocument();

    // The 5th+ rows (Unit, Headstone, Service) should be hidden initially
    expect(within(selectedSummary).queryByText("3rd Albany Volunteers")).not.toBeInTheDocument();
    expect(within(selectedSummary).queryByText(/Civil War veteran/i)).not.toBeInTheDocument();

    // The hidden count is 3 (Unit, Headstone, Service)
    const toggleButton = within(selectedSummary).getByRole("button", { name: /More details \(3\)/i });
    expect(toggleButton).toBeInTheDocument();
  });

  domTest("mobile compact card toggle reveals hidden rows and then collapses them again", () => {
    const richRecord = buildRichBurialRecord();

    renderSidebar({
      isMobile: true,
      activeBurialId: richRecord.id,
      selectedBurials: [richRecord],
    });

    const selectedSummary = screen.getByText("Selected grave").closest(".left-sidebar__panel");

    // Expand
    fireEvent.click(within(selectedSummary).getByRole("button", { name: /More details/i }));

    expect(within(selectedSummary).getByText("3rd Albany Volunteers")).toBeInTheDocument();
    expect(within(selectedSummary).getByText(/Civil War veteran/i)).toBeInTheDocument();
    expect(within(selectedSummary).getByRole("button", { name: "Fewer details" })).toBeInTheDocument();

    // Collapse
    fireEvent.click(within(selectedSummary).getByRole("button", { name: "Fewer details" }));

    expect(within(selectedSummary).queryByText("3rd Albany Volunteers")).not.toBeInTheDocument();
    expect(within(selectedSummary).getByRole("button", { name: /More details/i })).toBeInTheDocument();
  });

  domTest("mobile compact card resets to collapsed when the selected burial changes", () => {
    const richRecord = buildRichBurialRecord();
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({
      isMobile: true,
      activeBurialId: richRecord.id,
      selectedBurials: [richRecord],
    });

    const selectedSummary = () => screen.getByText("Selected grave").closest(".left-sidebar__panel");

    // Expand
    fireEvent.click(within(selectedSummary()).getByRole("button", { name: /More details/i }));
    expect(within(selectedSummary()).getByText("3rd Albany Volunteers")).toBeInTheDocument();

    // Switch to a different burial
    rerender(
      <BurialSidebar
        {...rerenderProps}
        isMobile
        activeBurialId={burialRecords[0].id}
        selectedBurials={[burialRecords[0]]}
      />
    );

    // The toggle should be gone (Anna Tracy has no extra detail rows)
    expect(within(selectedSummary()).queryByRole("button", { name: /More details/i })).not.toBeInTheDocument();
    expect(within(selectedSummary()).queryByText("3rd Albany Volunteers")).not.toBeInTheDocument();
  });

  domTest("desktop lead card shows detail rows without a disclosure toggle", () => {
    const richRecord = buildRichBurialRecord();

    renderSidebar({
      activeBurialId: richRecord.id,
      selectedBurials: [richRecord],
    });

    const selectedPanel = getLeadSelectionCard();

    expect(within(selectedPanel).queryByRole("button", { name: "Show details" })).not.toBeInTheDocument();
    expect(within(selectedPanel).queryByRole("button", { name: "Hide details" })).not.toBeInTheDocument();
    expect(within(selectedPanel).getByText("Mayor")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("Colonel")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("1920–1924")).toBeInTheDocument();
    expect(within(selectedPanel).getByText("3rd Albany Volunteers")).toBeInTheDocument();
    expect(within(selectedPanel).getByText(/Civil War veteran/i)).toBeInTheDocument();
  });

  domTest("desktop lead card shows Details link when the record has a biography link", () => {
    const tourRecordWithLink = {
      ...burialRecords[0],
      id: "tour:Notable:bio:99:18",
      source: "tour",
      title: "Notable",
      tourKey: "Notable",
      tourName: "Notables Tour 2020",
      portraitImageName: "Schuyler70a.jpg",
      biographyLink: "Schuyler70",
    };

    const onFocusSelectedBurial = jest.fn();

    renderSidebar({
      activeBurialId: tourRecordWithLink.id,
      selectedBurials: [tourRecordWithLink],
      onFocusSelectedBurial,
    });

    const selectedPanel = getLeadSelectionCard();

    const detailsLink = within(selectedPanel).getByRole("link", { name: "Details" });
    expect(detailsLink).toHaveAttribute("href", "https://www.albany.edu/arce/Schuyler70.html");
    expect(detailsLink).toHaveAttribute("target", "_blank");
    expect(detailsLink).toHaveAttribute("rel", "noopener noreferrer");

    fireEvent.click(detailsLink);

    expect(onFocusSelectedBurial).not.toHaveBeenCalled();
  });

  domTest("desktop lead card replaces detail rows when the selected burial changes", () => {
    const richRecord = buildRichBurialRecord();
    const rerenderProps = createBaseProps();
    const { rerender } = renderSidebar({
      activeBurialId: richRecord.id,
      selectedBurials: [richRecord],
    });

    const getLeadPanel = () => getLeadSelectionCard();

    expect(within(getLeadPanel()).getByText("Mayor")).toBeInTheDocument();

    rerender(
      <BurialSidebar
        {...rerenderProps}
        activeBurialId={burialRecords[0].id}
        selectedBurials={[burialRecords[0]]}
      />
    );

    expect(screen.queryByRole("button", { name: "Show details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide details" })).not.toBeInTheDocument();
    expect(within(getLeadPanel()).queryByText("Mayor")).not.toBeInTheDocument();
  });
});
