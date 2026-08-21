const clean = (value) => String(value ?? "").trim();

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
  };
});

const scoreMatch = (entry, query, tokens) => {
  if (entry.name === query || entry.reverseName === query) return 0;
  if (entry.last === query) return 1;
  if (entry.name.startsWith(query) || entry.reverseName.startsWith(query)) return 2;
  if (tokens.every((token) => entry.name.includes(token) || entry.reverseName.includes(token))) return 3;
  return Number.POSITIVE_INFINITY;
};

export const searchPreparedRows = (preparedRows, {
  query = "",
  section = "",
  recordId = "",
  limit = 80,
} = {}) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedSection = normalizeSearchText(section);
  const normalizedId = clean(recordId);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const matches = [];

  for (const entry of preparedRows) {
    if (normalizedId && clean(entry.row.i) !== normalizedId) continue;
    if (normalizedSection && entry.section !== normalizedSection) continue;

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
