import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { FAB_TOUR_DEFINITIONS } from '../src/features/fab/tours.js';

const pages = new Map();
const map = 'app/?view=map';
const burial = 'app/?view=burials';
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const action = (url, text) => `<a class="action" href="${url}">${text}</a>`;
const visit = '<p><a href="offline.html">Before your visit: connection, maps and location</a></p>';
const authors = ['Michael Barrett', 'Mark Bodnar', 'Julie O’Connor', 'Carla Sofka', 'Tyler Kattrein', 'Paula Lemire'];
const contributors = ['Rui Li', 'Kurt Swartz', 'Alexander Buyantuev', 'James Billings', 'Aaron Enfield', 'Ray Bromley', 'John Pipkin', 'Jackson LaSarso', 'Ewa Wdzieczak-Smering'];
const names = entries => `<ul class="contributors">${entries.map(name => `<li>${name}</li>`).join('')}</ul>`;
const notable = [
  ['Kate Stoneman', 'The first woman admitted to the New York State bar.', 'stoneman.jpg', 'Stoneman21.html', 'Portrait of Kate Stoneman'],
  ['Chester A. Arthur', 'The 21st president of the United States.', 'arthur.jpg', 'Arthur18.html', 'Portrait of Chester A. Arthur'],
  ['Erastus Corning II', 'Albany’s longest-serving mayor.', 'corning.jpg', 'Corning41.html', 'Erastus Corning II monument'],
  ['Soldiers’ Lot', 'The burial site of 149 Civil War soldiers.', 'soldiers.jpg', 'Soldier33.html', 'Graves in Soldiers’ Lot'],
];
const graveCards = notable.map(([name, description, photo, link, alt]) => `<article class="story-card"><a href="https://www.albany.edu/arce/${link}"><img src="assets/${photo}" alt="${alt}" loading="lazy"></a><h2><a href="https://www.albany.edu/arce/${link}">${name}</a></h2><p>${description}</p><a href="https://www.albany.edu/arce/${link}">Read biography →</a></article>`).join('');
pages.set('index.html', ['Albany Rural Cemetery Explorer', 'Albany Rural Cemetery Explorer', `
<section class="introduction"><div><h2>Albany Rural Cemetery</h2><p class="lead">Explore Albany history through the people buried here.</p></div><div><p>Incorporated in 1841, Albany Rural Cemetery is known for its monuments, family plots and park landscape. ARCE provides biographies, themed tours and burial searches.</p><p>Read the biographies from home or use the cemetery map during a visit.</p></div></section>
<section class="highlights"><h2>Explore the cemetery</h2><div class="grid"><section><h3>Tours &amp; biographies</h3><p>Explore African American history, artists, authors, Civil War stories and other themes.</p><a href="explore.html">Browse tours →</a></section><section><h3>Burials &amp; graves</h3><p>Search by name, or locate a section and lot or tier from a cemetery record.</p><a href="Locate_Burials&amp;Graves.html">Find a burial or grave →</a></section><section><h3>Using the tools</h3><p>Follow an illustrated guide to burial searches, tours and the map.</p><a href="help.html">Open the guides →</a></section></div></section>
<section><div class="section-heading"><h2>Notable graves</h2><a href="graves.html">Browse notable graves</a></div><div class="story-grid">${graveCards}</div></section>
<section class="project-band"><div><h2>About ARCE</h2><p>A collaboration between the University at Albany and Albany Rural Cemetery, funded by the Bender Family Foundation.</p><a href="about.html">Project contributors →</a></div><img src="assets/history-logos.jpg" alt="University at Albany and Albany Rural Cemetery project logos" loading="lazy"></section>`]);
pages.set('graves.html', ['Notable graves', 'Notable graves', `<p class="lead">Read about four of Albany Rural Cemetery’s notable burial sites.</p><div class="story-grid">${graveCards}</div><div class="actions">${action('app/?view=map&amp;tour=Notable', 'Open the Notables tour')}<a href="biolist.html">Browse all biographies</a></div>`]);
pages.set('explore.html', ['Tours and collections', 'Explore the cemetery', `<p class="lead">Choose a theme to see its places on the cemetery map.</p><div class="actions">${action('biolist.html', 'Browse biographies')}<a href="tutorial.html">Tour guide →</a></div><div class="tour-grid">${FAB_TOUR_DEFINITIONS.map(({key,name,kind}) => `<a class="tour-card" href="app/?view=map&amp;tour=${encodeURIComponent(key)}"><span class="eyebrow">${kind === 'tour' ? 'Tour' : 'Grave collection'}</span><h2>${escape(name.replace(' Tour 2020', '').replace(' 2020', ''))}</h2><span>Open on the map →</span></a>`).join('')}</div>${visit}`]);
pages.set('Locate_Burials&Graves.html', ['Locate burials and graves', 'Find a burial or grave', `<p class="lead">Search burial records in Albany Grave Finder by name, section, lot or tier.</p><div class="actions">${action(burial, 'Open Burial Locator')}</div><div class="grid"><section><h2>Search by name</h2><p>Enter all or part of a name. Add a location to narrow the results.</p><a href="Burial_Locator_tutorial.html">Illustrated name search guide →</a></section><section><h2>Search by location</h2><p>Enter the section, lot or tier from your cemetery record. You can search without a name.</p><a href="Grave_Finder_tutorial.html">Illustrated location search guide →</a></section></div>${visit}`]);
pages.set('offline.html', ['Before your visit', 'Before your visit', `<p class="lead">Open the map and find your destination before leaving.</p><h2>Connection</h2><p>The app needs an internet connection to load maps, burial records and biographies. It does not offer a full offline download. Save a screenshot of your destination and write down the section, lot or tier in case reception drops.</p><h2>Your location</h2><p>In Directions, <strong>Use my location</strong> updates your route as you move. Close directions or choose <strong>Stop following</strong> to end location updates.</p><p>To choose a starting point yourself, open <strong>From</strong> and select a place or <strong>Choose on map</strong>.</p><h2>At the cemetery</h2><p>Follow posted signs and check access on arrival. Routes follow mapped cemetery roads; they do not show current closures or confirm accessible paths.</p><p>${action(map, 'Open cemetery map')}</p>`]);
pages.set('help.html', ['Guides and help', 'Guides and help', `<ul class="link-list"><li><a href="Burial_Locator_tutorial.html">Search for a burial</a></li><li><a href="Grave_Finder_tutorial.html">Search by section, lot or tier</a></li><li><a href="tutorial.html">Follow a tour</a></li><li><a href="offline.html">Before your visit</a></li></ul><h2>No search results?</h2><p>Try a shorter name, another spelling or fewer location filters. For help finding a burial or correcting a cemetery record, contact <a href="https://albanyruralcemetery.org/">Albany Rural Cemetery</a>.</p><h2>Map or search not loading?</h2><p>Check your connection and reload. Select <strong>Try again</strong> if Burial Locator reports an error. After using location, the map shows cemetery roads and sections without the background tiles.</p><h2>Location blocked?</h2><p>Check Location Services and the browser or app’s location permission in your device settings. You can still choose a route start on the map or from the place list.</p><h2>App support</h2><p>Email <a href="mailto:geo.jrk1@gmail.com">geo.jrk1@gmail.com</a> with your device, what you tried and what happened. For a record issue, include the name and section, lot or tier.</p><p><a href="app/support.html">App help</a> · <a href="privacy.html">Privacy</a></p>`]);
pages.set('about.html', ['About the project', 'About ARCE', `<p class="lead">Albany Rural Cemetery Explorer brings together cemetery maps, burial records and biographies.</p><p>ARCE is a collaboration between the University at Albany’s Department of Geography and Planning and Albany Rural Cemetery, funded by the Bender Family Foundation.</p><h2>Contributing authors</h2>${names(authors)}<h2>Project contributors</h2>${names(contributors)}<p>Jackson LaSarso developed the Grave Finder and Burial Locator tools. Ewa Wdzieczak-Smering contributed to map design and app testing. The GIS Project Development class contributed the prototype’s concepts and design.</p><p><a href="about-project-history.html">Read the earlier contributor introductions →</a></p><h2>Maps and search</h2><p>Albany Grave Finder combines the cemetery map, tours and burial search. Search by name or location, select a burial and open its details on the map.</p><p><a href="help.html">Guides and help</a> · <a href="privacy.html">Privacy</a></p>`]);

pages.set('privacy.html', ['Privacy', 'Privacy', `<p class="lead">ARCE’s website and university-hosted tools are served by the University at Albany.</p><h2>Website requests</h2><p>The university receives web requests when you open pages, photographs and other files. Its <a href="https://albany.atlassian.net/wiki/spaces/askit/pages/52333006">internet privacy policy</a> explains how it handles website information.</p><h2>Maps and location</h2><p>The map tools also load content from map providers. Location access is optional and controlled by your browser or device. The <a href="app/privacy.html">Albany Grave Finder privacy policy</a> describes the app’s location controls, local search, saved settings and map providers.</p><h2>Links and support</h2><p>External links and maps apps have their own privacy policies. If you email support, your message includes your email address and the details you send.</p><p>For app support, email <a href="mailto:geo.jrk1@gmail.com">geo.jrk1@gmail.com</a>. For university website privacy questions, use the contact in the university policy.</p>`]);

// Retain the existing directory's names and descriptions.
const biographySource = await readFile('arce/biography-source.html', 'utf8');
const biographyLinks = JSON.parse(await readFile('arce/biography-links.json', 'utf8'));
const normalizeName = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
const directoryEntry = person => {
  const [name, ...details] = person.split(':');
  const link = biographyLinks[normalizeName(name)];
  return `${link ? `<a href="https://www.albany.edu/arce/${link}">${escape(name.trim())}</a>` : escape(name.trim())}${details.length ? `: ${escape(details.join(':').trim())}` : ''}`;
};
const groups = [];
for (const match of biographySource.matchAll(/<(h3|h5)[^>]*>([\s\S]*?)<\/\1>/gi)) {
  const content = match[2].replace(/<[^>]*>/g, '').replaceAll('&emsp;', ' ').replace(/\s+/g, ' ').trim();
  if (!content || /^[- ]+$/.test(content)) continue;
  if (match[1].toLowerCase() === 'h3') groups.push({ title: content, people: [] });
  else if (groups.length) groups.at(-1).people.push(content);
}
pages.set('biolist.html', ['Biography directory', 'Biography directory', `<p class="lead">Browse people and places by tour theme. Select a linked name to read the biography.</p><div class="actions">${action('explore.html', 'Open a tour')}<a href="graves.html">Notable graves</a></div><nav class="directory-nav" aria-label="Biography categories">${groups.map((group,i) => `<a href="#category-${i}">${escape(group.title.split(' - ')[0])}</a>`).join('')}</nav>${groups.map((group,i) => `<section class="directory-section" id="category-${i}"><h2>${escape(group.title)}</h2><ul>${group.people.map(person => `<li>${directoryEntry(person)}</li>`).join('')}</ul></section>`).join('')}`]);

const shots = JSON.parse(await readFile('arce/guide-shots.json', 'utf8'));
const illustratedGuide = (key, tool, url, items) => {
  const slides = items.map(([title, text], index) => {
    const { desktop, mobile } = shots[key][index];
    const variables = (rect, prefix) => rect.map((value,i) => `--${prefix}${['x','y','w','h'][i]}:${value}%`).join(';');
    return `<details class="guide-slide"><summary>${title}</summary><div class="guide-copy"><p>${text}</p></div><figure><div class="guide-image"><picture><source media="(max-width:600px)" srcset="assets/${mobile.image}" width="${mobile.width}" height="${mobile.height}"><img src="assets/${desktop.image}" alt="${tool}: ${escape(title)}" width="${desktop.width}" height="${desktop.height}" loading="lazy"></picture><span class="guide-highlight" style="${variables(desktop.rect,'')};${variables(mobile.rect,'m')}" aria-hidden="true"></span></div><figcaption><a class="guide-full-image" href="assets/${desktop.image}" data-desktop="assets/${desktop.image}" data-mobile="assets/${mobile.image}" target="_blank" rel="noopener">View full-size screenshot</a></figcaption></figure></details>`;
  }).join('');
  return `${key === 'burial' ? '' : `<div class="actions">${action(url, `Open ${tool}`)}</div>`}<section class="walkthrough" aria-label="Illustrated walkthrough"><div class="steps">${slides}</div></section>${visit}`;
};
pages.set('Burial_Locator_tutorial.html', ['Burial search guide', 'Search for a burial', `<p class="lead">Search by name or cemetery location.</p><div class="actions">${action('app/?view=burials&amp;tutorial=burial-search', 'Open Burial Locator')}</div><div id="static-guide">` + illustratedGuide('burial', 'Burial Locator', burial, [
  ['Enter a name', 'Use all or part of a name. Add a section, lot or tier if you need fewer matches.'],
  ['Select the burial', 'Check the section, lot or tier to distinguish people with the same name.'],
  ['Check the map', 'The marker shows the burial’s recorded location. <strong>Directions</strong> opens a route to it.'],
  ['Choose a route start', '<strong>Use my location</strong> updates the route as you move. Open <strong>From</strong> to choose another start.'],
]) + '</div>']);
pages.set('tutorial.html', ['Tour guide', 'Follow a tour', illustratedGuide('tour', 'Search Tours', 'app/?view=tours&amp;tutorial=burial-search', [
  ['Choose a tour', 'Tours and collections group graves by subject.'],
  ['Select a place', 'Open any name in the list or marker on the map.'],
  ['Read the biography', '<strong>Read biography</strong> opens the full ARCE biography.'],
  ['Move between stops', '<strong>Previous</strong> and <strong>Next</strong> move between stops. <strong>All places</strong> opens the list.'],
])]);
pages.set('Grave_Finder_tutorial.html', ['Location search guide', 'Search by section, lot or tier', illustratedGuide('grave', 'Burial Locator', 'app/?view=burials&amp;tutorial=burial-search', [
  ['Choose the location fields', 'Leave Name blank to search by location.'],
  ['Enter the location', 'You only need one of these fields. Use the location on your cemetery record.'],
  ['Select a burial', 'Select a name from the results to see its burial location.'],
  ['Open the grave on the map', 'Choose <strong>Directions</strong> to plan a route.'],
])]);

const navigation = `<a href="explore.html">Explore</a><a href="graves.html">Notable graves</a><a href="biolist.html">Biographies</a><a href="Locate_Burials&amp;Graves.html">Find a grave</a><a href="help.html">Guides</a><a href="about.html">About</a><a href="${map}">Open map ↗</a>`;
const document = (title, heading, body) => {
  const home = title === 'Albany Rural Cemetery Explorer';
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${title} · ARCE</title><link rel="stylesheet" href="arce-launch.css"><script src="arce-guide.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="index.html"><strong>ARCE:</strong><span>Albany Rural Cemetery Explorer</span></a><nav class="desktop-navigation" aria-label="Main">${navigation}</nav><details class="mobile-navigation"><summary>Menu</summary><nav aria-label="Main">${navigation}</nav></details></header>${home ? `<section class="site-hero"><p>Albany Rural Cemetery · Incorporated 1841</p><h1>${heading}</h1><p>Biographies, tours and burial records</p><div class="actions">${action('explore.html', 'Explore the cemetery')}<a class="action secondary" href="Locate_Burials&amp;Graves.html">Find a burial or grave</a></div></section>` : ''}<main id="main" class="${home ? 'home' : ''}">${home ? '' : `<div class="page-intro"><h1>${heading}</h1></div>`}${body}</main><footer><p>A collaboration of Geography and Planning, University at Albany, and Albany Rural Cemetery.<br>Funded by the Bender Family Foundation.</p><p><a href="help.html">Help</a> · <a href="privacy.html">Privacy</a> · <a href="about-project-history.html">Project history</a></p></footer></body></html>\n`;
};
await mkdir('arce/pages', { recursive: true });
for (const [file, args] of pages) await writeFile(`arce/pages/${file}`, document(...args));
console.log(`Built ${pages.size} ARCE pages.`);
