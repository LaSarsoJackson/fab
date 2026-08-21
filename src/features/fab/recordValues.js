export const cleanRecordValue = (value) => String(value ?? "").trim();

export const normalizeRecordName = (value) => cleanRecordValue(value)
  .toLocaleLowerCase()
  .replace(/['’.]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export const readFirstRecordValue = (record = {}, keys = []) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && cleanRecordValue(value)) return value;
  }
  return "";
};

export const getRecordLocationParts = (record = {}) => [
  ["Section", record.Section ?? record.section],
  ["Lot", record.Lot ?? record.lot],
  ["Tier", record.Tier ?? record.tier],
  ["Grave", record.Grave ?? record.grave],
  ["Row", record.Row ?? record.row],
  ["Position", record.Position ?? record.position],
]
  .map(([label, value]) => [label, cleanRecordValue(value)])
  .filter(([, value]) => value && value !== "0")
  .map(([label, value]) => `${label} ${value}`);

export const formatRecordLocation = (record = {}, separator = " · ") => (
  getRecordLocationParts(record).join(separator)
);

export const formatRecordSecondaryText = (record = {}) => {
  const location = getRecordLocationParts(record).slice(0, 2).join(", ");
  const birth = cleanRecordValue(record.Birth ?? record.birth);
  const death = cleanRecordValue(record.Death ?? record.death);
  const extraTitle = cleanRecordValue(record.extraTitle);
  return [
    location,
    birth ? `Born ${birth}` : "",
    death ? `Died ${death}` : "",
    !birth && !death ? extraTitle : "",
  ].filter(Boolean).join(" • ");
};
