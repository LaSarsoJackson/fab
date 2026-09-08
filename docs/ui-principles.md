# UI principles

## Product hierarchy

- Keep Search Tours, Cemetery Map, and Burial Locator as separate destinations.
- Open Search Tours by default.
- Keep the ARCE website as an external action.
- Hide web navigation when FABFG owns the tabs.
- Preserve the active tour, pin, section, and locator query when the visitor
  moves between destinations.

## Visual hierarchy

- Use Newsreader for headings and Public Sans for controls and record lists.
  Serve both fonts with the app; keep their open-source licenses in `public/fonts`.
- Use green for navigation and selected controls, warm backgrounds, and lines
  between list rows. Shared type and color tokens live in `src/styles.css`.
- Separate tours from sections and groups. Use selectable rows and keep long
  names readable.
- Place desktop search fields beside their results. Stack them on phones.
- Show one map panel at a time: the place list or the selected grave's details.
  Keep the selected location clear of that panel, including in landscape.
- Keep Navigate and Read biography visible while record details scroll. Omit
  the portrait on short screens so the name and grave location have room.
- Use vertical place lists on every screen. Limit the height of phone panels
  to leave room for the map. Return keyboard focus to the chosen place after
  closing its details.

## Labels and controls

- Name controls for the visitor's action: Browse graves, View stops, Terrain,
  Sections, View burials, and Map credits.
- Keep implementation terms out of visitor-facing copy.
- Keep touch targets at least 44 px where the layout permits.
- Preserve keyboard focus, visible focus rings, reduced-motion preferences, and
  device safe areas.
- Limit transitions to the properties that change.

## Tours, collections, and graves

- Show tour stops in an HTML list and on the map.
- Show collections as unnumbered grave lists. Do not present an inventory as a
  walking tour.
- Keep collection markers hidden until the visitor chooses a grave.
- Show the active tour name and position while its details are open.
- Provide Previous, All places, and Next for tours. Collections do not get
  adjacent-stop controls.
- Close hides the detail card and keeps the pin. Unpin removes it.
- Keep sharing under "Share pinned grave."
- Open ARCE biographies on the canonical ARCE page.

## Map and section behavior

- Keep the general map quiet. Boundary and roads come before optional sections
  and graves.
- Identify and highlight a tapped section even when section shading is off.
  Open its burial list only after the visitor chooses View burials.
- Keep canonical coordinates. Several burial records may share one location.
- Do not draw a walking route without reviewed pedestrian geometry.

## Loading

- Load MapLibre on the first visit to Cemetery Map.
- Load the burial index after a name or section search starts.
- Search the burial index in a worker.
- Keep Search Tours usable before map or burial data loads.
