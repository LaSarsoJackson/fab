# UI principles

Usability is the design system.

## Product hierarchy

- Search Tours, Cemetery Map, and Burial Locator are distinct destinations.
- The ARCE website is a clearly external action.
- Tours opens by default.
- FABFG embedded routes do not draw a second navigation bar.
- Moving between destinations preserves the current tour, pin, section, and
  locator query until a new task explicitly replaces them.

## Interaction

- Use familiar controls and direct labels.
- Keep touch targets at least 44 px where space permits.
- Give pressed controls a small `scale: 0.96` response.
- Limit transitions to the properties that change; never use `transition: all`.
- Honor `prefers-reduced-motion` and device safe areas.
- Preserve keyboard focus and visible focus rings.

## Map and selection

- Keep the general map quiet: boundary and roads before sections and graves.
- Sections appear only after an explicit choice and read clearly when enabled.
- Selecting a section highlights it on the map. Opening its burial list is a
  separate action so the map does not disappear under the user. The section
  route automatically maps every record in that section and clusters only the
  density; List opens the browsable records. A section selection replaces a
  visible tour on the map, while Continue preserves the last tour place.
- Keep tour stops in a keyboard-accessible list as well as on the map.
- Call large inventories collections instead of implying that every dataset is
  a sequenced walk.
- Keep the active tour name and place position visible while details are open.
- Provide Previous, All places, and Next with no server-side navigation state.
- Remember only the last tour and place so a user can resume after an abrupt
  destination change or browser restart.
- Keep every active tour stop individually visible on the map. Reserve
  clustering for larger burial-result sets.
- One physical location may represent multiple records; do not invent spatial
  precision by spreading canonical coordinates.
- Close hides the detail card but leaves the pin.
- Unpin is the destructive selection action and must be explicit.
- Keep sharing secondary under “Share pinned grave.”
- Link biography-bearing records directly to the canonical ARCE biography; do
  not mirror or embed the legacy biography site inside FAB.
- Do not draw a computed walking route until its order and geometry have been
  reviewed for cemetery use.

## Visual language

- Use system typography, balanced headings, and readable line lengths.
- Use calm neutral surfaces, one green action color, and a warm selection accent.
- Use thin borders and subtle shadows to establish hierarchy.
- Use tabular numerals for dates and result counts.
- Inset image outlines use restrained black/white opacity, not gray borders.

## Performance behavior

- Do not load MapLibre until the map destination is needed.
- Do not load the burial index until a real name or section search starts.
- Search and prepare the large index in a worker.
- Keep the first Tours screen useful before any map or data request completes.
