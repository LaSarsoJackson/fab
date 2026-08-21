import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "./AppErrorBoundary";

const ThrowingChild = () => {
  throw new Error("boom");
};

describe("AppErrorBoundary", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("renders children when nothing throws", () => {
    render(<AppErrorBoundary><div>Map content</div></AppErrorBoundary>);
    expect(screen.getByText("Map content")).toBeInTheDocument();
  });

  it("renders a useful recovery message", () => {
    render(
      <AppErrorBoundary title="Map unavailable" message="The map failed to load.">
        <ThrowingChild />
      </AppErrorBoundary>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Map unavailable");
    expect(screen.getByRole("alert")).toHaveTextContent("The map failed to load.");
  });
});
