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

External directions are built in [`src/shared/routing.js`](../src/shared/routing.js).
Apple platforms open Apple Maps; Android and other platforms use Google Maps.
FAB does not maintain a second client-side routing engine over cemetery roads.

Changing a parameter or its meaning is a shared web/native contract change and
requires both browser and wrapper acceptance.
