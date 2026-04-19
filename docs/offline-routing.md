# Offline Routing

This repo supports a development-only offline routing mode backed by a local
Valhalla instance.

The app has three routing providers:

- `api`: hosted Valhalla HTTP API
- `local`: bundled in-browser road graph from `src/data/ARC_Roads.json`
- `valhalla`: local Valhalla over a same-origin dev proxy

The `valhalla` mode is useful when you want OSM-backed routing without an
internet dependency during route calculation. The app still snaps burial
destinations to the bundled cemetery road network first, so the local FAB road
geometry remains part of the route flow.

## Start local Valhalla

Requirements:

- Docker

Bootstrap and start the container:

```bash
bun run routing:offline:start
```

Defaults:

- container name: `fab-valhalla`
- service URL: `http://127.0.0.1:8002`
- cached data dir: `${XDG_CACHE_HOME:-$HOME/.cache}/fab/valhalla`
- OSM extract: `https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf`

The startup script uses the official scripted Valhalla image and persists the
downloaded OSM extract plus built tiles in the mapped host directory, so later
restarts can run offline from that local cache.

Stop it with:

```bash
bun run routing:offline:stop
```

## App config

Add these to `.env` for local/offline Valhalla:

```bash
REACT_APP_DEV_ROUTING_PROVIDER=valhalla
FAB_VALHALLA_ORIGIN=http://127.0.0.1:8002
REACT_APP_VALHALLA_PROXY_PATH=/__valhalla
```

Then run:

```bash
bun run start
```

The React dev server proxies `/__valhalla/*` to the local Valhalla service, so
the browser can call the offline router without CORS setup.

## Overrides

Useful environment overrides for `bun run routing:offline:start`:

- `FAB_VALHALLA_TILE_URL`: alternate OSM PBF URL
- `FAB_VALHALLA_DATA_DIR`: alternate persistent host directory
- `FAB_VALHALLA_PORT`: alternate host port
- `FAB_VALHALLA_CONTAINER_NAME`: alternate Docker container name
- `FAB_VALHALLA_THREADS`: thread count passed to the container

## Notes

- First boot can take a while because Valhalla has to download the extract and
  build tiles.
- `local` and `valhalla` are intended as development-time routing overrides.
  Production builds fall back to the hosted `api` provider.
