/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import BrowseWorkspacePanel from "./BrowseWorkspacePanel";

const noop = () => {};

const baseProps = {
  autocompleteComponentsProps: {},
  autocompleteListboxProps: {},
  burialDataError: null,
  browseQuery: "",
  filterType: "lot",
  hasGlobalResetState: false,
  hasSectionFilters: false,
  hasTourBrowse: true,
  hasTourSelection: false,
  isBrowsePending: false,
  isBurialDataLoading: false,
  isMobile: false,
  isSectionBrowseVisible: false,
  isTourBrowseVisible: false,
  lotTierFilter: "",
  onBrowseQueryChange: noop,
  onBrowseSourceChange: noop,
  onClearAllBrowseState: noop,
  onClearBrowseQuery: noop,
  onClearSectionFilters: noop,
  onClearTourSelection: noop,
  onFilterTypeSelection: noop,
  onLotTierChange: noop,
  onRequestBurialDataLoad: noop,
  onSectionSelection: noop,
  onToggleSectionMarkers: noop,
  onTourSelection: noop,
  searchPlaceholder: "Search burials",
  searchShellNotices: [],
  sectionFilter: "",
  selectedSectionOption: null,
  selectedTour: null,
  showAllBurials: false,
  tourDefinitions: [
    { key: "notables", name: "Notables Tour 2020" },
    { key: "civilWar", name: "Civil War Tour 2020" },
  ],
  tourLabel: "Tour",
  tourStyles: { notables: { color: "#123456" }, civilWar: { color: "#654321" } },
  uniqueSections: ["1", "12", "100A"],
};

const renderPanel = (overrides = {}) => render(
  <BrowseWorkspacePanel {...baseProps} {...overrides} />
);

describe("BrowseWorkspacePanel search field", () => {
  test("renders the search field with the provided placeholder", () => {
    renderPanel();
    expect(screen.getByPlaceholderText("Search burials")).toBeInTheDocument();
  });

  test("hides the search field when showSearchField is false", () => {
    renderPanel({ showSearchField: false });
    expect(screen.queryByPlaceholderText("Search burials")).not.toBeInTheDocument();
  });

  test("forwards typing and focus to the owning callbacks", () => {
    const onBrowseQueryChange = jest.fn();
    const onRequestBurialDataLoad = jest.fn();
    renderPanel({ onBrowseQueryChange, onRequestBurialDataLoad });

    const input = screen.getByLabelText("Search burials");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "doe" } });

    expect(onRequestBurialDataLoad).toHaveBeenCalledTimes(1);
    expect(onBrowseQueryChange).toHaveBeenCalledTimes(1);
  });

  test("shows the clear affordance only when a query is present", () => {
    const onClearBrowseQuery = jest.fn();
    const { rerender } = renderPanel({ browseQuery: "" });
    expect(screen.queryByLabelText("Clear search query")).not.toBeInTheDocument();

    rerender(<BrowseWorkspacePanel {...baseProps} browseQuery="doe" onClearBrowseQuery={onClearBrowseQuery} />);
    fireEvent.click(screen.getByLabelText("Clear search query"));
    expect(onClearBrowseQuery).toHaveBeenCalledTimes(1);
  });
});

describe("BrowseWorkspacePanel visit tasks", () => {
  test("offers the tours task only when tour browsing is available", () => {
    const onBrowseSourceChange = jest.fn();
    renderPanel({ onBrowseSourceChange });

    fireEvent.click(screen.getByRole("button", { name: "Tours" }));
    fireEvent.click(screen.getByRole("button", { name: "Sections" }));

    expect(onBrowseSourceChange).toHaveBeenNthCalledWith(1, "tour");
    expect(onBrowseSourceChange).toHaveBeenNthCalledWith(2, "section");
  });

  test("drops the tours task when tour browsing is unavailable", () => {
    renderPanel({ hasTourBrowse: false });
    expect(screen.queryByRole("button", { name: "Tours" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sections" })).toBeInTheDocument();
  });

  test("hides the visit tasks on mobile while a query owns the sheet", () => {
    renderPanel({ isMobile: true, browseQuery: "doe" });
    expect(screen.queryByRole("button", { name: "Sections" })).not.toBeInTheDocument();
  });
});

describe("BrowseWorkspacePanel toolbar", () => {
  test("renders the reset action and forwards clicks when reset state exists", () => {
    const onClearAllBrowseState = jest.fn();
    renderPanel({ hasGlobalResetState: true, onClearAllBrowseState });

    fireEvent.click(screen.getByRole("button", { name: "Clear all browse filters" }));
    expect(onClearAllBrowseState).toHaveBeenCalledTimes(1);
  });

  test("omits the reset action when there is nothing to reset", () => {
    renderPanel({ hasGlobalResetState: false });
    expect(screen.queryByRole("button", { name: "Clear all browse filters" })).not.toBeInTheDocument();
  });
});

describe("BrowseWorkspacePanel section controls", () => {
  test("prompts the user to choose a section before one is focused", () => {
    renderPanel({ isSectionBrowseVisible: true });
    expect(screen.getByText("Choose a section to zoom in.")).toBeInTheDocument();
  });

  test("exposes refinement controls once a section is focused", () => {
    const onToggleSectionMarkers = jest.fn();
    const onFilterTypeSelection = jest.fn();
    const onLotTierChange = jest.fn();
    renderPanel({
      isSectionBrowseVisible: true,
      sectionFilter: "12",
      onToggleSectionMarkers,
      onFilterTypeSelection,
      onLotTierChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Show grave markers in this section" }));
    expect(onToggleSectionMarkers).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Tier" }));
    expect(onFilterTypeSelection).toHaveBeenCalledWith("tier");

    fireEvent.change(screen.getByLabelText("Lot Number"), { target: { value: "8" } });
    expect(onLotTierChange).toHaveBeenCalledWith("8");
  });

  test("offers a clear action when section filters are active", () => {
    const onClearSectionFilters = jest.fn();
    renderPanel({
      isSectionBrowseVisible: true,
      sectionFilter: "12",
      hasSectionFilters: true,
      onClearSectionFilters,
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClearSectionFilters).toHaveBeenCalledTimes(1);
  });
});

describe("BrowseWorkspacePanel tour controls", () => {
  test("renders the tour chooser when tour browsing is visible", () => {
    renderPanel({ isTourBrowseVisible: true });
    expect(screen.getByText("Choose tour")).toBeInTheDocument();
    expect(
      screen.getByText("Switch to one curated route when you want guided stops.")
    ).toBeInTheDocument();
  });

  test("offers a clear action when a tour is selected", () => {
    const onClearTourSelection = jest.fn();
    renderPanel({
      isTourBrowseVisible: true,
      hasTourSelection: true,
      onClearTourSelection,
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClearTourSelection).toHaveBeenCalledTimes(1);
  });
});

describe("BrowseWorkspacePanel content slots", () => {
  test("promotes priority content above the search composer", () => {
    renderPanel({ priorityContent: <div data-testid="priority">Selected grave</div> });
    expect(screen.getByTestId("priority")).toBeInTheDocument();
  });

  test("renders search shell notices", () => {
    renderPanel({
      searchShellNotices: [
        { key: "loading", tone: "info", label: "Loading burial records" },
      ],
    });
    expect(screen.getByText("Loading burial records")).toBeInTheDocument();
  });

  test("renders supplied results content", () => {
    renderPanel({ resultsContent: <div data-testid="results">Results</div> });
    expect(screen.getByTestId("results")).toBeInTheDocument();
  });
});
