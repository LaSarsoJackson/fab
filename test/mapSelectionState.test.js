import { describe, expect, test } from "bun:test";

import {
  clearSelectionFocus,
  createMapSelectionState,
  focusSelectionBurial,
  removeSelectionBurial,
  replaceSelectionBurials,
  setSelectionHover,
} from "../src/features/map";

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
    const state = focusSelectionBurial(createMapSelectionState(), annaTracy);

    expect(state).toEqual({
      selectedBurials: [annaTracy],
      activeBurialId: annaTracy.id,
      hoveredBurialId: null,
    });
  });

  test("section browse clears active focus while keeping pinned records", () => {
    const state = clearSelectionFocus(
      setSelectionHover(
        focusSelectionBurial(createMapSelectionState(), annaTracy),
        annaTracy.id
      ),
      { clearHover: true }
    );

    expect(state).toEqual({
      selectedBurials: [annaTracy],
      activeBurialId: null,
      hoveredBurialId: null,
    });
  });

  test("section-marker selection switches the active pinned record", () => {
    const initialState = replaceSelectionBurials(createMapSelectionState(), {
      selectedBurials: [annaTracy, thomasTracy],
      activeBurialId: annaTracy.id,
    });
    const state = focusSelectionBurial(initialState, thomasTracy);

    expect(state).toEqual({
      selectedBurials: [annaTracy, thomasTracy],
      activeBurialId: thomasTracy.id,
      hoveredBurialId: null,
    });
  });

  test("tour-stop selection adds the stop to the pinned set and focuses it", () => {
    const initialState = replaceSelectionBurials(createMapSelectionState(), {
      selectedBurials: [annaTracy],
      activeBurialId: annaTracy.id,
    });
    const state = focusSelectionBurial(initialState, notableTourStop);

    expect(state).toEqual({
      selectedBurials: [annaTracy, notableTourStop],
      activeBurialId: notableTourStop.id,
      hoveredBurialId: null,
    });
  });

  test("popup-close clear keeps pinned records while removing active focus", () => {
    const initialState = replaceSelectionBurials(createMapSelectionState(), {
      selectedBurials: [annaTracy, notableTourStop],
      activeBurialId: notableTourStop.id,
    });
    const state = clearSelectionFocus(initialState);

    expect(state).toEqual({
      selectedBurials: [annaTracy, notableTourStop],
      activeBurialId: null,
      hoveredBurialId: null,
    });
  });

  test("removing the active record clears active and hover without reassigning focus", () => {
    const initialState = replaceSelectionBurials(createMapSelectionState(), {
      selectedBurials: [annaTracy, thomasTracy],
      activeBurialId: annaTracy.id,
      hoveredBurialId: annaTracy.id,
    });
    const state = removeSelectionBurial(initialState, annaTracy.id);

    expect(state).toEqual({
      selectedBurials: [thomasTracy],
      activeBurialId: null,
      hoveredBurialId: null,
    });
  });
});
