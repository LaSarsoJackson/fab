/**
 * Generates the checked-in PWA icon assets from the source ARCE SVG mark.
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SOURCE_ICON_PATH = path.join(PUBLIC_DIR, "arce-icon.svg");

const PNG_TARGETS = [
  { size: 192, fileName: "logo192.png" },
  { size: 512, fileName: "logo512.png" },
];
const FAVICON_SIZES = [16, 24, 32, 64];

const encodeIco = (images) => {
  const headerSize = 6;
  const directorySize = images.length * 16;
  let imageOffset = headerSize + directorySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(directorySize);

  images.forEach(({ size, buffer }, index) => {
    const entryOffset = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    directory.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    directory.writeUInt8(0, entryOffset + 2);
    directory.writeUInt8(0, entryOffset + 3);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(buffer.length, entryOffset + 8);
    directory.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += buffer.length;
  });

  return Buffer.concat([header, directory, ...images.map(({ buffer }) => buffer)]);
};

const renderIcon = async (page, svgDataUri, size) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          html,
          body {
            width: ${size}px;
            height: ${size}px;
            margin: 0;
            background: transparent;
            overflow: hidden;
          }

          img {
            display: block;
            width: ${size}px;
            height: ${size}px;
          }
        </style>
      </head>
      <body>
        <img alt="" src="${svgDataUri}" />
      </body>
    </html>
  `);
  await page.evaluate(() => document.querySelector("img").decode());

  return page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: true,
  });
};

const main = async () => {
  const svg = await fs.readFile(SOURCE_ICON_PATH, "utf8");
  const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const faviconImages = [];

    for (const { size, fileName } of PNG_TARGETS) {
      const buffer = await renderIcon(page, svgDataUri, size);
      await fs.writeFile(path.join(PUBLIC_DIR, fileName), buffer);
    }

    for (const size of FAVICON_SIZES) {
      const buffer = await renderIcon(page, svgDataUri, size);
      faviconImages.push({ size, buffer });
    }

    await fs.writeFile(path.join(PUBLIC_DIR, "favicon.ico"), encodeIco(faviconImages));
  } finally {
    await browser.close();
  }

  console.log("Generated ARCE PWA icons.");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
