/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  PopupCardContent,
  PopupCardStackContent,
  PopupCardStackList,
} from "./popupCardContent";

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

  expect(screen.getByText("3 people at this plot")).toBeInTheDocument();
  // All three names should appear in the list
  expect(screen.getAllByText("Anna Stack").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("Beth Stack")).toBeInTheDocument();
  expect(screen.getByText("Clara Stack")).toBeInTheDocument();
  const stack = screen.getByRole("group", { name: "3 people at this plot" });
  expect(stack).toHaveClass("popup-card-stack");
  expect(within(stack).getByRole("list", { name: "3 people at this plot" }))
    .toBeInTheDocument();
  expect(within(stack).getByRole("heading", { level: 3 })).toHaveTextContent("Anna Stack");
});

test("unrelated rerenders do not readjust the open popup viewport", () => {
  const popup = {};
  const schedulePopupLayout = jest.fn();
  const { rerender } = render(
    <PopupCardStackContent
      records={stackRecords}
      activeRecordId="one"
      schedulePopupLayout={schedulePopupLayout}
      getPopup={() => popup}
    />
  );
  const initialLayoutCount = schedulePopupLayout.mock.calls.length;

  rerender(
    <PopupCardStackContent
      records={stackRecords}
      activeRecordId="one"
      schedulePopupLayout={schedulePopupLayout}
      getPopup={() => popup}
    />
  );

  expect(schedulePopupLayout).toHaveBeenCalledTimes(initialLayoutCount);
});

test("desktop plot lists render an initial batch, preserve a hidden active person, and expand accessibly", () => {
  const manyRecords = Array.from({ length: 12 }, (_, index) => ({
    ...stackRecords[index % stackRecords.length],
    id: `person-${index + 1}`,
    First_Name: `Person ${index + 1}`,
  }));

  render(
    <PopupCardStackList
      records={manyRecords}
      activeRecordId="person-12"
      onSelectRecord={jest.fn()}
      stackDescription="12 people at this plot"
    />
  );

  const list = screen.getByRole("list", { name: "12 people at this plot" });
  expect(within(list).getAllByRole("button")).toHaveLength(9);
  expect(within(list).getByRole("button", { name: /Person 12 Stack/i }))
    .toHaveAttribute("aria-current", "true");

  const showMore = screen.getByRole("button", { name: "Show more" });
  expect(showMore).toHaveAttribute("aria-controls", list.id);
  expect(showMore).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(showMore);

  expect(within(list).getAllByRole("button")).toHaveLength(12);
  expect(screen.getByText("12 of 12 shown")).toBeInTheDocument();
  const showFewer = screen.getByRole("button", { name: "Show fewer" });
  expect(showFewer).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(showFewer);

  expect(within(list).getAllByRole("button")).toHaveLength(9);
  expect(within(list).getByRole("button", { name: /Person 12 Stack/i }))
    .toBeInTheDocument();
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

  expect(screen.queryByText(/people at this plot/)).not.toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: "1 person at this plot" }))
    .toBeInTheDocument();
});

test("PopupCardStackList with fewer than 2 valid records returns null", () => {
  render(
    <PopupCardStackList
      records={[stackRecords[0]]}
      activeRecordId="one"
      onSelectRecord={jest.fn()}
    />
  );

  expect(screen.queryByText(/people at this plot/)).not.toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

test("popup actions name unpinning and closing as separate actions", () => {
  const onClose = jest.fn();
  const onRemove = jest.fn();

  render(
    <PopupCardStackContent
      records={[stackRecords[0]]}
      activeRecordId="one"
      onNavigate={jest.fn()}
      onRemove={onRemove}
      schedulePopupLayout={jest.fn()}
      getPopup={() => ({})}
    />
  );

  expect(screen.getByRole("button", { name: "Navigate" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Unpin" }));
  expect(onRemove).toHaveBeenCalledWith(stackRecords[0]);

  render(
    <PopupCardContent
      record={stackRecords[0]}
      onClose={onClose}
      schedulePopupLayout={jest.fn()}
      getPopup={() => ({})}
      showActions
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("the default map popup includes biography facts, portrait, and directions", () => {
  const onNavigate = jest.fn();

  render(
    <PopupCardContent
      record={{
        id: "reynolds",
        source: "tour",
        displayName: "Marcus T. Reynolds",
        Section: "17",
        Lot: "1",
        Birth: "8/20/1869",
        Death: "3/18/1937",
        extraTitle: "Albany Architect",
        portraitImageName: "Reynolds5d.png",
        biographyLink: "Reynolds5",
      }}
      onNavigate={onNavigate}
      onRemove={jest.fn()}
      schedulePopupLayout={jest.fn()}
      getPopup={() => ({})}
      showActions
    />
  );

  expect(screen.getByText("Albany Architect")).toHaveClass("popup-card__paragraph");
  expect(screen.getByRole("img", { name: "Marcus T. Reynolds portrait" }))
    .toHaveAttribute("src", expect.stringContaining("/images/Reynolds5d.png"));
  expect(screen.getByRole("link", { name: "Details" }))
    .toHaveAttribute("href", "https://www.albany.edu/arce/Reynolds5.html");

  fireEvent.click(screen.getByRole("button", { name: "Navigate" }));
  expect(onNavigate).toHaveBeenCalledTimes(1);
});
