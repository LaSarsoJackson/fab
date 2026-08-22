import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import TourStopsPanel from "./TourStopsPanel";

const tour = { key: "Notable", name: "Notables Tour 2020", kind: "tour" };
const records = [
  {
    id: "first",
    displayName: "James Hall",
    section: "18",
    lot: "93",
    extraTitle: "Father of modern geology",
  },
  { id: "second", displayName: "Stanford Mausoleum", section: "18", lot: "105" },
];

describe("TourStopsPanel", () => {
  test("exposes every tour stop as a directly selectable button", () => {
    const onSelect = vi.fn();
    render(<TourStopsPanel tour={tour} records={records} onSelect={onSelect} />);

    const panel = screen.getByRole("complementary", { name: "Notables Tour 2020" });
    expect(within(panel).getByText("Tour places")).toBeInTheDocument();
    expect(within(panel).getByLabelText("2 places")).toBeInTheDocument();
    expect(within(panel).getAllByRole("button")).toHaveLength(2);
    expect(within(panel).getByText("Father of modern geology")).toBeInTheDocument();
    expect(within(panel).getByText("Section 18 · Lot 93")).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: /James Hall/ }));
    expect(onSelect).toHaveBeenCalledWith(records[0]);
  });

  test("identifies the stop that remains pinned after its details close", () => {
    render(
      <TourStopsPanel
        tour={tour}
        records={records}
        selectedRecord={records[1]}
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /Stanford Mausoleum/ }))
      .toHaveAttribute("aria-current", "location");
  });

  test("does not imply that an inventory is a walking tour", () => {
    render(
      <TourStopsPanel
        tour={{ key: "Sec49", name: "Section 49", kind: "collection" }}
        records={records}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText("Collection")).toBeInTheDocument();
    expect(screen.queryByText("Tour places")).not.toBeInTheDocument();
  });
});
