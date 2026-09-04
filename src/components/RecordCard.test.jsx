import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RecordCard from "./RecordCard";

const record = {
  id: "1",
  displayName: "Jane Doe",
  section: "4",
  lot: "8",
  birth: "1900",
  death: "1980",
  coordinates: [-73.73, 42.7],
};

describe("RecordCard", () => {
  it("keeps Close non-destructive and makes Unpin explicit", () => {
    const onClose = vi.fn();
    const onUnpin = vi.fn();
    render(<RecordCard record={record} open shareUrl="https://example.test/" onClose={onClose} onUnpin={onUnpin} />);

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onUnpin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Unpin" }));
    expect(onUnpin).toHaveBeenCalledOnce();
  });

  it("keeps sharing behind the secondary disclosure", () => {
    render(<RecordCard record={record} open shareUrl="https://example.test/" onClose={() => {}} onUnpin={() => {}} />);
    expect(screen.getByText("Share pinned grave")).toBeInTheDocument();
  });

  it("preserves tour portrait and ARCE biography presentation", () => {
    const tourRecord = {
      ...record,
      displayName: "James Hall",
      tourName: "Notables Tour 2020",
      portraitImageName: "james-hall.jpg",
      biographyLink: "james-hall.html",
    };
    const { container } = render(
      <RecordCard
        record={tourRecord}
        open
        shareUrl="https://example.test/"
        onClose={() => {}}
        onUnpin={() => {}}
      />
    );

    expect(screen.getByText("Notables Tour 2020")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read biography/ }))
      .toHaveAttribute("href", "https://www.albany.edu/arce/james-hall.html");
    expect(container.querySelector(".record-card__portrait"))
      .toHaveAttribute("src", "https://www.albany.edu/arce/images/james-hall.jpg");
  });

  it("keeps tour position and adjacent stops available with the record", () => {
    const onPrevious = vi.fn();
    const onOverview = vi.fn();
    const onNext = vi.fn();
    render(
      <RecordCard
        record={{ ...record, source: "tour", tourName: "Notables Tour 2020" }}
        open
        shareUrl="https://example.test/"
        onClose={() => {}}
        onUnpin={() => {}}
        tourContext={{ position: 2, total: 38, onPrevious, onOverview, onNext }}
      />
    );

    expect(screen.getByText("Notables Tour 2020 · 2 of 38")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous place" }));
    fireEvent.click(screen.getByRole("button", { name: "All places" }));
    fireEvent.click(screen.getByRole("button", { name: "Next place" }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onOverview).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Unpin" })).not.toBeInTheDocument();
  });
});
