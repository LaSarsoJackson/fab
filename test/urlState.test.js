import { describe, expect, test } from 'bun:test';
import { parseDeepLinkState } from '../src/lib/urlState';

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
  });
});
