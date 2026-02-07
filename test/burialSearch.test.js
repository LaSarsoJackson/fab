import { describe, expect, test } from 'bun:test';
import { buildSearchIndex, smartSearch, sortSectionValues } from '../src/lib/burialSearch';

const options = [
  {
    OBJECTID: 1,
    First_Name: 'Jane',
    Last_Name: 'Doe',
    Section: '12',
    Lot: '8',
    Birth: '1812',
    Death: '1899',
    searchableLabel: 'Jane Doe (Section 12, Lot 8)',
    searchableLabelLower: 'jane doe (section 12, lot 8)',
    title: 'Notable',
  },
  {
    OBJECTID: 2,
    First_Name: 'John',
    Last_Name: 'Smith',
    Section: '3',
    Lot: '12',
    Birth: '1812',
    Death: '1844',
    searchableLabel: 'John Smith (Section 3, Lot 12)',
    searchableLabelLower: 'john smith (section 3, lot 12)',
  },
  {
    OBJECTID: 3,
    First_Name: 'Ada',
    Last_Name: 'Lovelace',
    Section: '100A',
    Lot: '9',
    Birth: '1815',
    Death: '1852',
    searchableLabel: 'Ada Lovelace (Section 100A, Lot 9)',
    searchableLabelLower: 'ada lovelace (section 100a, lot 9)',
    title: 'CivilWar',
  },
];

const getTourName = (option) => {
  if (option.title === 'Notable') return 'Notables Tour 2020';
  if (option.title === 'CivilWar') return 'Civil War Tour 2020';
  return '';
};

describe('sortSectionValues', () => {
  test('pushes section 100A to the end', () => {
    const values = ['100A', '9', '12', '3'].sort(sortSectionValues);
    expect(values).toEqual(['3', '9', '12', '100A']);
  });
});

describe('smartSearch with index', () => {
  const index = buildSearchIndex(options, { getTourName });

  test('matches year query', () => {
    const results = smartSearch(options, '1812', { index, getTourName });
    expect(results.map((item) => item.OBJECTID)).toEqual([1, 2]);
  });

  test('matches section query', () => {
    const results = smartSearch(options, 'section 12', { index, getTourName });
    expect(results.map((item) => item.OBJECTID)).toEqual([1]);
  });

  test('matches lot query', () => {
    const results = smartSearch(options, 'lot 9', { index, getTourName });
    expect(results.map((item) => item.OBJECTID)).toEqual([3]);
  });

  test('matches tour query', () => {
    const results = smartSearch(options, 'civil war tour', { index, getTourName });
    expect(results.map((item) => item.OBJECTID)).toEqual([3]);
  });

  test('matches name fragments with token index', () => {
    const results = smartSearch(options, 'jane doe', { index, getTourName });
    expect(results.map((item) => item.OBJECTID)).toEqual([1]);
  });

  test('dedupes numeric union queries', () => {
    const results = smartSearch(options, '12', { index, getTourName });
    expect(results.map((item) => item.OBJECTID)).toEqual([1, 2]);
  });
});

describe('smartSearch without index', () => {
  test('falls back to linear name search', () => {
    const results = smartSearch(options, 'lovelace', { getTourName });
    expect(results.map((item) => item.OBJECTID)).toEqual([3]);
  });
});
