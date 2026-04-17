import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { TOUR_DEFINITIONS, buildTourBiographyAliases } from "../src/features/tours/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../src/data/TourBiographyAliases.json");

const main = async () => {
  const records = [];

  for (const definition of TOUR_DEFINITIONS) {
    const module = await definition.load();
    const features = module.default?.features || module.features || [];
    records.push(...features.map((feature) => feature.properties || {}));
  }

  const aliases = buildTourBiographyAliases(records);

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(aliases, null, 2)}\n`);
  console.log(`Wrote biography aliases to ${OUTPUT_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
