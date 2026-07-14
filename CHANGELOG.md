# Changelog

All notable production-facing changes to FAB should be recorded here. The
project follows [Semantic Versioning](https://semver.org/) for app and data
contract releases.

## [Unreleased]

## [0.2.0] - 2026-07-13

- Added labelled cemetery sections, tiled aerial and hillshade basemaps, and
  clearer route distance and time presentation.
- Reworked shared burial locations so one plot marker opens a responsive place
  card with the people at that plot, portraits, biographies, and directions on
  both desktop and mobile.
- Improved search and browse performance, map failure recovery, mobile sheet
  accessibility, and large-plot rendering behavior.
- Tightened tour biography matching so a portrait or biography cannot be
  copied to a different person who happens to share a name or plot.
- Added broader map, browse, search worker, runtime, release, and branch
  pipeline validation.
- Updated the PWA cache generation so existing installations discard stale
  search and basemap responses when upgrading.

## [0.1.0] - 2026-06-12

- Established the current FAB web app baseline for search, section browse,
  tours, routing, deep links, PWA metadata, and GitHub Pages deployment.
