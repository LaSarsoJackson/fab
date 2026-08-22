import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { clearBurialSearch, runBurialSearch } = vi.hoisted(() => ({
  clearBurialSearch: vi.fn(),
  runBurialSearch: vi.fn(),
}));

vi.mock("./features/map/MapView", () => ({
  default: ({
    active,
    records = [],
    sectionRecordCount,
    selectedSection,
    onBrowseSection,
    onSectionSelect,
  }) => (
    <div
      aria-label="Albany Rural Cemetery map"
      data-active={active}
      data-record-count={records.length}
    >
      <button type="button" onClick={() => onSectionSelect("18")}>Select Section 18</button>
      {selectedSection ? (
        <div role="group" aria-label={`Section ${selectedSection}`}>
          {sectionRecordCount ? <span>{sectionRecordCount} burials</span> : null}
          <button type="button" onClick={() => onBrowseSection(selectedSection)}>List</button>
        </div>
      ) : null}
    </div>
  ),
}));

vi.mock("./features/locator/useBurialSearch", () => ({
  default: () => ({
    status: "idle",
    results: [],
    total: 0,
    error: "",
    clear: clearBurialSearch,
    runSearch: runBurialSearch,
  }),
}));

describe("App product shell", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/fab/?view=tours");
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    window.localStorage.clear();
    clearBurialSearch.mockReset();
    runBurialSearch.mockReset();
    runBurialSearch.mockResolvedValue([
      {
        id: "burial:section-18:first",
        source: "burial",
        displayName: "Section record",
        section: "18",
        coordinates: [-73.73, 42.7],
      },
    ]);
  });

  it("starts with tours and exposes three unambiguous destinations", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Search Tours" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search Tours" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Cemetery Map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Burial Locator" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ARCE website" })).toHaveAttribute("target", "_blank");
  });

  it("uses the route as the single tab state", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Burial Locator" }));
    expect(screen.getByRole("heading", { name: "Burial Locator" })).toBeInTheDocument();
    expect(window.location.search).toContain("view=burials");
  });

  it("lets FABFG own navigation in embedded mode", () => {
    window.history.replaceState({}, "", "/fab/?view=tours&embed=fabfg");
    render(<App />);
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Search Tours" })).toBeInTheDocument();
  });

  it("selects a tour stop without relying on the canvas and restores its deep link", async () => {
    const firstRender = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));

    const panel = await screen.findByRole("complementary", { name: "Notables Tour 2020" });
    fireEvent.click(within(panel).getByRole("button", { name: /James Hall/ }));
    expect(screen.getByRole("heading", { name: "James Hall" })).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("record"))
      .toBe("tour:Notable:1:18:93");

    firstRender.unmount();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "James Hall" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(await screen.findByRole("button", { name: /James Hall/ }))
      .toHaveAttribute("aria-current", "location");
  });

  it("preserves the active map and tour across destination changes", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));

    const map = await screen.findByLabelText("Albany Rural Cemetery map");
    await waitFor(() => expect(Number(map.dataset.recordCount)).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Search Tours" }));
    fireEvent.click(screen.getByRole("button", { name: "Cemetery Map" }));

    expect(screen.getByLabelText("Albany Rural Cemetery map")).toBe(map);
    expect(map).toHaveAttribute("data-active", "true");
    expect(Number(map.dataset.recordCount)).toBeGreaterThan(0);
    const params = new URL(window.location.href).searchParams;
    expect(params.get("view")).toBe("map");
    expect(params.get("tour")).toBe("Notable");
  });

  it("keeps a section on the map, reveals its burials there, and opens its list explicitly", async () => {
    window.history.replaceState({}, "", "/fab/?view=map");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Select Section 18" }));
    expect(screen.getByRole("region", { name: "Cemetery Map" })).toBeVisible();
    expect(new URL(window.location.href).searchParams.get("section")).toBe("18");

    const sectionContext = screen.getByRole("group", { name: "Section 18" });
    await waitFor(() => expect(runBurialSearch).toHaveBeenCalledWith({ section: "18", limit: 5000 }));
    await waitFor(() => expect(screen.getByLabelText("Albany Rural Cemetery map"))
      .toHaveAttribute("data-record-count", "1"));
    expect(within(sectionContext).getByText("1 burials")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select Section 18" }));
    expect(screen.getByLabelText("Albany Rural Cemetery map"))
      .toHaveAttribute("data-record-count", "1");

    fireEvent.click(within(sectionContext).getByRole("button", { name: "List" }));
    expect(screen.getByRole("heading", { name: "Burial Locator" })).toBeInTheDocument();
    expect(screen.getByLabelText("Section number")).toHaveValue("18");
  });

  it("turns a section click into a section map without losing the resumable tour", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));
    const panel = await screen.findByRole("complementary", { name: "Notables Tour 2020" });
    fireEvent.click(within(panel).getByRole("button", { name: /James Hall/ }));

    fireEvent.click(screen.getByRole("button", { name: "Select Section 18" }));
    await waitFor(() => expect(runBurialSearch).toHaveBeenCalledWith({ section: "18", limit: 5000 }));
    const params = new URL(window.location.href).searchParams;
    expect(params.get("section")).toBe("18");
    expect(params.has("tour")).toBe(false);
    expect(params.has("record")).toBe(false);
    await waitFor(() => expect(screen.getByLabelText("Albany Rural Cemetery map"))
      .toHaveAttribute("data-record-count", "1"));

    fireEvent.click(screen.getByRole("button", { name: "Search Tours" }));
    expect(screen.getByRole("button", { name: "Continue tour: Notables Tour 2020 from James Hall" }))
      .toBeInTheDocument();
  });

  it("offers a saved place as a calm way back into a tour", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));
    const panel = await screen.findByRole("complementary", { name: "Notables Tour 2020" });
    fireEvent.click(within(panel).getByRole("button", { name: /James Hall/ }));
    fireEvent.click(screen.getByRole("button", { name: "All places" }));

    fireEvent.click(screen.getByRole("button", { name: "Search Tours" }));
    const continueButton = screen.getByRole("button", { name: "Continue tour: Notables Tour 2020 from James Hall" });
    fireEvent.click(continueButton);

    expect(await screen.findByRole("heading", { name: "James Hall" })).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("record"))
      .toBe("tour:Notable:1:18:93");
  });

  it("continues the saved tour place after viewing an unrelated burial", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));
    const panel = await screen.findByRole("complementary", { name: "Notables Tour 2020" });
    fireEvent.click(within(panel).getByRole("button", { name: /James Hall/ }));

    window.history.pushState({}, "", "/fab/?view=map&record=burial%3Aunrelated");
    fireEvent.popState(window);
    expect(await screen.findByRole("heading", { name: "Section record" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Search Tours" }));
    const continueButton = screen.getByRole("button", {
      name: "Continue tour: Notables Tour 2020 from James Hall",
    });
    fireEvent.click(continueButton);

    expect(await screen.findByRole("heading", { name: "James Hall" })).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("record"))
      .toBe("tour:Notable:1:18:93");
  });

  it("makes a directly linked tour place resumable", async () => {
    window.history.replaceState(
      {},
      "",
      "/fab/?view=map&tour=Notable&record=tour%3ANotable%3A1%3A18%3A93"
    );
    render(<App />);
    expect(await screen.findByRole("heading", { name: "James Hall" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select Section 18" }));
    await waitFor(() => expect(runBurialSearch).toHaveBeenCalledWith({ section: "18", limit: 5000 }));
    fireEvent.click(screen.getByRole("button", { name: "Search Tours" }));

    expect(screen.getByRole("button", {
      name: "Continue tour: Notables Tour 2020 from James Hall",
    })).toBeInTheDocument();
  });

  it("does not turn a mapped collection into an invented itinerary", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Section 49/ }));
    const panel = await screen.findByRole("complementary", { name: "Section 49" });
    fireEvent.click(within(panel).getAllByRole("button")[0]);

    expect(screen.queryByRole("navigation", { name: "Tour places" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Place \d+ of/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpin" })).toBeInTheDocument();
  });

  it("shares a portable record link outside the FABFG shell", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    window.history.replaceState(
      {},
      "",
      "/fab/?view=map&tour=Notable&record=tour%3ANotable%3A1%3A18%3A93&embed=fabfg&q=old&section=18"
    );

    render(<App />);
    expect(await screen.findByRole("heading", { name: "James Hall" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Share pinned grave"));
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));

    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    const sharedUrl = new URL(share.mock.calls[0][0].url);
    expect(sharedUrl.searchParams.get("view")).toBe("map");
    expect(sharedUrl.searchParams.get("tour")).toBe("Notable");
    expect(sharedUrl.searchParams.get("record")).toBe("tour:Notable:1:18:93");
    expect(sharedUrl.searchParams.has("embed")).toBe(false);
    expect(sharedUrl.searchParams.has("q")).toBe(false);
    expect(sharedUrl.searchParams.has("section")).toBe(false);
  });
});
