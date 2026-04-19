# Map Engine Runtime Ownership

Use this note when working on custom-runtime parity or when deciding whether a
behavior belongs in FAB's engine boundary versus a Leaflet adapter.

## Why This Exists

The current custom runtime is not blocked on "more rendering code" in the
abstract. It is blocked on a concrete set of runtime responsibilities that
Leaflet and MapLibre already prove out in their own source trees.

If FAB wants to say it owns its map engine, these behaviors need to be owned by
our runtime contract and implementation, not left as accidental side effects of
provider DOM or plugin behavior.

## Public Behavior Review

This note should be read as a clean-room behavior document.

Behavioral alignment sources:

- [Leaflet 1.9 reference](https://leafletjs.com/reference.html)
- [Leaflet 2.0 reference](https://leafletjs.com/reference-2.0.0.html)

The important takeaway is not "copy upstream internals." The takeaway is that
public map engines expose the same categories of responsibility:

- camera math and constraints
- popup lifecycle and viewport correction
- hit testing and hover/click dispatch
- gesture handling
- render scheduling and tile coverage

## Functions FAB Must Own

### 1. Camera Solvers

Leaflet public reference concepts:

- `setView`
- `flyTo`
- `fitBounds`
- `panInside`
- `invalidateSize`
- `stop`

FAB runtime ownership means:

- fitting bounds with padding and max-zoom limits
- zooming around a pointer/screen anchor instead of only map center
- keeping selected content in view without leaking provider methods into app UI
- resizing without selection drift or stale popup anchoring
- interrupting camera animation cleanly when new input arrives

This work belongs in the engine because every selection flow depends on it:
section selection, tour stop selection, popup opening, and deep-link restore.

### 2. Popup Lifecycle And Autopan

Leaflet public reference concepts:

- popup `autoPan` behavior
- popup padding options such as `autoPanPaddingTopLeft` and `autoPanPaddingBottomRight`
- popup lifecycle events such as `popupopen` and `popupclose`
- popup `update()` behavior after content or layout changes

FAB runtime ownership means:

- opening a popup from runtime state, not provider-specific side effects
- recomputing popup position on move, zoom, resize, and content changes
- auto-panning the camera so popup chrome stays inside the viewport
- respecting app-specific offsets for desktop sidebar and mobile sheet layouts
- keeping popup close/open events consistent across runtimes

Popup behavior should not depend on Leaflet internals remaining in the loop.

### 3. Hit Testing, Hover, And Click Dispatch

Leaflet public reference concepts:

- layer interactivity
- map and layer pointer/mouse events
- circle marker hit areas
- renderer-backed vector interaction

FAB runtime ownership means:

- a renderer-owned picking pass for polygons, markers, and clustered points
- hover state that clears because the runtime knows the pointer target changed
- click dispatch that identifies records and sections directly from runtime data
- selection highlighting that does not depend on replacing DOM nodes under the pointer

This is exactly the category behind the sticky-hover class of bugs. Hover must
be derived from runtime picking, not DOM quirks.

### 4. Gesture Handlers

Leaflet public reference concepts:

- drag panning
- scroll-wheel and trackpad zoom
- zoom controls
- map movement and zoom lifecycle events

FAB runtime ownership means:

- drag pan with interruption and optional inertia
- wheel/trackpad zoom normalization with debouncing
- zoom-around-pointer behavior
- gesture state that clears hover and popup affordances when input changes
- a single place to define desktop versus touch interaction rules

This is not optional plumbing. It is the interaction core of the engine.

### 5. Render Scheduling And Tile Coverage

Leaflet public reference concepts:

- raster tile coverage during zoom and pan
- vector renderer redraw behavior
- stable visual output across camera changes

FAB runtime ownership means:

- redraw only the layers and bounds that changed
- clip drawing work to the invalidated viewport region
- keep raster tile coverage stable during fractional zoom and animation
- avoid full rerenders for selection-only state changes

This is where "custom runtime feels unfinished" turns into "custom runtime
stays smooth under normal interaction."

## What Should Stay Adapter-Backed For Now

These still reasonably sit outside the custom runtime core even though the
user-facing flows are now validated in both runtimes:

- Valhalla service wiring and local road-routing integration
- browser geolocation workflows and device permission handling
- admin authoring/editing tools

Those are app integrations. The five ownership areas above are core engine work.

## Immediate FAB Follow-Through

When touching runtime parity next, prioritize this order:

1. popup layout/autopan parity
2. shared picking API for polygons and points
3. gesture parity for wheel, drag, and interruption
4. layer click-to-zoom and cluster zoom behavior
5. redraw/tile coverage optimization

If a change does not strengthen one of those ownership areas, it is probably
adapter churn rather than engine progress.
