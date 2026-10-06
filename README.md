# Albany Rural Cemetery Grave Finder

Find a burial, locate it on the cemetery map, or explore Albany Rural Cemetery through a curated tour. The app combines burial records with cemetery roads, sections, and historic information.

[Open the map](https://lasarsojackson.github.io/fab/) · [Search burial records](https://lasarsojackson.github.io/fab/?view=burials) · [Browse tours](https://lasarsojackson.github.io/fab/?view=tours)

![Albany Grave Finder directions on a desktop-width screen](docs/assets/screenshots/claude-ui-desktop.png)

![Albany Grave Finder directions on a phone-width screen](docs/assets/screenshots/claude-ui-mobile.png)

Screenshots use a synthetic location for development.

## Using the app

**Cemetery Map** opens by default. Select a section or a grave to see its location. **Burial Locator** searches the burial index. **Search Tours** opens curated stops with their history and map locations.

Burial Locator accepts a name, section, lot, or tier in any combination. Lot and
tier filters match whole identifiers, including letters and punctuation. **Show more results** makes
later matches available in groups of 80. Search filters stay in the URL when you
reload or open a grave and return to the locator.

The terrain map uses Esri World Hillshade, with OpenStreetMap Streets available as another basemap. Cemetery roads, sections, and selected graves appear above it. Map attribution remains visible in the app.

## Directions on site

Choose **Directions** on a selected grave or the map. The **From** and **To**
rows open choices for a location fix, a map point, or a mapped place from a list.
**Start from my location** uses one fix; **Follow my location** updates the road
route as you move. **Stop following** ends those updates. Using location switches
the map to bundled local data and stops requests to external tile providers until
the app reloads. The app also stops its location watch when the map is hidden.
Position fixes stay on the device unless you choose **Open in Maps**.

Routes use the bundled cemetery-road data. Dashed connectors show gaps to those
roads, not mapped paths. Check signs and access on site; the app does not confirm
closures, path conditions, or accessible routes. Keyboard users can choose a
place from the list or pan the map and confirm its crosshair point.

## Run locally

Use Node.js 22.12 or newer and Bun. The pinned Bun version is in `package.json`.

```bash
bun install
bun run doctor
bun run start
```

Open [localhost:5173/fab](http://localhost:5173/fab/). The app uses React, Vite, and MapLibre GL JS. It does not need a backend or a geospatial Python environment.

## Data and maps

Burial records are stored in [`src/data/Geo_Burials.json`](src/data/Geo_Burials.json). The browser searches a smaller generated index in a Web Worker. Roads, sections, and the cemetery boundary use the GeoJSON files in `src/data/`.

After updating source records or tour data, regenerate the browser files:

```bash
bun run build:data
```

See [Contributing](CONTRIBUTING.md) for data checks and [Cartography](docs/cartography.md) for the map design and attribution.

## Development

```bash
bun run lint
bun run test
bun run build
bun run test:e2e
```

`bun run check` runs the local release checks. The [architecture guide](docs/architecture-index.md) covers the map, search, tours, and shared links.

Shared links use `q`, `section`, `lot`, `tier`, `tour`, and `record`. Old packed `share` links remain readable; new links identify canonical records.

The [FABFG repository](https://github.com/LaSarsoJackson/FABFG) contains the native mobile app that displays these hosted pages. Its embedded routes use `embed=fabfg` so the mobile app supplies the navigation. See the [routing guide](docs/routing-architecture.md) for URL parameters and deep links.

## Hosting

The web app is published to GitHub Pages from `main` after its checks pass. Moving it to the Albany Rural Cemetery Explorer site requires a separate institutional deployment. Native app releases are managed in FABFG.

The ARCE website source and current visitor guides are under `arce/`.
`bun run build:arce` prepares the website at `/arce/dev/` and the app at
`/arce/dev/app/`, with a file manifest. The app returns to the matching website
in the same tab. Run `bun run check:arce` and `bun run test:arce` before publishing.
Use the explicit `production` target for a later `/arce/` package. See the
[ARCE upload procedure](docs/arce-upload-instructions.md) for backups, upload
order, preservation of existing biographies and Grave Finder, and rollback.
