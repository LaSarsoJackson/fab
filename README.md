# Albany Rural Cemetery Burial Finder (`fab`)

Installable map-first PWA for finding burials, touring sites, and navigating on location at Albany Rural Cemetery.

Live target: [https://lasarsojackson.github.io/fab/](https://lasarsojackson.github.io/fab/)  
Legacy reference: [https://www.albany.edu/arce/](https://www.albany.edu/arce/)

## Modernization status

- Bun-first package management (`bun.lock`, `packageManager: bun@1.3.8`)
- npm fallback stabilized (`.npmrc` sets `legacy-peer-deps=true`)
- Async loading of the 97k-record burial dataset
- Deferred, indexed search model for faster query response
- Utility extraction for core business logic:
  - `src/lib/burialSearch.js`
  - `src/lib/urlState.js`
- PWA shell + install/offline indicators + deep links

## Deep links

- `?view=burials`
- `?view=tours`
- `?section=<value>`
- `?tour=<name fragment>`
- `?q=<search text>`

## Content alignment with ARCE legacy site

See: `docs/arce-content-upgrade-plan.md`

## Prerequisites

- Bun `>= 1.3`
- Node `>= 20` (see `.nvmrc`)
- Optional GraphHopper key in `.env`:
  - `REACT_APP_GRAPHHOPPER_API_KEY=...`

## Install

```bash
bun install
```

npm fallback:

```bash
npm install
```

## Run

```bash
bun run start
```

## Test

```bash
bun test
```

## Build

```bash
bun run build
```

## Deploy (GitHub Pages)

```bash
bun run deploy
```
