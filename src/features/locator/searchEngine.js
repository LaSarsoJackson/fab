const clean = (value) => String(value ?? "").trim();
const normalizeLocationIdentifier = (value) => clean(value).toLocaleLowerCase();

export const getSearchCriteriaKey = ({ query, section, lot, tier, recordId } = {}) => (
  JSON.stringify([query, section, lot, tier, recordId].map(clean))
);

export const normalizeSearchText = (value) => clean(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export const prepareSearchRows = (rows = []) => rows.map((row) => {
  const first = normalizeSearchText(row.f);
  const last = normalizeSearchText(row.l);
  return {
    row,
    first,
    last,
    name: `${first} ${last}`.trim(),
    reverseName: `${last} ${first}`.trim(),
    section: normalizeSearchText(row.s),
    lot: normalizeLocationIdentifier(row.lo),
    tier: normalizeLocationIdentifier(row.t),
  };
});

const scoreMatch = (entry, query, tokens) => {
  if (entry.name === query || entry.reverseName === query) return 0;
  if (entry.last === query) return 1;
  if (entry.name.startsWith(query) || entry.reverseName.startsWith(query)) return 2;
  if (tokens.every((token) => entry.name.includes(token) || entry.reverseName.includes(token))) return 3;
  return Number.POSITIVE_INFINITY;
};

const matchesLocation = (entry, section, lot, tier) => (
  (!section || entry.section === section) &&
  (!lot || entry.lot === lot) &&
  (!tier || entry.tier === tier)
);

export const searchPreparedRows = (preparedRows, {
  query = "",
  section = "",
  lot = "",
  tier = "",
  recordId = "",
  limit = 80,
} = {}) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedSection = normalizeSearchText(section);
  const normalizedLot = normalizeLocationIdentifier(lot);
  const normalizedTier = normalizeLocationIdentifier(tier);
  // An invalid location in a deep link must not become a cemetery-wide query.
  if ([section, lot, tier].some((value) => value && !normalizeSearchText(value))) {
    return { total: 0, rows: [] };
  }
  const normalizedId = clean(recordId);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const matches = [];

  for (const entry of preparedRows) {
    if (normalizedId && clean(entry.row.i) !== normalizedId) continue;
    if (!matchesLocation(entry, normalizedSection, normalizedLot, normalizedTier)) continue;

    const score = normalizedId || !normalizedQuery
      ? 0
      : scoreMatch(entry, normalizedQuery, tokens);
    if (!Number.isFinite(score)) continue;

    matches.push({ entry, score });
  }

  matches.sort((left, right) => (
    left.score - right.score ||
    left.entry.last.localeCompare(right.entry.last) ||
    left.entry.first.localeCompare(right.entry.first)
  ));

  return {
    total: matches.length,
    rows: matches.slice(0, Math.max(1, limit)).map(({ entry }) => entry.row),
  };
};
