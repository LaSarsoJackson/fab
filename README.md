# Albany Rural Cemetery Grave Finder

Find a burial, locate it on the cemetery map, or explore Albany Rural Cemetery through a curated tour. The app combines burial records with cemetery roads, sections, and historic information.

[Open the map](https://lasarsojackson.github.io/fab/) · [Search burial records](https://lasarsojackson.github.io/fab/?view=burials) · [Browse tours](https://lasarsojackson.github.io/fab/?view=tours)

## Using the app

**Cemetery Map** opens by default. Select a section or a grave to see its location. **Burial Locator** searches the burial index. **Search Tours** opens curated stops with their history and map locations.

The terrain map uses Esri World Hillshade, with OpenStreetMap Streets available as another basemap. Cemetery roads, sections, and selected graves appear above it. Map attribution remains visible in the app.

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

The [FABFG repository](https://github.com/LaSarsoJackson/FABFG) contains the native mobile app that displays these hosted pages. Its embedded routes use `embed=fabfg` so the mobile app supplies the navigation. See the [routing guide](docs/routing-architecture.md) for URL parameters and deep links.

## Hosting

The web app is published to GitHub Pages from `main` after its checks pass. Moving it to the Albany Rural Cemetery Explorer site requires a separate institutional deployment. Native app releases are managed in FABFG.
