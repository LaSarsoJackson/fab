/** @jest-environment jsdom */

import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";
import { APP_PROFILE } from "./features/fab/profile";

jest.mock("./Map", () => ({
  __esModule: true,
  default: () => <div>Map stub</div>,
}));

const renderApp = () => render(<App />);

describe("App", () => {
  const originalHash = window.location.hash;
  const originalTitle = document.title;
  const originalHead = document.head.innerHTML;

  beforeEach(() => {
    window.location.hash = "";
    document.title = "";

    if (!document.head.querySelector('meta[name="description"]')) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    document.head.querySelector('meta[name="description"]').setAttribute("content", "");
  });

  afterEach(() => {
    window.location.hash = originalHash;
    document.title = originalTitle;
    document.head.innerHTML = originalHead;
  });

  test("syncs the document title and description from the app profile", async () => {
    renderApp();

    await screen.findByText("Map stub");

    expect(document.title).toBe(APP_PROFILE.shell?.documentTitle || APP_PROFILE.brand?.appName);
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      APP_PROFILE.shell?.description || ""
    );
  });

  test("renders the map shell from the production app entrypoint", async () => {
    renderApp();

    expect(await screen.findByText("Map stub")).toBeInTheDocument();
  });

  test("batches visual viewport changes into one animation frame and cleans them up", async () => {
    const viewportListeners = new Map();
    const visualViewport = {
      height: 720,
      width: 390,
      offsetTop: 18,
      addEventListener: jest.fn((type, listener) => {
        viewportListeners.set(type, listener);
      }),
      removeEventListener: jest.fn(),
    };
    const originalVisualViewport = window.visualViewport;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    let scheduledFrame = null;

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewport,
    });
    window.requestAnimationFrame = jest.fn((callback) => {
      scheduledFrame = callback;
      return 37;
    });
    window.cancelAnimationFrame = jest.fn();
    const setPropertySpy = jest.spyOn(document.documentElement.style, "setProperty");

    const { unmount } = renderApp();
    await screen.findByText("Map stub");

    expect(setPropertySpy).toHaveBeenCalledTimes(3);
    expect(visualViewport.addEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      { passive: true }
    );

    setPropertySpy.mockClear();
    act(() => {
      viewportListeners.get("scroll")();
      viewportListeners.get("resize")();
    });

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(setPropertySpy).not.toHaveBeenCalled();

    act(() => {
      scheduledFrame();
    });

    expect(setPropertySpy).toHaveBeenCalledTimes(3);

    act(() => {
      viewportListeners.get("scroll")();
    });
    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(37);
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function)
    );

    setPropertySpy.mockRestore();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: originalVisualViewport,
    });
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });
});
