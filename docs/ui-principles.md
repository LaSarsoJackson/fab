# UI principles

Usability is the design system.

## Product hierarchy

- Search Tours, Cemetery Map, and Burial Locator are distinct destinations.
- The ARCE website is a clearly external action.
- Tours opens by default.
- FABFG embedded routes do not draw a second navigation bar.

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
- Keep tour stops in a keyboard-accessible list as well as on the map.
- Keep every active tour stop individually visible on the map. Reserve
  clustering for larger burial-result sets.
- One physical location may represent multiple records; do not invent spatial
  precision by spreading canonical coordinates.
- Close hides the detail card but leaves the pin.
- Unpin is the destructive selection action and must be explicit.
- Keep sharing secondary under “Share pinned grave.”

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
