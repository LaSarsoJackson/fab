# Changelog

Record all notable production-facing changes to FAB here. The
project follows [Semantic Versioning](https://semver.org/) for app and data
contract releases.

## [Unreleased]

## [0.2.1] - 2026-07-13

- Fixed shared-plot selection on phones by replacing the clipped horizontal
  person rail with a searchable, vertically scrolling picker.
- Separated sheet-resize gestures from list scrolling.
- Finger swipes now move through people without dragging the bottom sheet.
- Kept compact selected-plot sheets attached to the bottom with the map,
  marker, directions, and record details visible on short screens.
- Kept manually adjusted map views stable while live on-site routes refresh.
- Opened external Maps directly from the trusted Navigate action so desktop
  browsers do not silently block the directions tab.

## [0.2.0] - 2026-07-13

- Added labelled cemetery sections, tiled aerial and hillshade basemaps, and
  clearer route distance and time presentation.
- Reworked shared burial locations so one plot marker opens a responsive place
  card.
- The card shows people, portraits, biographies, and directions on desktop and
  mobile devices.
- Improved search and browse performance, map failure recovery, mobile sheet
  accessibility, and large-plot rendering behavior.
- Tightened tour biography matching.
- The app cannot copy a portrait or biography to a different person with the
  same name or plot.
- Added broader map, browse, search worker, runtime, release, and branch
  pipeline validation.
- Updated the PWA cache generation so existing installations discard stale
  search and basemap responses when upgrading.

## [0.1.0] - 2026-06-12

- Established the FAB web app baseline.
- The baseline includes search, section browse, tours, routing, deep links,
  PWA metadata, and GitHub Pages deployment.
