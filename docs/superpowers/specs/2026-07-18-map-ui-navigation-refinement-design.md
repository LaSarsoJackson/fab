# FAB map UI and navigation refinement design

**Date:** 2026-07-18
**Status:** Approved for implementation planning

## Purpose

Refine the shipped FAB map around its primary job: help a visitor find a burial, understand the mapped location, and start navigation with as little friction as possible. Tours and section browsing remain important secondary paths. The work should feel closer to Apple Maps without copying it mechanically: clear hierarchy, direct actions, comfortable touch targets, restrained motion, and plain language.

This is an interaction refinement, not a routing rewrite or visual rebrand. It preserves the current Leaflet map, selection reducer, deep-link contract, mobile bottom sheet, local cemetery-road routing, and external Maps handoff.

## Evidence from the current app

The design is based on a live review of the local app at desktop and 390×844 mobile viewports, plus the repository's UI, map, routing, and maintainability notes.

- The mobile selected-location flow is already strong: Back to results, plot context, person selection, a primary Navigate action, and progressive Details disclosure.
- Desktop selection repeats the same active burial, location, and actions in the sidebar and a full map popup. The duplication obscures the map and creates two competing action surfaces.
- Search cards repeat section, lot, and tier metadata in both an eyebrow and the location line.
- More is always rendered even when every menu item is disabled, producing a dead end on common desktop and mobile browser states.
- Some user-facing text sounds promotional or abstract, including "Loading map experience…", "Preparing fast search…", and "Send someone straight to this selection and map view."
- Search and map performance already use appropriate safeguards: worker-backed searching, result paging, `content-visibility`, idle loading, memoized map layers, and bounded rendering. There is no evidence for a broad performance rewrite.

## Goals

1. Make search-to-navigation the clearest path while preserving Tours and Sections as visible browse choices.
2. Give each viewport one authoritative selected-record surface.
3. Remove inert controls and duplicate metadata.
4. Make routing, loading, offline, and unavailable states brief and concrete.
5. Improve touch, focus, typography, surface, and motion details using the existing design tokens.
6. Preserve existing selection, route, URL, data, and native-wrapper contracts.
7. Verify desktop and mobile behavior through unit, DOM, and browser tests.

## Non-goals

- No new Find/Explore navigation system or tab architecture.
- No React, MUI, Leaflet, or build-tool migration.
- No change to public query keys, packed share payloads, burial data, or tour definitions.
- No change to the decision between external driving directions and on-site road routing.
- No new animation or UI dependency.
- No broad refactor of `Map.jsx` or `BurialSidebar.jsx` beyond the ownership seams required by this work.

## Interaction model

### Default and browse states

The map remains the primary surface. Search is the first control in both layouts. Tours and Sections remain directly available below it when no query or selected place owns the surface. Query results continue to replace those browse shortcuts on mobile so the sheet stays focused.

Result cards use one hierarchy:

1. person or place name;
2. one complete plot line using middle-dot separators;
3. life dates or the most useful supporting detail.

Ordinary burial results do not repeat the plot in an eyebrow. A tour result may retain a small tour-context label when that context distinguishes the item.

### Desktop selection

When the desktop sidebar is visible, it is the authoritative place for selected-record details and actions. The map popup switches to a compact spatial-context presentation containing only the active record name, plot summary, and shared-marker count when relevant. It does not repeat Navigate, Close, biographies, detail rows, or the person selector.

When the sidebar is collapsed, the popup returns to its existing full presentation so the map remains independently usable. The full popup retains the stack selector, details, Navigate, and Close behavior.

Search, section, tour, marker, and restored-link selections continue to update the same selection reducer. Popup presentation changes based only on viewport and sidebar visibility; it does not create a second selection state.

### Mobile selection

The existing place-focused bottom-sheet flow remains the authoritative mobile record surface:

`Back to results → plot heading → person selector when needed → active person → Navigate / Details`

The map shows the selected marker and plot count without opening a competing record popup. Details remain progressive disclosure below the primary action row. Safe-area behavior, adaptive snap points, dedicated header dragging, and list scrolling remain unchanged.

### Navigation

Navigate remains the public action label, matching the existing product contract.

- If a precise current location is near the cemetery road graph, Navigate starts the bundled on-site route.
- Otherwise, Navigate opens external driving directions synchronously from the trusted click, saves the destination, and keeps watching for arrival.
- Returning near the cemetery starts on-site navigation using the saved destination.
- Stopping an active route continues to use the same Navigate/stop behavior and selection state.

Status messages use direct language:

- `Opening driving directions…`
- `On-site navigation will start when you arrive.`
- `Starting on-site route…`
- `Calculating route…`
- `On-site route unavailable. Opening driving directions…`
- `Directions aren’t available for this record.`

These messages use the existing live route/status surfaces. No modal confirmation is added.

## Utility menu behavior

The More control appears only when the menu contains at least one enabled command. Commands may include:

- Copy share link when a selection or saved packet can be shared.
- Clear saved share details when those details exist.
- Install on this device when a live install prompt is available.

Installed state, unavailable installation, and iOS Add to Home Screen instructions are not disabled menu items. They belong in the relevant share/install notice, where explanatory text is useful. If no command is available, the More button is omitted on desktop and mobile and the remaining header controls keep their alignment.

Menu availability is derived by a pure presentation helper. `Map.jsx` still owns install, packet, and selection state and renders the MUI menu; `BurialSidebar.jsx` only receives whether an actionable utility control should be shown and the existing open-menu callback.

## Component and ownership design

### `src/Map.jsx`

- Keep selection, route, viewport, deep-link, install, and share state ownership.
- Derive popup presentation mode from `isMobile` and `isSearchPanelVisible`.
- Derive actionable utility commands and pass menu visibility to the sidebar.
- Preserve the current external Maps handoff and local-road routing logic.

### `src/features/map/popupCardContent.jsx`

- Add an explicit compact record-context presentation.
- Keep the current full card and stacked-record presentations intact.
- Ensure compact content has a useful accessible label and no duplicated action buttons.

### `src/BurialSidebar.jsx`

- Continue composing desktop and mobile browse/selection surfaces.
- Render desktop and mobile More controls only when an actionable menu exists.
- Keep mobile place mode unchanged except for approved copy and visual-detail adjustments.

### Existing pure presentation owners

- `src/features/browse/sidebarPresentation.js` owns utility-menu availability, search/status copy, and sidebar presentation decisions.
- `src/features/browse/browseResultPresentation.js` and the existing browse-result helpers own the non-duplicated result-card hierarchy.
- `src/features/map/mapViewHelpers.js` owns pure popup-mode selection if a helper is needed outside React.
- `src/features/fab/profile.js` remains the source for FAB shell/loading and location-message defaults.
- `src/index.css` remains the owner for shared map, sidebar, popup, focus, motion, and responsive styling.

No new barrel module or dependency is introduced.

## Visual and motion language

- Reuse the existing neutral, accent, spacing, radius, and shadow tokens before adding values.
- Use layered shadows for elevated cards and buttons; retain borders for dividers and form-control outlines.
- Keep nested radii concentric where surfaces are visually adjacent.
- Use `text-wrap: balance` for short headings and `text-wrap: pretty` for short supporting copy where browser support makes it useful.
- Preserve root font smoothing and use tabular numerals for changing route distance, duration, counts, and pagination summaries.
- Touch surfaces use at least 44×44px hit areas. Compact desktop controls remain at least 40×40px and retain visible focus.
- Press feedback uses the established subtle `scale(0.96)` pattern only where it does not disturb map gestures.
- Interactive transitions use specific properties and durations between 150ms and 220ms. No `transition: all` is introduced.
- Reduced-motion users receive immediate or minimal state changes. Existing map animation suppression remains intact.
- Decorative gradients are removed from informational panels unless the gradient communicates a real state.

## Copy changes

| Current | Revised |
| --- | --- |
| Loading map experience… | Loading cemetery map… |
| Preparing fast search… | Preparing search… |
| Switch to one curated route when you want guided stops. | Choose a tour to follow its stops. |
| Share Link | Share this map |
| Send someone straight to this selection and map view. | Copy a link to these records and this map view. |
| Or save it to your Home Screen from Safari for one-tap return visits. | In Safari, use Add to Home Screen to save this map. |
| Directions unavailable for this burial | Directions aren’t available for this record. |

Copy stays factual and task-oriented. It avoids promotional adjectives, abstract "experience" language, chatbot-like encouragement, and unnecessary instructions when the control itself is clear.

## Error, loading, and unavailable states

- Map, burial-data, tour, offline, and route failures continue to use existing status or alert surfaces.
- Relevant async updates remain in polite live regions.
- A failed on-site route may fall back to external directions using the existing behavior, with one concise notice explaining the change.
- Missing coordinates disable or omit navigation at the owning record surface and expose the direct unavailable message.
- Search preparation does not block Tours, Sections, map controls, or already-cached results.
- Unsupported installation does not create a control that cannot act.

## Performance design

Keep the current worker search, result limits, `content-visibility`, intrinsic sizing, lazy burial payload, idle tour metadata, memoized indexes, marker decluttering, and map-layer memoization.

The refinement reduces work by rendering one authoritative action/detail surface per viewport and by omitting inert menu content. No new global listeners, layout measurement loops, animation library, or synchronous full-dataset pass is added. Performance work beyond this requires a measured regression or profiler evidence.

## Test strategy

Implementation follows red-green-refactor for each behavior.

### Pure tests

- Popup mode is compact only when desktop sidebar details are available.
- Full popup remains available when the sidebar is collapsed.
- The utility menu is hidden with no enabled commands and shown for share, clear, or install commands.
- Burial result presentation contains one plot line and does not repeat its location eyebrow.
- Revised loading, share, tour, directions, and install copy is returned for the correct states.

### DOM tests

- Compact popup contains spatial context and no Navigate/Close action row.
- Full popup retains existing navigation, close, biography, and stack behavior.
- Desktop and mobile More controls render only for actionable menus.
- Mobile selected-location mode retains Back to results, person switching, Navigate, and Details.
- Focus is visible and icon-only controls keep explicit accessible names.

### Browser tests and manual QA

Run the existing browser suite and directly exercise:

1. search result selection;
2. direct burial-marker selection;
3. section polygon and section-marker selection;
4. tour stop selection;
5. deep-link restoration;
6. desktop sidebar collapse and full-popup fallback;
7. off-site Navigate handoff without a blocked popup;
8. on-site route start or its mocked browser-test equivalent;
9. mobile sheet search, place mode, person switching, Details, and Back to results;
10. keyboard traversal, visible focus, reduced motion, and 44px mobile targets.

Rendered QA uses a desktop viewport and 390×844 mobile viewport. Each pass checks page identity, meaningful content, framework overlays, console errors/warnings, screenshot evidence, and an interaction state change.

## Acceptance criteria

- A selected record exposes one authoritative detail/action surface per viewport.
- Desktop keeps spatial popup context without duplicating Navigate or Close while the sidebar is visible.
- Collapsing the desktop sidebar restores the full actionable popup.
- Mobile selection and navigation behavior remain intact.
- No More control appears when its menu has no enabled command.
- Search cards no longer repeat plot metadata.
- Approved plain-language copy appears in the rendered states.
- Search, section, tour, marker, deep-link, external directions, and on-site routing contracts remain unchanged.
- Focus, touch targets, safe areas, reduced motion, and live statuses meet the repository UI principles.
- Targeted unit and DOM tests, the full default test suite, lint/check gates, production build, and relevant Playwright flows pass with no unexplained application errors.
