import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { getArceDeployment } from '../arce/deployment.js';

const deployment = getArceDeployment(process.env.ARCE_TARGET);
const root = deployment.outputDir;
const destination = `${root}/upload${deployment.sitePath.slice(0, -1)}`;
await cp('arce/pages', destination, { recursive: true });
await cp('arce/arce-guide.js', `${destination}/arce-guide.js`);
await cp('arce/arce-launch.css', `${destination}/arce-launch.css`);
await cp('arce/assets', `${destination}/assets`, { recursive: true });

// The university build must not remove caches belonging to other apps on albany.edu.
const workerFile = `${destination}/app/service-worker.js`;
const worker = (await readFile(workerFile, 'utf8'))
  .replace('"fab-v8"', `"${deployment.cachePrefix}8"`)
  .replace('/^(?:fab-v|fab-static-v|fab-runtime-v)\\d+$/', `/^${deployment.cachePrefix}\\d+$/`);
await writeFile(workerFile, worker);

const privacyFile = `${destination}/app/privacy.html`;
const privacy = (await readFile(privacyFile, 'utf8'))
  .replace('The web experience and burial index are hosted on GitHub Pages.',
    'This ARCE deployment and its burial index are hosted by the University at Albany. The separately maintained GitHub Pages deployment is hosted by GitHub.')
  .replace('Updated October 3, 2026', 'Updated October 6, 2026');
await writeFile(privacyFile, privacy);


for (const [file, view] of [['tours.html', 'tours'], ['Burial_Locator/index.html', 'burials']]) {
  const prefix = file.includes('/') ? '../' : './';
  const url = `${prefix}app/?view=${view}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Open Albany Grave Finder · ARCE</title></head><body><h1>Albany Grave Finder</h1><p>This tool is now part of the cemetery app.</p><p><a href="${url}">Continue to the app</a></p><script>const target=new URL(${JSON.stringify(url)},location.href); const incoming=new URLSearchParams(location.search); for(const key of ['q','section','lot','tier','tour','record','share','embed']) if(incoming.has(key)) target.searchParams.set(key,incoming.get(key)); location.replace(target.href);</script></body></html>`;
  await mkdir(path.dirname(`${destination}/${file}`), { recursive: true });
  await writeFile(`${destination}/${file}`, html);
}

const files = [];
async function inventory(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) await inventory(file);
    else {
      const bytes = await readFile(file);
      files.push({ path: path.relative(`${root}/upload`, file), bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
await inventory(`${root}/upload`);
files.sort((a, b) => a.path.localeCompare(b.path));
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await writeFile(`${root}/UPLOAD-MANIFEST.json`, JSON.stringify({
  version, websiteRevision: '2026-10-06', sourceCommit,
  target: deployment.target,
  websitePath: deployment.sitePath,
  websiteUrl: `https://www.albany.edu${deployment.sitePath}`,
  appUrl: `https://www.albany.edu${deployment.sitePath}app/`,
  preserved: ['arce/Grave_Finder/',
    'existing biography pages, image collections and historical data'],
  files,
}, null, 2));
await cp('docs/arce-upload-instructions.md', `${root}/UPLOAD-INSTRUCTIONS.md`);
console.log(`ARCE package: ${files.length} files, ${(files.reduce((total, file) => total + file.bytes, 0) / 1048576).toFixed(1)} MiB.`);
