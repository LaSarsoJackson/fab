const YEAR_PATTERN = /^\d{4}$/;
const SECTION_PATTERN = /^(section|sec)\s*([a-zA-Z0-9]+)$/i;
const LOT_PATTERN = /^lot\s*(\d+)$/i;
const TOUR_PATTERN = /^(.*?)\s*tour$/i;
const NUMBER_PATTERN = /^\d+$/;

const normalize = (value = '') => String(value).toLowerCase().trim();

const tokenize = (value = '') =>
  normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);

const addToMapArray = (map, key, item) => {
  if (!key) return;
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(item);
};

const dedupe = (items) => {
  const seen = new Set();
  const result = [];

  items.forEach((item) => {
    const key = item.OBJECTID ?? item.key ?? `${item.First_Name || ''}_${item.Last_Name || ''}_${item.Section || ''}_${item.Lot || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });

  return result;
};

export const sortSectionValues = (a, b) => {
  if (a === '100A') return 1;
  if (b === '100A') return -1;
  return `${a}`.localeCompare(`${b}`, undefined, { numeric: true, sensitivity: 'base' });
};

export const buildSearchIndex = (options, { getTourName } = {}) => {
  const bySection = new Map();
  const byLot = new Map();
  const byYear = new Map();
  const byToken = new Map();
  const byTourToken = new Map();

  options.forEach((option) => {
    const sectionKey = normalize(option.Section);
    const lotKey = normalize(option.Lot);

    addToMapArray(bySection, sectionKey, option);
    addToMapArray(byLot, lotKey, option);

    const birth = String(option.Birth || '');
    const death = String(option.Death || '');
    const years = `${birth} ${death}`.match(/\b\d{4}\b/g) || [];
    years.forEach((year) => addToMapArray(byYear, year, option));

    tokenize(option.searchableLabelLower || option.searchableLabel || '').forEach((token) => {
      addToMapArray(byToken, token, option);
    });

    if (getTourName) {
      const tourName = normalize(getTourName(option));
      if (tourName) {
        tokenize(tourName).forEach((token) => addToMapArray(byTourToken, token, option));
      }
    }
  });

  return {
    bySection,
    byLot,
    byYear,
    byToken,
    byTourToken,
  };
};

export const smartSearch = (
  options,
  searchInput,
  {
    index,
    getTourName,
  } = {}
) => {
  const input = normalize(searchInput);
  if (!input) return [];

  if (YEAR_PATTERN.test(input)) {
    if (index?.byYear?.has(input)) {
      return dedupe(index.byYear.get(input));
    }

    return options.filter((option) =>
      String(option.Birth || '').includes(input) ||
      String(option.Death || '').includes(input)
    );
  }

  const sectionMatch = input.match(SECTION_PATTERN);
  if (sectionMatch) {
    const sectionQuery = normalize(sectionMatch[2]);
    if (index?.bySection?.has(sectionQuery)) {
      return dedupe(index.bySection.get(sectionQuery));
    }

    return options.filter((option) => normalize(option.Section) === sectionQuery);
  }

  const lotMatch = input.match(LOT_PATTERN);
  if (lotMatch) {
    const lotQuery = normalize(lotMatch[1]);
    if (index?.byLot?.has(lotQuery)) {
      return dedupe(index.byLot.get(lotQuery));
    }

    return options.filter((option) => normalize(option.Lot) === lotQuery);
  }

  const tourMatch = input.match(TOUR_PATTERN);
  if (tourMatch && getTourName) {
    const tourQuery = normalize(tourMatch[1]);
    const tourToken = tokenize(tourQuery)[0];

    const pool =
      tourToken && index?.byTourToken?.has(tourToken)
        ? index.byTourToken.get(tourToken)
        : options;

    return dedupe(
      pool.filter((option) => normalize(getTourName(option)).includes(tourQuery))
    );
  }

  if (NUMBER_PATTERN.test(input)) {
    const indexMatches = [];
    if (index?.bySection?.has(input)) indexMatches.push(...index.bySection.get(input));
    if (index?.byLot?.has(input)) indexMatches.push(...index.byLot.get(input));
    if (index?.byYear?.has(input)) indexMatches.push(...index.byYear.get(input));

    if (indexMatches.length > 0) {
      return dedupe(indexMatches);
    }

    return options.filter((option) =>
      normalize(option.Section) === input ||
      normalize(option.Lot) === input ||
      String(option.Birth || '').includes(input) ||
      String(option.Death || '').includes(input)
    );
  }

  const inputTokens = tokenize(input);
  let candidatePool = options;

  if (inputTokens.length > 0 && index?.byToken) {
    const tokenPools = inputTokens
      .map((token) => index.byToken.get(token) || [])
      .filter((pool) => pool.length > 0)
      .sort((a, b) => a.length - b.length);

    if (tokenPools.length > 0) {
      candidatePool = tokenPools[0];
    }
  }

  return dedupe(
    candidatePool.filter((option) => {
      const label = option.searchableLabelLower || normalize(option.searchableLabel);
      const nameMatch = label.includes(input);
      const tourMatch = getTourName ? normalize(getTourName(option)).includes(input) : false;
      return nameMatch || tourMatch;
    })
  );
};
