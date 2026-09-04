# Routing architecture

FAB is a static app, so the query string is the public route contract.

[`src/app/routes.js`](../src/app/routes.js) owns destination parsing and URL
updates. `src/App.jsx` decides when a user action changes that route.

## Parameters

- `view=tours|map|burials`
- `q=<name query>`
- `section=<section>`
- `tour=<tour key>`
- `record=<burial or tour record id>`
- `embed=fabfg`
- legacy `share=<packed selection>` for backward-compatible reads only

New share links use `record`. Do not create new packed field packets.

Load the three canonical routes in FABFG with `embed=fabfg`. The native shell
owns its tabs. Embedded FAB owns content and route behavior.

After an embedded route change, FAB posts the complete URL to the native shell:

```json
{"type":"fab.route-change.v1","view":"map","url":"https://lasarsojackson.github.io/fab/?view=map&embed=fabfg&tour=Notable"}
```

FABFG checks the host, `/fab/` path, `embed=fabfg`, and matching `view`, then
opens the destination tab with that URL. Same-tab changes persist in Expo Router
without reloading the WebView. Browser Back posts the restored route as well.
Initial loads do not post messages. Home clears the current tab's saved URL.

FABFG supports iOS. Browser tests cover the hosted contract; an installed
iPhone and iPad must also verify tab changes, Back, Home, Retry, location
permission, and external links before a native release.

External directions are built in [`src/shared/routing.js`](../src/shared/routing.js).
Apple platforms open Apple Maps. Android and other platforms use Google Maps.
FAB does not compute a walking line from `ARC_Roads.json`. That file describes
road geometry but does not establish pedestrian access, crossings, closures, or
a reviewed visit order. A shortest-path result would look authoritative without
being trustworthy.

Tour place-to-place navigation stays local and URL-backed. Selecting a place
updates `record`. Previous and Next move through the bundled place list, and All
places returns to the tour overview. A `tour` uses a deterministic proximity
order anchored at its first source record. A `collection` stays in source order
and does not get numbers or Previous and Next controls. The order is a browsing
aid, not a pedestrian route or a safety claim. The app stores the last selected
tour and place in `fab.tour-progress.v1`. The URL remains the shareable source
of truth.

## Reviewed walking routes

Do not infer pedestrian geometry, crossings, accessibility, or safety from the
proximity order. When ARCE supplies a reviewed route, add the smallest durable
data to the existing tour definition:

- an explicit ordered list of stable record IDs
- optionally, one reviewed GeoJSON `LineString` for the intended walk

MapLibre can render that local line directly. It does not require a routing
service, graph cache, worker, or new runtime dependency. Until ARCE supplies
those facts, FAB shows every place and provides Previous, Next, and
device-navigation actions without drawing a route line.

Changing a parameter or its meaning is a shared web/native contract change and
requires both browser and wrapper acceptance.
