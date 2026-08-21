# Unified web/native stack

## Implemented web contract

FAB now owns one React/Vite/MapLibre product with canonical `tours`, `map`, and
`burials` routes. `embed=fabfg` removes web navigation when a native shell owns
the tabs. Search, tour, map, and record selection use the same URL contract.

The old CRA/Leaflet/MUI shell, local ortho export pipeline, GeoParquet build
branch, renderer adapters, field-packet authoring UI, and client-side cemetery
road router are no longer part of the runtime.

## FABFG follow-up

The native repository must map its three hosted destinations to:

- `tours`: `https://lasarsojackson.github.io/fab/?view=tours&embed=fabfg`
- `home`: `https://lasarsojackson.github.io/fab/?view=map&embed=fabfg`
- `burials`: `https://lasarsojackson.github.io/fab/?view=burials&embed=fabfg`

That change belongs in FABFG’s URL constants and URL-contract tests. Rename the
native `ARCE` tab and its hosted title to `Cemetery Map` so both shells use the
same three destination names. Keep the ARCE website as a separate external
action. Do not embed a second route model or duplicate the web navigation.

## Acceptance boundary

Repository tests can prove the web route contract and embedded rendering. They
cannot prove the live GitHub Pages deployment, the institutional Albany host,
or an installed iPhone WebView until those surfaces are updated and exercised.

## Future work must be evidence-led

Potential improvements—self-hosted vector basemaps, a different tile provider,
or a smaller binary search artifact—need measurements, provider terms, and a
clear user benefit. They are not prerequisites for the current architecture.
