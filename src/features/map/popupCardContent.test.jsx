/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { PopupCardStackContent } from "./popupCardContent";

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

test("cluster popup navigation advances the active record without losing the stack count", () => {
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

  expect(screen.getByText("1/3")).toBeInTheDocument();
  expect(screen.getByText("Anna Stack")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Next burial record at this marker" }));

  expect(onSelectRecord).toHaveBeenLastCalledWith(stackRecords[1]);
  expect(screen.getByText("2/3")).toBeInTheDocument();
  expect(screen.getByText("Beth Stack")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Previous burial record at this marker" }));

  expect(onSelectRecord).toHaveBeenLastCalledWith(stackRecords[0]);
  expect(screen.getByText("1/3")).toBeInTheDocument();
  expect(screen.getByText("Anna Stack")).toBeInTheDocument();
});
