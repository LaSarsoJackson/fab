import { buildLocationSummary, formatBrowseResultName } from "../browse/browseResults";
import { APP_PROFILE, getAppFeature } from "../../config/appProfile";
import { FEATURE_FLAGS } from "../../shared/runtime/runtimeEnv";
import { getTourStyle } from "../tours/tourStyles";
import { resolvePortraitImageName } from "../tours/tourDerivedData";
const BOUTIQUE_RECORD_PRESENTATION = getAppFeature("boutiqueRecordPresentation");
const DEFAULT_RECORD_SOURCE_LABEL = APP_PROFILE.labels?.defaultRecordSourceLabel || "Asset record";

/**
 * Normalize mixed record values from burial JSON, tour JSON, and generated browse
 * results into a predictable string. `Map.jsx` consumes many record shapes, so
 * keeping this helper shared avoids repeated null/undefined checks.
 */
export const cleanRecordValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const resolveRecordBiographyLink = (record = {}) => {
  if (
    FEATURE_FLAGS.fabRecordPresentation &&
    typeof BOUTIQUE_RECORD_PRESENTATION?.resolveBiographyLink === "function"
  ) {
    return cleanRecordValue(BOUTIQUE_RECORD_PRESENTATION.resolveBiographyLink(record));
  }

  return cleanRecordValue(record.biographyLink || record.Tour_Bio);
};

const parseRecordDateParts = (value) => {
  const normalized = cleanRecordValue(value);
  if (!normalized || /^(unknown|none)$/i.test(normalized)) {
    return null;
  }

  const isoMatch = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const usMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    return {
      year: Number(usMatch[3]),
      month: Number(usMatch[1]),
      day: Number(usMatch[2]),
    };
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
};

const formatRecordDate = (value) => {
  const dateParts = parseRecordDateParts(value);
  if (!dateParts) {
    return cleanRecordValue(value);
  }

  return `${dateParts.month}/${dateParts.day}/${dateParts.year}`;
};

const compareDateParts = (left, right) => {
  if (!left || !right) return 0;

  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
};

/**
 * Burial and tour data occasionally disagree or ship malformed dates. When a
 * parsed birth date comes after the parsed death date, suppress the birth date
 * rather than render clearly incorrect output in the popup/sidebar UI.
 */
export const resolveRecordDates = (record = {}) => {
  const birthValue = cleanRecordValue(record.Birth ?? record.birth);
  const deathValue = cleanRecordValue(record.Death ?? record.death);
  const birthDate = parseRecordDateParts(birthValue);
  const deathDate = parseRecordDateParts(deathValue);
  const shouldSuppressBirth = Boolean(
    birthDate &&
    deathDate &&
    compareDateParts(birthDate, deathDate) > 0
  );

  return {
    birth: shouldSuppressBirth ? "" : formatRecordDate(birthValue),
    death: formatRecordDate(deathValue),
  };
};

const resolveRecordImageUrl = (imageName) => {
  if (
    FEATURE_FLAGS.fabRecordPresentation &&
    typeof BOUTIQUE_RECORD_PRESENTATION?.resolveImageUrl === "function"
  ) {
    return cleanRecordValue(BOUTIQUE_RECORD_PRESENTATION.resolveImageUrl(imageName));
  }

  return "";
};

const buildPopupRows = (record = {}) => {
  if (
    FEATURE_FLAGS.fabRecordPresentation &&
    typeof BOUTIQUE_RECORD_PRESENTATION?.buildPopupRows === "function"
  ) {
    return BOUTIQUE_RECORD_PRESENTATION.buildPopupRows(record, {
      buildLocationSummary,
      cleanRecordValue,
      resolveRecordDates,
    });
  }

  const { birth, death } = resolveRecordDates(record);
  const location = cleanRecordValue(buildLocationSummary(record));

  return [
    location ? { label: "Location", value: location } : null,
    birth ? { label: "Born", value: birth } : null,
    death ? { label: "Died", value: death } : null,
  ].filter(Boolean);
};

const buildPopupSourceLabel = (record = {}) => (
  cleanRecordValue(
    record.tourName ||
    (record.source === "tour" ? getTourStyle(record.tourKey)?.name : DEFAULT_RECORD_SOURCE_LABEL)
  )
);

/**
 * Build the popup card view model from the normalized browse-result record.
 * Keeping this transformation out of `Map.jsx` makes popup UI changes easier to
 * review without also reading map lifecycle code.
 */
export const buildPopupViewModel = (record = {}) => {
  const portraitPath = cleanRecordValue(resolvePortraitImageName(record));
  const biographyLink = resolveRecordBiographyLink(record);
  const noImageUrl = cleanRecordValue(BOUTIQUE_RECORD_PRESENTATION?.noImageUrl);
  const hasPortrait = Boolean(portraitPath && portraitPath !== "NONE");
  const hasBiographyLink = Boolean(biographyLink);
  const imageUrl = hasPortrait ? resolveRecordImageUrl(portraitPath) : (hasBiographyLink ? noImageUrl : "");
  const heading = cleanRecordValue(formatBrowseResultName(record));
  const imageLinkUrl = biographyLink || "";
  const imageHint = imageUrl && hasBiographyLink
    ? cleanRecordValue(BOUTIQUE_RECORD_PRESENTATION?.biographyImageHint)
    : "";
  const rows = buildPopupRows(record);

  return {
    heading,
    sourceLabel: buildPopupSourceLabel(record),
    subtitle: "",
    paragraphs: [],
    rows,
    biographyLink,
    imageLinkUrl,
    imageUrl,
    imageFallbackUrl: hasPortrait && hasBiographyLink ? noImageUrl : "",
    imageAlt: heading ? `${heading} portrait` : "Burial portrait",
    imageHint,
  };
};
