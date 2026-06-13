/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppErrorBoundary from "./AppErrorBoundary";

const ThrowingChild = () => {
  throw new Error("boom");
};

describe("AppErrorBoundary", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // React logs caught render errors to console.error; silence the noise so a
    // passing run does not look like a failure.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("renders children when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <div>Map content</div>
      </AppErrorBoundary>
    );

    expect(screen.getByText("Map content")).toBeInTheDocument();
  });

  test("renders the fallback copy when a child throws", () => {
    render(
      <AppErrorBoundary
        title="Map unavailable"
        message="The map failed to load."
        reloadLabel="Reload"
      >
        <ThrowingChild />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Map unavailable")).toBeInTheDocument();
    expect(screen.getByText("The map failed to load.")).toBeInTheDocument();
  });

  test("reloads the page when the recovery action is pressed", () => {
    const reload = jest.fn();
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, reload };

    try {
      render(
        <AppErrorBoundary reloadLabel="Reload">
          <ThrowingChild />
        </AppErrorBoundary>
      );

      fireEvent.click(screen.getByRole("button", { name: "Reload" }));

      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      window.location = originalLocation;
    }
  });
});
