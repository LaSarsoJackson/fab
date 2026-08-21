import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./features/map/MapView", () => ({
  default: ({ records = [] }) => (
    <div aria-label="Albany Rural Cemetery map" data-record-count={records.length} />
  ),
}));

describe("App product shell", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/fab/?view=tours");
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
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

  it("opens Cemetery Map as a clean destination instead of retaining a tour", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Notables Tour 2020/ }));

    const map = await screen.findByLabelText("Albany Rural Cemetery map");
    await waitFor(() => expect(Number(map.dataset.recordCount)).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Cemetery Map" }));

    await waitFor(() => expect(map).toHaveAttribute("data-record-count", "0"));
    const params = new URL(window.location.href).searchParams;
    expect(params.get("view")).toBe("map");
    expect(params.has("tour")).toBe(false);
    expect(params.has("record")).toBe(false);
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
