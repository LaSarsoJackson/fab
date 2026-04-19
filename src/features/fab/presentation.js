import { FAB_SITE_CONFIG, buildFabImageUrl, buildFabSiteUrl } from "./siteConfig";

const DEV_IMAGE_SERVER_ORIGIN = (process.env.REACT_APP_DEV_IMAGE_SERVER_ORIGIN || "")
  .trim()
  .replace(/\/+$/, "");

export const FAB_NO_IMAGE_URL = buildFabImageUrl(FAB_SITE_CONFIG.media.noImageFileName);
export const FAB_BIOGRAPHY_IMAGE_HINT = FAB_SITE_CONFIG.media.biographyImageHint;

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeFabPageLink = (value = "") => {
  const normalized = cleanValue(value);
  if (!normalized || /^(none|unknown)$/i.test(normalized)) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const trimmed = normalized.replace(/^\/+/, "");
  if (/\.(?:jpe?g|png|gif|webp|svg)$/i.test(trimmed)) {
    return "";
  }

  if (/^[a-z]+:/i.test(trimmed)) {
    return trimmed;
  }

  if (/\.html?$/i.test(trimmed)) {
    return buildFabSiteUrl(trimmed);
  }

  return buildFabSiteUrl(`${trimmed}.html`);
};

export const resolveFabBiographyLink = (record = {}) => (
  normalizeFabPageLink(record.biographyLink) || normalizeFabPageLink(record.Tour_Bio)
);

export const resolveFabRecordImageUrl = (imageName) => {
  if (!imageName || imageName === "NONE") return FAB_NO_IMAGE_URL;

  const normalizedImageName = String(imageName).trim();
  const imageFileName = /\.[a-z0-9]+$/i.test(normalizedImageName)
    ? normalizedImageName
    : `${normalizedImageName}.jpg`;

  if (process.env.NODE_ENV === "development" && DEV_IMAGE_SERVER_ORIGIN) {
    return `${DEV_IMAGE_SERVER_ORIGIN}/src/data/images/${imageFileName}`;
  }

  return buildFabImageUrl(imageFileName);
};

export const buildFabPopupRows = (record = {}, helpers = {}) => {
  const {
    buildLocationSummary = () => "",
    resolveRecordDates = () => ({ birth: "", death: "" }),
  } = helpers;
  const { birth, death } = resolveRecordDates(record);
  const title = cleanValue(record.Titles || record.extraTitle);
  const rank = cleanValue(record.Highest_Ra);
  const initialTerm = cleanValue(record.Initial_Te);
  const subsequentTerm = cleanValue(record.Subsequent);
  const unit = cleanValue(record.Unit);
  const location = cleanValue(buildLocationSummary(record));
  const headstone = cleanValue(record.Headstone_);
  const service = cleanValue(record.Service_Re);
  const headstoneLabel = headstone.toLowerCase().startsWith("headstone")
    ? headstone
    : `Headstone ${headstone}`;

  return [
    title ? { label: "Role", value: title } : null,
    rank && rank !== title ? { label: "Rank", value: rank } : null,
    initialTerm ? { label: "Initial term", value: initialTerm } : null,
    subsequentTerm ? { label: "Subsequent term", value: subsequentTerm } : null,
    unit ? { label: "Unit", value: unit } : null,
    location ? { label: "Location", value: location } : null,
    birth ? { label: "Born", value: birth } : null,
    death ? { label: "Died", value: death } : null,
    headstone ? { label: "Headstone", value: headstoneLabel } : null,
    service ? { label: "Service", value: service } : null,
  ].filter(Boolean);
};
