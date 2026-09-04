import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ToursView from "./ToursView";

describe("ToursView", () => {
  it("uses visitor actions instead of product taxonomy", () => {
    render(<ToursView onContinueTour={() => {}} onSelectTour={() => {}} />);

    expect(screen.getByText("Choose a tour or browse graves by section or group."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Soldier's Lot.*Browse graves/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Notables Tour 2020.*View stops/ })).toBeInTheDocument();
    expect(screen.queryByText(/collection/i)).not.toBeInTheDocument();
  });

  it("filters the list and keeps the selected action direct", async () => {
    const onSelectTour = vi.fn();
    render(<ToursView onContinueTour={() => {}} onSelectTour={onSelectTour} />);

    fireEvent.change(screen.getByPlaceholderText("Find a tour"), { target: { value: "Mayors" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /Mayors of Albany.*View stops/ })).toBeVisible());
    expect(screen.queryByRole("button", { name: /Notables Tour 2020/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Mayors of Albany.*View stops/ }));
    expect(onSelectTour).toHaveBeenCalledWith(expect.objectContaining({ key: "MayorsOfAlbany" }));
  });
});
