/**
 * Pulls checked-in static basemap images from the NYS ITS orthoimagery service.
 *
 * Bounds live in the FAB app profile because they are app data, not Leaflet
 * rendering behavior. The export itself uses Web Mercator so the downloaded
 * image aligns with Leaflet's projected image overlay.
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { FAB_BASEMAP_IMAGE_EXPORTS } from "../src/features/fab/profile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const WEB_MERCATOR_RADIUS = 6378137;
const WEB_MERCATOR_MAX_LATITUDE = 85.0511287798066;
const WEB_MERCATOR_WKID = 3857;

const clampLatitudeForWebMercator = (latitude) => (
  Math.max(-WEB_MERCATOR_MAX_LATITUDE, Math.min(WEB_MERCATOR_MAX_LATITUDE, latitude))
);

const projectLatLngToWebMercator = ([latitude, longitude]) => {
  const clampedLatitude = clampLatitudeForWebMercator(latitude);
  const longitudeRadians = longitude * Math.PI / 180;
  const latitudeRadians = clampedLatitude * Math.PI / 180;

  return [
    WEB_MERCATOR_RADIUS * longitudeRadians,
    WEB_MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2)),
  ];
};

const getWebMercatorExtent = (bounds) => {
  const [southWest, northEast] = bounds;
  const [xmin, ymin] = projectLatLngToWebMercator(southWest);
  const [xmax, ymax] = projectLatLngToWebMercator(northEast);

  return { xmin, ymin, xmax, ymax };
};

const getExportSize = (extent, maxDimension = 4096) => {
  const width = Math.abs(extent.xmax - extent.xmin);
  const height = Math.abs(extent.ymax - extent.ymin);

  if (width <= 0 || height <= 0) {
    throw new Error("Cannot export a basemap with empty bounds.");
  }

  if (width >= height) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round(maxDimension * height / width)),
    };
  }

  return {
    width: Math.max(1, Math.round(maxDimension * width / height)),
    height: maxDimension,
  };
};

const buildExportRequestUrl = (definition) => {
  const extent = getWebMercatorExtent(definition.bounds);
  const { width, height } = getExportSize(extent, definition.maxImageDimension);
  const url = new URL(definition.sourceExportUrl);

  url.searchParams.set("bbox", [
    extent.xmin,
    extent.ymin,
    extent.xmax,
    extent.ymax,
  ].join(","));
  url.searchParams.set("bboxSR", String(WEB_MERCATOR_WKID));
  url.searchParams.set("imageSR", String(WEB_MERCATOR_WKID));
  url.searchParams.set("size", `${width},${height}`);
  url.searchParams.set("format", "jpg");
  url.searchParams.set("transparent", "false");
  url.searchParams.set("f", "json");

  return url;
};

const fetchJson = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Basemap export request failed (${response.status}) for ${url}`);
  }

  return response.json();
};

const fetchBuffer = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Basemap image download failed (${response.status}) for ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const normalizeDownloadUrl = (value) => String(value || "").replace(/^http:\/\//i, "https://");

const generateBasemap = async (definition) => {
  const requestUrl = buildExportRequestUrl(definition);
  const exportResult = await fetchJson(requestUrl);
  const imageUrl = normalizeDownloadUrl(exportResult.href);

  if (!imageUrl) {
    throw new Error(`Basemap export did not return an image URL for ${definition.id}.`);
  }

  const outputPath = path.join(ROOT_DIR, definition.outputPath);
  const image = await fetchBuffer(imageUrl);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, image);

  console.log([
    `Wrote ${definition.id} basemap`,
    `${exportResult.width}x${exportResult.height}`,
    `to ${definition.outputPath}`,
  ].join(" "));
};

const main = async () => {
  for (const definition of FAB_BASEMAP_IMAGE_EXPORTS) {
    await generateBasemap(definition);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
