import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocatorView from "./LocatorView";

const createSearch = (overrides = {}) => ({
  status: "idle",
  results: [],
  total: 0,
  error: "",
  clear: vi.fn(),
  runSearch: vi.fn(),
  ...overrides,
});

describe("LocatorView", () => {
  it("keeps name and section search visible without repeating empty-state instructions", () => {
    const search = createSearch();
    const onRouteChange = vi.fn();
    render(
      <LocatorView
        search={search}
        onRouteChange={onRouteChange}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText("Search by name or cemetery section.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeVisible();
    expect(screen.getByLabelText("Section")).toBeVisible();
    expect(screen.queryByText(/Enter at least/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Hall" } });
    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "49" } });
    expect(onRouteChange).toHaveBeenNthCalledWith(1, { query: "Hall" });
    expect(onRouteChange).toHaveBeenNthCalledWith(2, { section: "49" });
  });

  it("searches a section directly and gives concise one-letter guidance", async () => {
    const search = createSearch();
    const { rerender } = render(
      <LocatorView
        initialSection="18"
        search={search}
        onRouteChange={() => {}}
        onSelect={() => {}}
      />
    );

    await waitFor(() => expect(search.runSearch).toHaveBeenCalledWith({ query: "", section: "18" }));

    rerender(
      <LocatorView
        initialQuery="A"
        search={search}
        onRouteChange={() => {}}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("Type at least 2 letters.")).toBeInTheDocument();
  });

  it("reports matches without database-oriented wording", () => {
    const search = createSearch({
      status: "ready",
      total: 84,
      results: [{ id: "1", displayName: "Abijah Hall", section: "8", lot: "11" }],
    });
    render(
      <LocatorView
        initialQuery="Hall"
        search={search}
        onRouteChange={() => {}}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText("84 matches · first 1 shown")).toBeInTheDocument();
    expect(screen.queryByText(/records/)).not.toBeInTheDocument();
  });
});
