import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// The worker module wires itself onto the global scope on import: it assigns
// `globalThis.onmessage` and posts results back through `globalThis.postMessage`.
// These tests drive that message protocol directly without spawning a Worker.
import "../src/features/browse/browseSearch.worker";

const RECORDS = [
  {
    id: 1,
    First_Name: "Jane",
    Last_Name: "Doe",
    Section: "12",
    Lot: "8",
    Birth: "1812",
    Death: "1899",
    searchableLabel: "Jane Doe (Section 12, Lot 8)",
    searchableLabelLower: "jane doe (section 12, lot 8)",
    nameVariantsNormalized: ["jane doe", "doe jane"],
  },
  {
    id: 2,
    First_Name: "John",
    Last_Name: "Smith",
    Section: "3",
    Lot: "12",
    Birth: "1820",
    Death: "1888",
    searchableLabel: "John Smith (Section 3, Lot 12)",
    searchableLabelLower: "john smith (section 3, lot 12)",
    tourName: "Notables Tour 2020",
  },
];

let posted = [];
let originalPostMessage;

const dispatch = (data) => {
  globalThis.onmessage({ data });
};

const hydrate = (recordVersion = 1, records = RECORDS) => {
  dispatch({ type: "hydrate", recordVersion, records });
};

beforeEach(() => {
  posted = [];
  originalPostMessage = globalThis.postMessage;
  globalThis.postMessage = (message) => {
    posted.push(message);
  };
});

afterEach(() => {
  globalThis.postMessage = originalPostMessage;
});

describe("browseSearch worker protocol", () => {
  test("acknowledges hydration with a ready message for the active record version", () => {
    hydrate(7);

    expect(posted).toEqual([{ type: "ready", recordVersion: 7 }]);
  });

  test("returns matching record ids for a query against the active version", () => {
    hydrate(2);
    posted = [];

    dispatch({ type: "query", requestId: "abc", recordVersion: 2, query: "jane doe" });

    expect(posted).toEqual([
      { type: "results", requestId: "abc", recordVersion: 2, resultIds: [1] },
    ]);
  });

  test("resolves tour-name queries through the worker tour-name accessor", () => {
    hydrate(3);
    posted = [];

    dispatch({ type: "query", requestId: "tour", recordVersion: 3, query: "notables tour" });

    expect(posted).toEqual([
      { type: "results", requestId: "tour", recordVersion: 3, resultIds: [2] },
    ]);
  });

  test("reports a stale response when the query targets an outdated version", () => {
    hydrate(5);
    posted = [];

    dispatch({ type: "query", requestId: "old", recordVersion: 4, query: "jane" });

    expect(posted).toEqual([{ type: "stale", requestId: "old", recordVersion: 4 }]);
  });

  test("treats hydration as version control: a tolerant query still matches", () => {
    hydrate(9);
    posted = [];

    dispatch({ type: "query", requestId: "section", recordVersion: 9, query: "section 12" });

    expect(posted).toEqual([
      { type: "results", requestId: "section", recordVersion: 9, resultIds: [1] },
    ]);
  });

  test("ignores unrelated message types without posting back", () => {
    hydrate(1);
    posted = [];

    dispatch({ type: "noop" });

    expect(posted).toEqual([]);
  });

  test("posts an error message when handling a malformed event throws", () => {
    dispatch({
      get type() {
        throw new Error("boom");
      },
      requestId: "broken",
      recordVersion: 1,
    });

    expect(posted).toEqual([
      { type: "error", requestId: "broken", recordVersion: 1, error: "boom" },
    ]);
  });
});
