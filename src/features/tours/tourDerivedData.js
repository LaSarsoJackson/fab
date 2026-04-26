import { normalizeName } from "../browse/burialSearch";

export const IMAGE_EXTENSION_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const isMissingValue = (value) => /^(none|unknown)$/i.test(cleanValue(value));

/**
 * Tour datasets use three portrait fields and sentinel values like `NONE`.
 * Normalize that into one canonical image name that the UI can consume.
 */
export const resolvePortraitImageName = (record = {}) => {
  const normalized = cleanValue(
    record.portraitImageName ||
    record.Bio_Portra ||
    record.Bio_Portri ||
    record.Bio_portra
  );

  return isMissingValue(normalized) ? "" : normalized;
};

/**
 * Some source records point directly at `.html` biographies while others only
 * carry an image name. Treat image filenames as portraits, not biographies.
 */
export const isValidBiographyReference = (value) => {
  const normalized = cleanValue(value);
  return Boolean(
    normalized &&
    !isMissingValue(normalized) &&
    !IMAGE_EXTENSION_PATTERN.test(normalized)
  );
};

/**
 * ARCE portrait files often end in an image-variant suffix such as `a`, `b`,
 * or `d`. Removing the trailing variant lets us correlate portraits back to the
 * canonical biography slug they belong to.
 */
export const normalizePortraitStem = (value) => {
  const normalized = cleanValue(value);
  if (!normalized || isMissingValue(normalized)) {
    return "";
  }

  const fileName = normalized.split("/").pop() || normalized;
  const withoutExtension = fileName.replace(IMAGE_EXTENSION_PATTERN, "");
  return withoutExtension.replace(/(\d)[a-z]$/i, "$1").toLowerCase();
};

/**
 * Name + section + lot is the strongest stable join key we have across the
 * legacy tour datasets. We keep it explicit because plain name matching is too
 * weak for records such as the multiple Cornings or Schuylers.
 */
export const buildBiographyAliasKey = (name, section, lot) => {
  const normalizedName = normalizeName(name);
  const normalizedSection = cleanValue(section);
  const normalizedLot = cleanValue(lot);

  if (!normalizedName || !normalizedSection || !normalizedLot) {
    return "";
  }

  return `${normalizedName}::${normalizedSection}::${normalizedLot}`;
};

const addUniqueAlias = (map, key, value) => {
  if (!key || !value) return;

  if (!map.has(key)) {
    map.set(key, value);
    return;
  }

  if (map.get(key) !== value) {
    map.set(key, "");
  }
};

const toSortedObject = (map) => Object.fromEntries(
  Array.from(map.entries())
    .filter(([, value]) => value)
    .sort(([left], [right]) => left.localeCompare(right))
);

/**
 * Build deterministic alias maps from raw tour records. This generated data is
 * what lets fixed-format tours such as Mayors of Albany inherit biography
 * slugs from better-annotated tours without frontend special cases.
 */
export const buildTourBiographyAliases = (records = []) => {
  const byName = new Map();
  const byNameSectionLot = new Map();
  const byPortraitStem = new Map();

  records.forEach((record) => {
    const biographySlug = cleanValue(record.Tour_Bio);
    if (!isValidBiographyReference(biographySlug)) {
      return;
    }

    const fullName = cleanValue(
      record.Full_Name ||
      record.fullName ||
      record.displayName ||
      `${record.First_Name || record.First_name || ""} ${record.Last_Name || ""}`.trim()
    );
    const section = cleanValue(record.Section || record.ARC_Secton);
    const lot = cleanValue(record.Lot || record.ARC_Lot);
    const nameKey = normalizeName(fullName);
    const nameSectionLotKey = buildBiographyAliasKey(fullName, section, lot);
    const portraitStem = normalizePortraitStem(resolvePortraitImageName(record));

    addUniqueAlias(byName, nameKey, biographySlug);
    addUniqueAlias(byNameSectionLot, nameSectionLotKey, biographySlug);
    addUniqueAlias(byPortraitStem, portraitStem, biographySlug);
  });

  return {
    byName: toSortedObject(byName),
    byNameSectionLot: toSortedObject(byNameSectionLot),
    byPortraitStem: toSortedObject(byPortraitStem),
  };
};

/**
 * Resolve the canonical biography slug for a normalized tour record.
 *
 * Lookup order is intentionally conservative:
 * 1. explicit biography value on the record
 * 2. exact name + section + lot match
 * 3. exact normalized name match
 * 4. portrait stem match
 */
export const resolveBiographyReferenceFromAliases = (record = {}, aliases = {}) => {
  const explicitReference = cleanValue(record.biographyLink || record.Tour_Bio);
  if (isValidBiographyReference(explicitReference)) {
    return explicitReference;
  }

  const fullName = cleanValue(
    record.Full_Name ||
    record.fullName ||
    record.displayName ||
    `${record.First_Name || record.First_name || ""} ${record.Last_Name || ""}`.trim()
  );
  const section = cleanValue(record.Section || record.ARC_Secton);
  const lot = cleanValue(record.Lot || record.ARC_Lot);
  const nameSectionLotKey = buildBiographyAliasKey(fullName, section, lot);
  const normalizedName = normalizeName(fullName);
  const portraitStem = normalizePortraitStem(resolvePortraitImageName(record));

  return cleanValue(
    aliases.byNameSectionLot?.[nameSectionLotKey] ||
    aliases.byName?.[normalizedName] ||
    aliases.byPortraitStem?.[portraitStem]
  );
};
