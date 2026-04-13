/** @jest-environment jsdom */

import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import BurialSidebar from "./BurialSidebar";
import { buildSearchIndex } from "./lib/burialSearch";
import { buildBurialBrowseResult } from "./lib/browseResults";

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
  filterType: "lot",
  getTourName,
  hoveredIndex: null,
  initialQuery: "",
  installPromptEvent: null,
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
  onHoverIndexChange: jest.fn(),
  onLocateMarker: jest.fn(),
  onLotTierFilterChange: jest.fn(),
  onOpenAppMenu: jest.fn(),
  onOpenDirectionsMenu: jest.fn(),
  onRemoveSelectedBurial: jest.fn(),
  onSectionChange: jest.fn(),
  onToggleSectionMarkers: jest.fn(),
  onTourChange: jest.fn(),
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

const renderSidebar = (props = {}) => render(<BurialSidebar {...createBaseProps()} {...props} />);

describe("BurialSidebar", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  domTest("updates the query immediately, keeps previous results during async refresh, and selects a result row", () => {
    const onBrowseResultSelect = jest.fn();

    renderSidebar({
      onBrowseResultSelect,
      sectionFilter: "99",
      showAllBurials: true,
    });

    flushBrowseTimers();

    expect(screen.getByText("Anna Tracy")).toBeInTheDocument();
    expect(screen.getByText("Thomas Tracy")).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Search within this section/i);
    fireEvent.change(input, { target: { value: "anna" } });

    expect(input).toHaveValue("anna");
    expect(screen.getByText("Thomas Tracy")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0);

    flushBrowseTimers();

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

  domTest("expands the mobile sheet on focus and supports query chip clearing", () => {
    renderSidebar({ isMobile: true });

    expect(screen.queryByText("Browse")).not.toBeInTheDocument();
    expect(screen.queryByText("Find people, graves, sections, and tour stops.")).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Search all burial records/i);
    fireEvent.focus(input);

    expect(screen.getByText("Browse")).toBeInTheDocument();
    expect(screen.getByText("Find people, graves, sections, and tour stops.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "anna" } });
    flushBrowseTimers();

    expect(screen.getByText("Search: anna")).toBeInTheDocument();
    expect(screen.getByText("Anna Tracy")).toBeInTheDocument();
    expect(screen.queryByText("Thomas Tracy")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("clear-query-chip"));

    expect(input).toHaveValue("");
  });

  domTest("clears active browse chips through shared callbacks", () => {
    const onClearSectionFilters = jest.fn();
    const onClearSelectedBurials = jest.fn();
    const onLotTierFilterChange = jest.fn();
    const onTourChange = jest.fn();

    renderSidebar({
      isMobile: true,
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

    expect(screen.getByText("Search: anna")).toBeInTheDocument();
    expect(screen.getByText("Section 99")).toBeInTheDocument();
    expect(screen.getByText("Lot 18")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("clear-section-chip"));
    fireEvent.click(screen.getByTestId("clear-lot-tier-chip"));
    fireEvent.click(screen.getByLabelText("Clear all browse filters"));

    expect(onClearSectionFilters).toHaveBeenCalled();
    expect(onClearSelectedBurials).toHaveBeenCalled();
    expect(onLotTierFilterChange).toHaveBeenCalledWith("");
    expect(onTourChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  domTest("keeps the tour browse mode active when the selected tour chip is cleared", () => {
    const onTourChange = jest.fn();
    const { rerender } = renderSidebar({
      isMobile: true,
      selectedTour: "Notables Tour 2020",
      onTourChange,
    });

    flushBrowseTimers();

    expect(screen.getByText("Notables Tour 2020")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("clear-tour-chip"));

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

    expect(screen.getByText("Browse: Tour")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Choose a tour, then search within it/i)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Section" }));

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

    expect(screen.getByText("Choose section")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Choose a section, then search within it/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All records" }));

    expect(screen.queryByText("Choose section")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search all burial records/i)).toBeInTheDocument();
  });

  domTest("renders the Burial Finder header link to the ARCE homepage", () => {
    renderSidebar();

    const link = screen.getByRole("link", { name: "Burial Finder" });

    expect(link).toHaveAttribute("href", "https://www.albany.edu/arce/");
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
        selectedBurials={[burialRecords[0]]}
        onClearSelectedBurials={onClearSelectedBurials}
      />
    );

    flushBrowseTimers();

    expect(screen.getByText("Selected People")).toBeInTheDocument();
    expect(screen.getByText("Results")).toBeInTheDocument();
    expect(screen.getByText("Directions")).toBeInTheDocument();

    const selectedSummary = screen.getByText("Selected People").closest(".left-sidebar__panel");
    fireEvent.click(within(selectedSummary).getByRole("button", { name: "Hide" }));

    expect(screen.queryByText("Directions")).not.toBeInTheDocument();
    expect(screen.getByText("Results")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear"));

    expect(onClearSelectedBurials).toHaveBeenCalled();
  });

  domTest("defaults the results selector to 10 and removes always-on status pills", () => {
    renderSidebar({ sectionFilter: "99", showAllBurials: true });

    flushBrowseTimers();

    expect(screen.getByText("10 results")).toBeInTheDocument();
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
