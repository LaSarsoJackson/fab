const stripLeadingSlash = (value = "") => String(value).trim().replace(/^\/+/, "");
const stripTrailingSlash = (value = "") => String(value).trim().replace(/\/+$/, "");

const SITE_ROOT_URL = "https://www.albany.edu/arce";

export const FAB_SITE_CONFIG = Object.freeze({
  siteName: "Albany Rural Cemetery",
  adminSiteName: "Albany Rural Cemetery Admin",
  homeUrl: `${SITE_ROOT_URL}/`,
  distribution: Object.freeze({
    iosAppStoreUrl: "https://apps.apple.com/us/app/albany-grave-finder/id6746413050",
  }),
  shell: Object.freeze({
    headerTitle: "Burial Finder",
    documentTitle: "Albany Rural Cemetery Burial Finder",
    manifestName: "Albany Rural Cemetery Burial Finder",
    manifestShortName: "Burial Finder",
    description: "Installable burial locator for Albany Rural Cemetery with fast search, tours, navigation, and shareable map links.",
    noScriptMessage: "You need to enable JavaScript to run the ARC Find-A-Burial App.",
  }),
  media: Object.freeze({
    imageDirectory: "images",
    noImageFileName: "no-image.jpg",
    biographyImageHint: "Tap the image to open the ARCE biography.",
  }),
});

export const buildFabSiteUrl = (path = "") => {
  const baseUrl = stripTrailingSlash(FAB_SITE_CONFIG.homeUrl);
  const normalizedPath = stripLeadingSlash(path);

  return normalizedPath ? `${baseUrl}/${normalizedPath}` : `${baseUrl}/`;
};

export const buildFabImageUrl = (fileName = "") => (
  buildFabSiteUrl(`${FAB_SITE_CONFIG.media.imageDirectory}/${stripLeadingSlash(fileName)}`)
);
