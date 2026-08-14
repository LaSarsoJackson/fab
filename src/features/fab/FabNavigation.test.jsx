import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import FabNavigation, {
  FAB_APP_VIEWS,
  resolveFabAppView,
  syncFabAppViewUrl,
} from "./FabNavigation";

describe("FabNavigation", () => {
  it("defaults ordinary launches to Tours and preserves explicit hosted destinations", () => {
    expect(resolveFabAppView("")).toBe(FAB_APP_VIEWS.TOURS);
    expect(resolveFabAppView("?view=tours")).toBe(FAB_APP_VIEWS.TOURS);
    expect(resolveFabAppView("?view=burials")).toBe(FAB_APP_VIEWS.SEARCH);
    expect(resolveFabAppView("?view=map")).toBe(FAB_APP_VIEWS.MAP);
  });

  it("opens deep-linked map context directly on the map", () => {
    expect(resolveFabAppView("?view=burials&q=lamont")).toBe(FAB_APP_VIEWS.SEARCH);
    expect(resolveFabAppView("?view=tours&tour=notables")).toBe(FAB_APP_VIEWS.MAP);
    expect(resolveFabAppView("?section=215")).toBe(FAB_APP_VIEWS.MAP);
    expect(resolveFabAppView("?share=abc")).toBe(FAB_APP_VIEWS.MAP);
  });

  it("keeps the FABFG-compatible burials route name for Search", () => {
    expect(syncFabAppViewUrl(
      FAB_APP_VIEWS.SEARCH,
      "https://example.com/fab/?tour=notables"
    )).toBe("https://example.com/fab/?view=burials");
  });

  it("exposes three stable destinations and reports changes", () => {
    const onChange = jest.fn();
    render(<FabNavigation activeView={FAB_APP_VIEWS.TOURS} onChange={onChange} />);

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search Tours" })).toHaveAttribute("aria-current", "page");

    expect(screen.getByRole("button", { name: "Burial Locator" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ARCE" }));
    expect(onChange).toHaveBeenCalledWith(FAB_APP_VIEWS.MAP);
  });
});
