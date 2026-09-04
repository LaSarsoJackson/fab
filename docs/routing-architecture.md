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

New share links use `record`; do not create new packed field packets.

FABFG should load the three canonical routes with `embed=fabfg`. The native
shell owns its tabs; embedded FAB owns content and route behavior.

When an embedded user action changes destinations, FAB posts a versioned native
message after updating the browser URL:

```json
{"type":"fab.route-change.v1","view":"map","url":"https://lasarsojackson.github.io/fab/?view=map&embed=fabfg&tour=Notable"}
```

The `url` is the complete route and remains the source of truth. FABFG validates
the hosted origin, `/fab/` path, `embed=fabfg`, and matching `view`, then changes
the visible native tab without reconstructing query parameters. Initial loads
do not post messages. Browser `popstate` events post the route that the WebView
has already displayed so the native shell can persist Back navigation without
reloading that WebView.

External directions are built in [`src/shared/routing.js`](../src/shared/routing.js).
Apple platforms open Apple Maps; Android and other platforms use Google Maps.
FAB does not compute a walking line from `ARC_Roads.json`. That file describes
road geometry but does not establish pedestrian access, crossings, closures, or
a reviewed visit order. A shortest-path result would look authoritative without
being trustworthy.

Tour place-to-place navigation stays local and URL-backed: selecting a place
updates `record`, Previous and Next move through the bundled place list, and All
places returns to the tour overview. Explicit `kind: "tour"` definitions use a
deterministic nearest-neighbor visit order anchored at the source first stop;
`kind: "collection"` definitions stay source-ordered. This is a simple visit
ordering aid, not a reviewed pedestrian route or a safety/distance claim.
Collections do not get ordinal or Previous and Next controls. The last selected
tour and place are stored as the small versioned record `fab.tour-progress.v1`;
the URL remains the shareable source of truth.

## Reviewed walking routes

Do not infer pedestrian geometry, crossings, accessibility, or safety from the
proximity order. When ARCE supplies a reviewed route, add the smallest durable
data to the existing tour definition:

- an explicit ordered list of stable record IDs
- optionally, one reviewed GeoJSON `LineString` for the intended walk

MapLibre can render that local line directly. It does not require a routing
service, graph cache, worker, or new runtime dependency. Until those facts are
curated, FAB should show every place and provide Previous, Next, and
device-navigation actions without drawing a false route line.

Changing a parameter or its meaning is a shared web/native contract change and
requires both browser and wrapper acceptance.
