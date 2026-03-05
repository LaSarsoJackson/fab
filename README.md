# Albany Rural Cemetery Burial Finder (`fab`)

Modernized map-first PWA for searching Albany Rural Cemetery burial records, viewing tours, and getting on-site walking directions.

Live app: [https://lasarsojackson.github.io/fab/](https://lasarsojackson.github.io/fab/)  
Legacy reference: [https://www.albany.edu/arce/](https://www.albany.edu/arce/)

## Stack

- Runtime/build: `Vite` (CRA removed)
- Package manager: `Bun` first (`packageManager: bun@1.3.8`)
- Framework: `React + Leaflet + MUI`
- Tests: `bun test`

## 5-minute local setup

```bash
# 1) enter project
cd fab

# 2) install deps
bun install

# 3) configure env
cp .env.example .env
# then set VITE_GRAPHHOPPER_API_KEY

# 4) run app
bun run start
```

Open [http://localhost:5173](http://localhost:5173)

## npm fallback

```bash
npm install
npm run start
```

## Commands

```bash
bun run start    # dev server
bun run build    # production bundle -> dist/
bun run preview  # preview build
bun test         # unit tests
bun run deploy   # publish dist/ to GitHub Pages
```

## Environment variables

Required:

```bash
VITE_GRAPHHOPPER_API_KEY=your_key_here
```

Optional:

```bash
VITE_BASE_PATH=/fab/
VITE_DATA_BASE_URL=https://example.com/fab-data
# optional explicit burial source:
# VITE_BURIAL_DATA_URL=https://example.com/fab-data/Geo_Burials.json
```

## Deep links

- `?view=burials`
- `?view=tours`
- `?section=<value>`
- `?tour=<name fragment>`
- `?q=<search text>`

## Project map

- App shell: `src/App.js`
- Main map + UX: `src/Map.jsx`
- Search logic: `src/lib/burialSearch.js`
- URL/deep-link parsing: `src/lib/urlState.js`
- PWA registration: `src/registerServiceWorker.js`

## Troubleshooting

- If install appears stalled, stop it and retry with `bun install`.
- If you used npm and installs became inconsistent, remove `node_modules` and reinstall with one tool only.
- If routing fails, verify `VITE_GRAPHHOPPER_API_KEY` is set.
