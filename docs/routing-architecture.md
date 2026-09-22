# Routing architecture

FAB is a static app, so the query string is the public route contract.
Missing or unrecognized `view` values open Cemetery Map. Explicit destination
links, including `view=tours`, retain their destination.

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
Cemetery routes are computed in the browser from `ARC_Roads.json`. That file
describes road geometry; it does not establish current access, closures, or a
reviewed tour order. External Maps directions remain available.

Tour place-to-place navigation stays local and URL-backed. Selecting a place
updates `record`. Previous and Next move through the bundled place list, and All
places returns to the tour overview. A `tour` uses a deterministic proximity
order anchored at its first source record. A `collection` stays in source order
and does not get numbers or Previous and Next controls. The order is a browsing
aid, not a pedestrian route or a safety claim. The app stores the last selected
tour and place in `fab.tour-progress.v1`. The URL remains the shareable source
of truth.

## Local cemetery routes

`mapRouting.js` builds a graph on first use from the bundled cemetery roads.
It joins shared vertices and export gaps of at most one metre. It does not join
arbitrary crossings or bridge disconnected roads. Each calculation adds temporary
start/end nodes on the nearest road segments and finds the shortest road path.
The shared graph is unchanged. No routing service, API key, or new dependency is
required. This does not make provider map tiles available offline.

Route here opens a plan for the selected grave. Plan route lets visitors choose
both endpoints. Start can come from a fresh GPS fix or an explicit map-pick mode;
the destination can also be changed on the map. Normal taps keep their section
and grave-selection behavior outside the planner. Closing removes the route and
returns to the selected record. Choosing another record or section clears the
old plan. Route coordinates stay in memory, outside URLs and stored preferences.

GPS fixes older than one minute or less accurate than 100 metres are rejected.
The start must be within 100 metres of the roads and the destination within 150
metres. A route is a preview from the chosen fix; Use my location refreshes it.
The blue solid line follows roads. Dashed endpoint gaps are shown separately and
are not described as mapped paths. Distances report road length separately from
the final gap to the destination. The panel asks visitors to check access on site.

`useLocalRouting.js` owns draft endpoints, asynchronous loading, GPS requests,
and cancellation. `MapView.jsx` owns map picking and source/layer updates;
`RoutePanel.jsx` supplies the controls. Old GPS callbacks and route calculations
cannot overwrite a later selection or reopen a closed plan.

Changing a public URL parameter remains a shared web/native contract change.
Local route planning adds no URL parameter or native bridge message.
