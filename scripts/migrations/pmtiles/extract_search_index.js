/**
 * extract_search_index.js
 * 
 * Extracts ONLY essential search fields and uses minified keys to minimize size.
 * Full metadata should be offloaded to PMTiles.
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../../../src/data/Geo_Burials.json');
const OUTPUT_FILE = path.join(__dirname, '../../../src/data/Search_Burials.json');

console.log(`Reading ${INPUT_FILE}...`);

try {
  const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
  const geojson = JSON.parse(rawData);

  console.log(`Processing ${geojson.features.length} features...`);

  const searchData = geojson.features.map(feature => {
    const p = feature.properties || {};
    // Minified keys: 
    // i: id, f: First_Name, l: Last_Name, s: Section, lo: Lot, g: Grave, t: Tier, b: Birth, d: Death, tk: tourKey
    return {
      i: feature.id || p.OBJECTID,
      f: p.First_Name || '',
      l: p.Last_Name || '',
      s: p.Section || '',
      lo: p.Lot || '',
      g: p.Grave || '',
      t: p.Tier || '',
      b: p.Birth || '',
      d: p.Death || '',
      tk: p.tourKey || p.title || ''
    };
  });

  console.log(`Writing minified search index to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(searchData));

  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`Success! New file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} catch (error) {
  console.error('Error processing search index:', error);
  process.exit(1);
}
