import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const clearBurialSearch = vi.fn();
const runBurialSearch = vi.fn();

const TestMapView = ({
  active,
  records = [],
  selectedSection,
  showRecordMarkers,
  onBrowseSection,
  onSectionSelect,
}) => (
  <div
    aria-label="Albany Rural Cemetery map"
    data-active={active}
    data-record-count={records.length}
    data-record-markers={showRecordMarkers}
  >
    <button type="button" onClick={() => onSectionSelect("18")}>Select Section 18</button>
    {selectedSection ? (
      <div role="group" aria-label={`Section ${selectedSection}`}>
        <button type="button" onClick={() => onBrowseSection(selectedSection)}>View burials</button>
      </div>
    ) : null}
  </div>
);

const useTestBurialSearch = () => ({
  status: "idle",
  results: [],
  total: 0,
  error: "",
  clear: clearBurialSearch,
  runSearch: runBurialSearch,
});

const renderApp = (useBurialSearchHook = useTestBurialSearch) => render(
  <App MapComponent={TestMapView} useBurialSearchHook={useBurialSearchHook} />
);

describe("App product shell", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/fab/?view=tours");
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    delete window.ReactNativeWebView;
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
    renderApp();
    expect(screen.getByRole("heading", { name: "Search Tours" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search Tours" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Cemetery Map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Burial Locator" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ARCE website" })).toHaveAttribute("target", "_blank");
  });

  it("uses the route as the single tab state", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Burial Locator" }));
    expect(screen.getByRole("heading", { name: "Burial Locator" })).toBeInTheDocument();
    expect(window.location.search).toContain("view=burials");
  });

  it("lets FABFG own navigation in embedded mode", () => {
    window.history.replaceState({}, "", "/fab/?view=tours&embed=fabfg");
    renderApp();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Search Tours" })).toBeInTheDocument();
  });

  it("hands a cross-view tour route to FABFG without mutating the source view", () => {
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };
    window.history.replaceState({}, "", "/fab/?view=tours&embed=fabfg&campaign=summer");
    const sourceUrl = window.location.href;

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));

    expect(postMessage).toHaveBeenCalledOnce();
    expect(window.location.href).toBe(sourceUrl);
    expect(screen.getByRole("heading", { name: "Search Tours" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Notables Tour 2020" }))
      .not.toBeInTheDocument();
    const message = JSON.parse(postMessage.mock.calls[0][0]);
    const url = new URL(message.url);
    expect(message).toMatchObject({ type: "fab.route-change.v1", view: "map" });
    expect(url.searchParams.get("view")).toBe("map");
    expect(url.searchParams.get("tour")).toBe("Notable");
    expect(url.searchParams.get("embed")).toBe("fabfg");
    expect(url.searchParams.get("campaign")).toBe("summer");
  });

  it("tells FABFG to open Map with the complete selected burial URL", () => {
    const burial = {
      id: "burial:section-18:first",
      source: "burial",
      displayName: "Section record",
      section: "18",
      coordinates: [-73.73, 42.7],
    };
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };
    window.history.replaceState(
      {},
      "",
      "/fab/?view=burials&embed=fabfg&q=Hall&section=18"
    );

    renderApp(() => ({
      status: "ready",
      results: [burial],
      total: 1,
      error: "",
      clear: clearBurialSearch,
      runSearch: runBurialSearch,
    }));
    fireEvent.click(screen.getByRole("button", { name: /Section record/ }));

    expect(postMessage).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Burial Locator" })).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("view")).toBe("burials");
    expect(screen.queryByRole("heading", { name: "Section record" })).not.toBeInTheDocument();
    const message = JSON.parse(postMessage.mock.calls[0][0]);
    const url = new URL(message.url);
    expect(message).toMatchObject({ type: "fab.route-change.v1", view: "map" });
    expect(url.searchParams.get("record")).toBe(burial.id);
    expect(url.searchParams.get("q")).toBe("Hall");
    expect(url.searchParams.get("section")).toBe("18");
    expect(url.searchParams.get("embed")).toBe("fabfg");
  });

  it("tells FABFG to open Burials with the selected map section", () => {
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };
    window.history.replaceState({}, "", "/fab/?view=map&embed=fabfg");

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Select Section 18" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Section 18" }))
      .getByRole("button", { name: "View burials" }));

    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("region", { name: "Cemetery Map" })).toBeVisible();
    expect(new URL(window.location.href).searchParams.get("view")).toBe("map");
    const message = JSON.parse(postMessage.mock.calls.at(-1)[0]);
    const url = new URL(message.url);
    expect(message).toMatchObject({ type: "fab.route-change.v1", view: "burials" });
    expect(url.searchParams.get("view")).toBe("burials");
    expect(url.searchParams.get("section")).toBe("18");
    expect(url.searchParams.get("embed")).toBe("fabfg");
  });

  it.each([
    ["a missing bridge", undefined],
    ["a throwing bridge", { postMessage: vi.fn(() => { throw new Error("disconnected"); }) }],
  ])("navigates locally when an embedded cross-view handoff has %s", async (_label, bridge) => {
    window.history.replaceState({}, "", "/fab/?view=tours&embed=fabfg");
    if (bridge) window.ReactNativeWebView = bridge;

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));

    expect(await screen.findByRole("complementary", { name: "Notables Tour 2020" }))
      .toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("view")).toBe("map");
  });

  it("keeps same-view embedded changes local and posts their durable route", () => {
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };
    window.history.replaceState({}, "", "/fab/?view=map&embed=fabfg");

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Select Section 18" }));

    expect(new URL(window.location.href).searchParams.get("section")).toBe("18");
    expect(screen.getByRole("group", { name: "Section 18" })).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledOnce();
    expect(new URL(JSON.parse(postMessage.mock.calls[0][0]).url).searchParams.get("section"))
      .toBe("18");
  });

  it("posts the visible embedded route after WebView Back/popstate", () => {
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };
    const view = renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Cemetery Map" }));
    expect(postMessage).not.toHaveBeenCalled();

    view.unmount();
    window.history.replaceState({}, "", "/fab/?view=tours&embed=fabfg");
    renderApp();
    window.history.pushState({}, "", "/fab/?view=tours&embed=fabfg&q=Hall");
    fireEvent.popState(window);
    expect(postMessage).toHaveBeenCalledOnce();
    expect(JSON.parse(postMessage.mock.calls[0][0])).toMatchObject({
      type: "fab.route-change.v1",
      view: "tours",
      url: window.location.href,
    });
  });

  it("selects a tour stop without relying on the canvas and restores its deep link", async () => {
    const firstRender = renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));

    const panel = await screen.findByRole("complementary", { name: "Notables Tour 2020" });
    fireEvent.click(within(panel).getByRole("button", { name: /James Hall/ }));
    expect(screen.getByRole("heading", { name: "James Hall" })).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("record"))
      .toBe("tour:Notable:1:18:93");

    firstRender.unmount();
    renderApp();
    expect(await screen.findByRole("heading", { name: "James Hall" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(await screen.findByRole("button", { name: /James Hall/ }))
      .toHaveAttribute("aria-current", "location");
  });

  it("preserves the active map and tour across destination changes", async () => {
    renderApp();
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

  it("returns to all tours without erasing the last place", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));
    const panel = await screen.findByRole("complementary", { name: "Notables Tour 2020" });
    fireEvent.click(within(panel).getByRole("button", { name: /James Hall/ }));

    fireEvent.click(within(panel).getByRole("button", { name: "Back to Search Tours" }));

    expect(screen.getByRole("heading", { name: "Search Tours" })).toBeInTheDocument();
    expect(new URL(window.location.href).search).toBe("?view=tours");
    expect(screen.getByRole("button", {
      name: "Continue tour: Notables Tour 2020 from James Hall",
    })).toBeInTheDocument();
  });

  it("keeps a section highlighted and opens its useful burial list explicitly", async () => {
    window.history.replaceState({}, "", "/fab/?view=map");
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Select Section 18" }));
    expect(screen.getByRole("region", { name: "Cemetery Map" })).toBeVisible();
    expect(new URL(window.location.href).searchParams.get("section")).toBe("18");

    const sectionContext = screen.getByRole("group", { name: "Section 18" });
    expect(runBurialSearch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Albany Rural Cemetery map"))
      .toHaveAttribute("data-record-count", "0");

    fireEvent.click(screen.getByRole("button", { name: "Select Section 18" }));
    expect(screen.getByLabelText("Albany Rural Cemetery map"))
      .toHaveAttribute("data-record-count", "0");

    fireEvent.click(within(sectionContext).getByRole("button", { name: "View burials" }));
    expect(screen.getByRole("heading", { name: "Burial Locator" })).toBeInTheDocument();
    expect(screen.getByLabelText("Section")).toHaveValue("18");
  });

  it("turns a section click into a section map without losing the resumable tour", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));
    const panel = await screen.findByRole("complementary", { name: "Notables Tour 2020" });
    fireEvent.click(within(panel).getByRole("button", { name: /James Hall/ }));

    fireEvent.click(screen.getByRole("button", { name: "Select Section 18" }));
    const params = new URL(window.location.href).searchParams;
    expect(params.get("section")).toBe("18");
    expect(params.has("tour")).toBe(false);
    expect(params.has("record")).toBe(false);
    expect(runBurialSearch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Albany Rural Cemetery map"))
      .toHaveAttribute("data-record-count", "0");

    fireEvent.click(screen.getByRole("button", { name: "Search Tours" }));
    expect(screen.getByRole("button", { name: "Continue tour: Notables Tour 2020 from James Hall" }))
      .toBeInTheDocument();
  });

  it("offers a saved place as a calm way back into a tour", async () => {
    renderApp();
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
    renderApp();
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
    renderApp();
    expect(await screen.findByRole("heading", { name: "James Hall" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select Section 18" }));
    expect(runBurialSearch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search Tours" }));

    expect(screen.getByRole("button", {
      name: "Continue tour: Notables Tour 2020 from James Hall",
    })).toBeInTheDocument();
  });

  it("does not turn a mapped collection into an invented itinerary", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Section 49/ }));
    const panel = await screen.findByRole("complementary", { name: "Section 49" });
    expect(screen.getByLabelText("Albany Rural Cemetery map"))
      .toHaveAttribute("data-record-markers", "false");
    const collectionPlace = panel.querySelector(".tour-stop");
    expect(collectionPlace).not.toBeNull();
    fireEvent.click(collectionPlace);

    expect(screen.queryByRole("navigation", { name: "Tour stops" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Place \d+ of/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpin" })).toBeInTheDocument();
  }, 10_000);

  it("shares a portable record link outside the FABFG shell", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    window.history.replaceState(
      {},
      "",
      "/fab/?view=map&tour=Notable&record=tour%3ANotable%3A1%3A18%3A93&embed=fabfg&q=old&section=18"
    );

    renderApp();
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
