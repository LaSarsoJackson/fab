const YEAR_PATTERN = /^\d{4}$/;
const SECTION_PATTERN = /^(section|sec)\s*([a-zA-Z0-9]+)$/i;
const LOT_PATTERN = /^lot\s*(\d+)$/i;
const TOUR_PATTERN = /^(.*?)\s*tour$/i;
const NUMBER_PATTERN = /^\d+$/;

const normalize = (value = '') => String(value).toLowerCase().trim();

export const normalizeName = (value = '') => {
  if (!value) return '';
  return value.toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const tokenize = (value = '') =>
  normalizeName(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);

const addToMapArray = (map, key, item) => {
  if (!key) return;
  let arr = map.get(key);
  if (arr === undefined) {
    arr = [];
    map.set(key, arr);
  }
  arr.push(item);
};

const dedupe = (items) => {
  const seen = new Set();
  const result = [];

  items.forEach((item) => {
    const key = item.id ?? item.OBJECTID ?? item.key ?? `${item.First_Name || ''}_${item.Last_Name || ''}_${item.Section || ''}_${item.Lot || ''}`;
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

export const buildSearchIndex = (options, { getTourName, initialIndex } = {}) => {
  const {
    bySection,
    byLot,
    byYear,
    byToken,
    byTourToken,
    byFullName,
    byNameToken,
  } = initialIndex || {
    bySection: new Map(),
    byLot: new Map(),
    byYear: new Map(),
    byToken: new Map(),
    byTourToken: new Map(),
    byFullName: new Map(),
    byNameToken: new Map(),
  };

  options.forEach((option) => {
    const sectionKey = normalize(option.Section);
    const lotKey = normalize(option.Lot);
    const fullNameNormalized = option.fullNameNormalized || normalizeName(
      option.fullName ||
      option.label ||
      `${option.First_Name || ''} ${option.Last_Name || ''}`
    );
    const nameVariantsNormalized = Array.from(
      new Set([
        fullNameNormalized,
        ...(option.nameVariantsNormalized || []),
      ].filter(Boolean))
    );

    addToMapArray(bySection, sectionKey, option);
    addToMapArray(byLot, lotKey, option);
    nameVariantsNormalized.forEach((value) => {
      addToMapArray(byFullName, value, option);
      tokenize(value).forEach((token) => {
        addToMapArray(byNameToken, token, option);
      });
    });

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
    byFullName,
    byNameToken,
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
  const normalizedNameQuery = normalizeName(input);
  let candidatePool = options;

  if (inputTokens.length > 0) {
    const indexedCandidates = [];

    if (normalizedNameQuery && index?.byFullName?.has(normalizedNameQuery)) {
      indexedCandidates.push(...index.byFullName.get(normalizedNameQuery));
    }

    inputTokens.forEach((token) => {
      if (index?.byNameToken?.has(token)) {
        indexedCandidates.push(...index.byNameToken.get(token));
      }
      if (index?.byToken?.has(token)) {
        indexedCandidates.push(...index.byToken.get(token));
      }
      if (index?.byTourToken?.has(token)) {
        indexedCandidates.push(...index.byTourToken.get(token));
      }
    });

    if (indexedCandidates.length > 0) {
      candidatePool = dedupe(indexedCandidates);
    }
  }

  return dedupe(
    candidatePool
      .map((option) => {
        const fullNameNormalized =
          option.fullNameNormalized || normalizeName(
            option.fullName ||
            option.label ||
            `${option.First_Name || ''} ${option.Last_Name || ''}`
          );
        const nameVariantsNormalized = Array.from(
          new Set([
            fullNameNormalized,
            ...(option.nameVariantsNormalized || []),
          ].filter(Boolean))
        );
        const label = option.searchableLabelLower || normalize(option.searchableLabel);
        const nameTokenSets = nameVariantsNormalized.map((value) => tokenize(value));
        const matchedNameTokens = nameTokenSets.reduce((best, tokens) => (
          Math.max(best, inputTokens.filter((token) => tokens.includes(token)).length)
        ), 0);
        const allNameTokensMatch = inputTokens.length > 0 && nameTokenSets.some((tokens) => (
          inputTokens.every((token) => tokens.includes(token))
        ));
        const exactNameMatch =
          Boolean(normalizedNameQuery) && nameVariantsNormalized.includes(normalizedNameQuery);
        const orderedNameMatch =
          Boolean(normalizedNameQuery) &&
          nameVariantsNormalized.some((value) => (
            value === normalizedNameQuery || value.includes(normalizedNameQuery)
          ));
        const labelMatch = label.includes(input);
        const allLabelTokensMatch =
          inputTokens.length > 0 && inputTokens.every((token) => label.includes(token));
        const tourValue = getTourName ? normalize(getTourName(option)) : '';
        const tourMatch =
          Boolean(tourValue) &&
          (tourValue.includes(input) ||
            (inputTokens.length > 0 && inputTokens.every((token) => tourValue.includes(token))));

        if (!(orderedNameMatch || allNameTokensMatch || labelMatch || allLabelTokensMatch || tourMatch)) {
          return null;
        }

        let score = 0;
        if (exactNameMatch) score += 500;
        else if (orderedNameMatch) score += 320;
        if (allNameTokensMatch) score += 220;
        if (matchedNameTokens > 0) score += matchedNameTokens * 25;
        if (labelMatch) score += 80;
        if (allLabelTokensMatch) score += 60;
        if (tourMatch) score += 40;

        return { option, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map(({ option }) => option)
  );
};
