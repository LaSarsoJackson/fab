import { describe, expect, test } from "bun:test";

import {
  clearMapSelectionFocus,
  clearMapSelectionFocusForRecord,
  createMapSelectionState,
  focusMapSelectionRecord,
  reduceMapSelectionState,
  removeMapSelectionRecord,
  replaceMapSelectionRecords,
  setMapSelectionHover,
} from "../src/features/map/mapDomain";

const annaTracy = {
  id: "burial:1:99:18",
  source: "burial",
  displayName: "Anna Tracy",
  Section: "99",
  Lot: "18",
  coordinates: [-73.733659, 42.711919],
};

const thomasTracy = {
  id: "burial:2:99:18",
  source: "burial",
  displayName: "Thomas Tracy",
  Section: "99",
  Lot: "18",
  coordinates: [-73.73366, 42.71192],
};

const notableTourStop = {
  id: "tour:Notable:1:99:18",
  source: "tour",
  displayName: "Anna Tracy",
  Section: "99",
  Lot: "18",
  tourKey: "Notable",
  tourName: "Notables Tour 2020",
  coordinates: [-73.733659, 42.711919],
};

describe("map selection state", () => {
  test("search result selection pins the record and focuses it", () => {
    const state = reduceMapSelectionState(
      createMapSelectionState(),
      focusMapSelectionRecord(annaTracy)
    );

    expect(state).toEqual({
      selectedBurials: [annaTracy],
      activeBurialId: annaTracy.id,
      hoveredBurialId: null,
    });
  });

  test("section browse clears active focus while keeping pinned records", () => {
    const focusedState = reduceMapSelectionState(
      createMapSelectionState(),
      focusMapSelectionRecord(annaTracy)
    );
    const hoveredState = reduceMapSelectionState(
      focusedState,
      setMapSelectionHover(annaTracy.id)
    );
    const state = reduceMapSelectionState(
      hoveredState,
      clearMapSelectionFocus({ clearHover: true })
    );

    expect(state).toEqual({
      selectedBurials: [annaTracy],
      activeBurialId: null,
      hoveredBurialId: null,
    });
  });

  test("section-marker selection switches the active pinned record", () => {
    const initialState = reduceMapSelectionState(createMapSelectionState(), replaceMapSelectionRecords({
      records: [annaTracy, thomasTracy],
      activeRecordId: annaTracy.id,
    }));
    const state = reduceMapSelectionState(initialState, focusMapSelectionRecord(thomasTracy));

    expect(state).toEqual({
      selectedBurials: [annaTracy, thomasTracy],
      activeBurialId: thomasTracy.id,
      hoveredBurialId: null,
    });
  });

  test("clicking a hovered marker promotes focus and clears transient hover", () => {
    const initialState = reduceMapSelectionState(createMapSelectionState(), replaceMapSelectionRecords({
      records: [annaTracy, thomasTracy],
      activeRecordId: annaTracy.id,
      hoveredRecordId: thomasTracy.id,
    }));
    const state = reduceMapSelectionState(initialState, focusMapSelectionRecord(thomasTracy));

    expect(state).toEqual({
      selectedBurials: [annaTracy, thomasTracy],
      activeBurialId: thomasTracy.id,
      hoveredBurialId: null,
    });
  });

  test("hover updates do not compete with the active focused marker", () => {
    const focusedState = reduceMapSelectionState(
      createMapSelectionState(),
      focusMapSelectionRecord(annaTracy)
    );
    const state = reduceMapSelectionState(
      focusedState,
      setMapSelectionHover(annaTracy.id)
    );

    expect(state).toEqual({
      selectedBurials: [annaTracy],
      activeBurialId: annaTracy.id,
      hoveredBurialId: null,
    });
  });

  test("tour-stop selection adds the stop to the pinned set and focuses it", () => {
    const initialState = reduceMapSelectionState(createMapSelectionState(), replaceMapSelectionRecords({
      records: [annaTracy],
      activeRecordId: annaTracy.id,
    }));
    const state = reduceMapSelectionState(initialState, focusMapSelectionRecord(notableTourStop));

    expect(state).toEqual({
      selectedBurials: [annaTracy, notableTourStop],
      activeBurialId: notableTourStop.id,
      hoveredBurialId: null,
    });
  });

  test("popup-close clear keeps pinned records while removing active focus", () => {
    const initialState = reduceMapSelectionState(createMapSelectionState(), replaceMapSelectionRecords({
      records: [annaTracy, notableTourStop],
      activeRecordId: notableTourStop.id,
    }));
    const state = reduceMapSelectionState(initialState, clearMapSelectionFocus());

    expect(state).toEqual({
      selectedBurials: [annaTracy, notableTourStop],
      activeBurialId: null,
      hoveredBurialId: null,
    });
  });

  test("removing the active record clears active and hover without reassigning focus", () => {
    const initialState = reduceMapSelectionState(createMapSelectionState(), replaceMapSelectionRecords({
      records: [annaTracy, thomasTracy],
      activeRecordId: annaTracy.id,
      hoveredRecordId: annaTracy.id,
    }));
    const state = reduceMapSelectionState(initialState, removeMapSelectionRecord(annaTracy.id));

    expect(state).toEqual({
      selectedBurials: [thomasTracy],
      activeBurialId: null,
      hoveredBurialId: null,
    });
  });

  test("reducer gives search, direct-marker, and tour-stop selections one focus path", () => {
    const afterSearch = reduceMapSelectionState(
      createMapSelectionState(),
      focusMapSelectionRecord(annaTracy)
    );
    const afterDirectMarker = reduceMapSelectionState(
      afterSearch,
      focusMapSelectionRecord(thomasTracy)
    );
    const afterTourStop = reduceMapSelectionState(
      afterDirectMarker,
      focusMapSelectionRecord(notableTourStop)
    );

    expect(afterTourStop).toEqual({
      selectedBurials: [annaTracy, thomasTracy, notableTourStop],
      activeBurialId: notableTourStop.id,
      hoveredBurialId: null,
    });
  });

  test("reducer restores deep-link selections without inventing a different active model", () => {
    const state = reduceMapSelectionState(createMapSelectionState(), replaceMapSelectionRecords({
      records: [annaTracy, notableTourStop],
      activeRecordId: notableTourStop.id,
    }));

    expect(state).toEqual({
      selectedBurials: [annaTracy, notableTourStop],
      activeBurialId: notableTourStop.id,
      hoveredBurialId: null,
    });
  });

  test("reducer clears stale popup focus only for the record that closed", () => {
    const initialState = reduceMapSelectionState(createMapSelectionState(), replaceMapSelectionRecords({
      records: [annaTracy, thomasTracy],
      activeRecordId: thomasTracy.id,
    }));

    expect(
      reduceMapSelectionState(initialState, clearMapSelectionFocusForRecord(annaTracy.id))
    ).toEqual(initialState);
    expect(
      reduceMapSelectionState(initialState, clearMapSelectionFocusForRecord(thomasTracy.id))
    ).toEqual({
      selectedBurials: [annaTracy, thomasTracy],
      activeBurialId: null,
      hoveredBurialId: null,
    });
  });

  test("reducer handles section focus clearing, hover, and removal through the same state shape", () => {
    const focusedState = reduceMapSelectionState(
      createMapSelectionState(),
      focusMapSelectionRecord(annaTracy)
    );
    const hoveredState = reduceMapSelectionState(
      focusedState,
      setMapSelectionHover(annaTracy.id)
    );
    const browsedSectionState = reduceMapSelectionState(
      hoveredState,
      clearMapSelectionFocus({ clearHover: true })
    );

    expect(browsedSectionState).toEqual({
      selectedBurials: [annaTracy],
      activeBurialId: null,
      hoveredBurialId: null,
    });
    expect(
      reduceMapSelectionState(hoveredState, removeMapSelectionRecord(annaTracy.id))
    ).toEqual({
      selectedBurials: [],
      activeBurialId: null,
      hoveredBurialId: null,
    });
  });
});
