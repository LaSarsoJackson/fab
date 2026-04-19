import { describe, expect, test } from 'bun:test';
import {
  buildFieldPacketShareUrl,
  encodeFieldPacket,
  parseDeepLinkState,
} from "../src/features/deeplinks";

describe('parseDeepLinkState', () => {
  test('parses view, query, and section', () => {
    const state = parseDeepLinkState('?view=burials&q=John%20Doe&section=12');

    expect(state.view).toBe('burials');
    expect(state.showBurialsView).toBe(true);
    expect(state.section).toBe('12');
    expect(state.query).toBe('John Doe');
  });

  test('matches a tour by partial name', () => {
    const state = parseDeepLinkState('?tour=civil%20war', [
      'Notables Tour 2020',
      'Civil War Tour 2020',
    ]);

    expect(state.selectedTourName).toBe('Civil War Tour 2020');
    expect(state.rawTour).toBe('civil war');
  });

  test('handles missing values safely', () => {
    const state = parseDeepLinkState('');

    expect(state.section).toBe('');
    expect(state.query).toBe('');
    expect(state.selectedTourName).toBeNull();
    expect(state.showBurialsView).toBe(false);
    expect(state.showToursView).toBe(false);
    expect(state.fieldPacket).toBeNull();
  });

  test('parses a shared link from the URL', () => {
    const encodedPacket = encodeFieldPacket({
      name: 'Section 99',
      note: 'Verify the headstones near the lane.',
      activeBurialId: 'burial:1:99:18',
      selectedRecords: [
        {
          id: 'burial:1:99:18',
          source: 'burial',
          displayName: 'Anna Tracy',
          Section: '99',
          Lot: '18',
          coordinates: [-73.733659, 42.711919],
        },
      ],
      sectionFilter: '99',
    });

    const state = parseDeepLinkState(`?share=${encodedPacket}`);

    expect(state.fieldPacket).toEqual({
      version: 1,
      name: 'Section 99',
      note: 'Verify the headstones near the lane.',
      activeBurialId: 'burial:1:99:18',
      selectedBurialIds: ['burial:1:99:18'],
      selectedRecords: [
        {
          id: 'burial:1:99:18',
          source: 'burial',
          displayName: 'Anna Tracy',
          label: 'Anna Tracy',
          fullName: 'Anna Tracy',
          Section: '99',
          Lot: '18',
          coordinates: [-73.733659, 42.711919],
        },
      ],
      sectionFilter: '99',
      selectedTour: '',
      mapBounds: null,
    });
  });

  test('keeps a shared link selection unfocused when no active burial id is encoded', () => {
    const encodedPacket = encodeFieldPacket({
      selectedRecords: [
        {
          id: 'burial:1:99:18',
          source: 'burial',
          displayName: 'Anna Tracy',
          Section: '99',
          Lot: '18',
        },
      ],
      activeBurialId: '',
    });

    const state = parseDeepLinkState(`?share=${encodedPacket}`);

    expect(state.fieldPacket?.activeBurialId).toBe('');
    expect(state.fieldPacket?.selectedBurialIds).toEqual(['burial:1:99:18']);
  });

  test('continues to parse legacy packet links', () => {
    const encodedPacket = encodeFieldPacket({
      selectedRecords: [
        {
          id: 'burial:1:99:18',
          source: 'burial',
          displayName: 'Anna Tracy',
          Section: '99',
          Lot: '18',
        },
      ],
    });

    const state = parseDeepLinkState(`?packet=${encodedPacket}`);

    expect(state.fieldPacket?.selectedBurialIds).toEqual(['burial:1:99:18']);
  });

  test('builds public share links with the share query param', () => {
    const shareUrl = buildFieldPacketShareUrl({
      packet: {
        selectedRecords: [
          {
            id: 'burial:1:99:18',
            source: 'burial',
            displayName: 'Anna Tracy',
            Section: '99',
            Lot: '18',
          },
        ],
      },
      currentUrl: 'https://example.com/fab?view=burials&q=anna&packet=legacy',
    });
    const parsedShareUrl = new URL(shareUrl);

    expect(parsedShareUrl.searchParams.get('share')).toBeTruthy();
    expect(parsedShareUrl.searchParams.get('packet')).toBeNull();
    expect(parsedShareUrl.searchParams.get('view')).toBeNull();
    expect(parsedShareUrl.searchParams.get('q')).toBeNull();
  });
});
