const getNumericBurialProperty = (record, key) => {
  const numericValue = Number(record?.[key] ?? record?.[key?.toLowerCase?.()] ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const getBurialVisualKey = (record = {}) => String(
  record.id ??
  record.OBJECTID ??
  record.objectid ??
  [
    record.Section,
    record.Lot,
    record.Grave,
    record.Tier,
    record.First_Name,
    record.Last_Name,
  ].join(":")
);

const hashBurialVisualKey = (value) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const hasIndexedBurialPlacement = (record = {}) => (
  getNumericBurialProperty(record, "Grave") > 0 ||
  getNumericBurialProperty(record, "Tier") > 0
);

const getBurialMarkerOffsetScale = (zoom) => {
  if (zoom >= 23) return 10;
  if (zoom >= 22) return 8.7;
  if (zoom >= 21) return 7.4;
  return 0;
};

export const getStackedBurialMarkerOffset = (zoom, record = {}) => {
  const offsetScale = getBurialMarkerOffsetScale(zoom);
  if (offsetScale <= 0) {
    return { dx: 0, dy: 0 };
  }

  const grave = getNumericBurialProperty(record, "Grave");
  const tier = getNumericBurialProperty(record, "Tier");
  const hash = hashBurialVisualKey(getBurialVisualKey(record));

  if (hasIndexedBurialPlacement(record)) {
    const angle = (
      ((grave > 0 ? grave : hash % 24) % 16) / 16
    ) * Math.PI * 2 + ((hash % 7) * 0.07);
    const tierBand = tier > 0 ? Math.min(tier, 6) : ((hash % 4) + 1);
    const distance = Math.min(12, offsetScale * (0.76 + ((tierBand - 1) * 0.18)));
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
    };
  }

  const angle = ((hash % 24) / 24) * Math.PI * 2;
  const distance = Math.min(9.5, offsetScale * (0.5 + ((hash % 5) * 0.11)));
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
  };
};
