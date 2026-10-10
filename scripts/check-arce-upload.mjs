import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getArceDeployment } from '../arce/deployment.js';
const deployment = getArceDeployment(process.argv[2] || process.env.ARCE_TARGET);
const root = `${deployment.outputDir}/upload`;
const manifest = JSON.parse(await readFile(`${deployment.outputDir}/UPLOAD-MANIFEST.json`, 'utf8'));
if (manifest.websitePath !== deployment.sitePath || manifest.target !== deployment.target) throw new Error('Wrong package target.');
const paths = new Set(manifest.files.map(file => file.path));
const preserved = new Set(['arce/Stoneman21.html', 'arce/Arthur18.html', 'arce/Corning41.html', 'arce/Soldier33.html']);
const biographyLinks = JSON.parse(await readFile('arce/biography-links.json', 'utf8'));
for (const file of Object.values(biographyLinks)) preserved.add(`arce/${file}`);
const links = [];
for (const file of manifest.files) {
  const bytes = await readFile(`${root}/${file.path}`);
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
    throw new Error(`Manifest mismatch: ${file.path}`);
  }
  if (!file.path.endsWith('.html') || file.path.includes('/app/')) continue;
  for (const match of bytes.toString().matchAll(/(?:href|src|srcset)="([^"]+)"/g)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), `${deployment.origin}/${file.path}`);
    if (url.origin !== deployment.origin) continue;
    let target = decodeURIComponent(url.pathname.slice(1));
    if (target.endsWith('/')) target += 'index.html';
    if (target.startsWith('arce/Grave_Finder/')) throw new Error(`Website links to the retired tool: ${file.path}`);
    if (!paths.has(target) && !preserved.has(target)) throw new Error(`Missing destination: ${file.path} -> ${target}`);
    links.push({ source: file.path, target });
  }
}
if (paths.has('arce/Grave_Finder/index.html')) throw new Error('Standalone Grave Finder must be preserved.');
const index = await readFile(`${root}${deployment.sitePath}app/index.html`, 'utf8');
if (!index.includes(`${deployment.sitePath}app/assets/`)) throw new Error('Wrong app asset base.');
const worker = await readFile(`${root}${deployment.sitePath}app/service-worker.js`, 'utf8');
if (!worker.includes(`${deployment.cachePrefix}8`) || worker.includes('fab-static-v')) throw new Error('Worker cache namespace is not isolated.');
console.log(JSON.stringify({ version: manifest.version, sourceCommit: manifest.sourceCommit,
  verifiedFiles: manifest.files.length, internalLinks: links.length,
  standaloneGraveFinder: 'preserved', target: deployment.target, websitePath: deployment.sitePath, assetBase: `${deployment.sitePath}app/` }, null, 2));
