/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { PopupCardStackContent, PopupCardStackList } from "./popupCardContent";

const stackRecords = [
  {
    id: "one",
    First_Name: "Anna",
    Last_Name: "Stack",
    Section: "50",
    Lot: "1",
    Tier: "0",
    Grave: "1",
  },
  {
    id: "two",
    First_Name: "Beth",
    Last_Name: "Stack",
    Section: "50",
    Lot: "1",
    Tier: "0",
    Grave: "2",
  },
  {
    id: "three",
    First_Name: "Clara",
    Last_Name: "Stack",
    Section: "50",
    Lot: "1",
    Tier: "0",
    Grave: "3",
  },
];

test("PopupCardStackContent with 3 records renders all 3 names in the list and the correct heading", () => {
  render(
    <PopupCardStackContent
      records={stackRecords}
      activeRecordId="one"
      onSelectRecord={jest.fn()}
      schedulePopupLayout={jest.fn()}
      getPopup={() => ({})}
    />
  );

  expect(screen.getByText("3 graves at this marker")).toBeInTheDocument();
  // All three names should appear in the list
  expect(screen.getAllByText("Anna Stack").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("Beth Stack")).toBeInTheDocument();
  expect(screen.getByText("Clara Stack")).toBeInTheDocument();
});

test("clicking a non-active option calls onSelectRecord with that record and the card switches to it", () => {
  const onSelectRecord = jest.fn();

  render(
    <PopupCardStackContent
      records={stackRecords}
      activeRecordId="one"
      onSelectRecord={onSelectRecord}
      schedulePopupLayout={jest.fn()}
      getPopup={() => ({})}
    />
  );

  // Find "Beth Stack" in the list buttons (not the card heading)
  const listButtons = screen.getAllByRole("button", { name: /Beth Stack/i });
  fireEvent.click(listButtons[0]);

  expect(onSelectRecord).toHaveBeenCalledWith(stackRecords[1]);

  // The card heading should now show Beth Stack
  // (the active card heading is rendered as an h3 in PopupCardContent)
  const heading = screen.getByRole("heading", { level: 3 });
  expect(heading).toHaveTextContent("Beth Stack");
});

test("the active option has aria-current='true'", () => {
  render(
    <PopupCardStackContent
      records={stackRecords}
      activeRecordId="two"
      onSelectRecord={jest.fn()}
      schedulePopupLayout={jest.fn()}
      getPopup={() => ({})}
    />
  );

  const bethButtons = screen.getAllByRole("button", { name: /Beth Stack/i });
  const activeButton = bethButtons.find((btn) => btn.getAttribute("aria-current") === "true");
  expect(activeButton).toBeTruthy();

  // Anna and Clara should not have aria-current
  const annaButtons = screen.getAllByRole("button", { name: /Anna Stack/i });
  annaButtons.forEach((btn) => {
    expect(btn.getAttribute("aria-current")).not.toBe("true");
  });
});

test("with a single record the list does not render", () => {
  render(
    <PopupCardStackContent
      records={[stackRecords[0]]}
      activeRecordId="one"
      onSelectRecord={jest.fn()}
      schedulePopupLayout={jest.fn()}
      getPopup={() => ({})}
    />
  );

  expect(screen.queryByText(/graves at this marker/)).not.toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

test("PopupCardStackList with fewer than 2 valid records returns null", () => {
  render(
    <PopupCardStackList
      records={[stackRecords[0]]}
      activeRecordId="one"
      onSelectRecord={jest.fn()}
    />
  );

  expect(screen.queryByText(/graves at this marker/)).not.toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

test("popup actions render when action handlers are provided", () => {
  render(
    <PopupCardStackContent
      records={[stackRecords[0]]}
      activeRecordId="one"
      onNavigate={jest.fn()}
      onRemove={jest.fn()}
      schedulePopupLayout={jest.fn()}
      getPopup={() => ({})}
    />
  );

  expect(screen.getByRole("button", { name: "Navigate" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
});
