# UI Principles

These rules keep `fab` aligned with the current product direction: clearer, faster, more Apple-HIG-inspired, and easier to maintain.

## Primary goals

- clarity over density
- familiar touch-first patterns over novel interaction
- visible state changes over subtle affordances
- restrained motion over decorative animation
- accessibility as a baseline, not cleanup work

## Interaction rules

- Keep primary actions obvious and close to the content they affect.
- Prefer one clear action per row or panel instead of many competing controls.
- Use simple gestures for common actions. If a gesture exists, provide a visible control too.
- Keep tap targets comfortable on mobile.
- Honor safe areas and avoid controls that compete with system edges.

## Visual rules

- Use the shared tokens in [`src/App.js`](../src/App.js) and [`src/index.css`](../src/index.css) before adding one-off colors or shadows.
- Keep hierarchy strong: section labels, titles, supporting text, then metadata.
- Prefer calm surfaces and strong contrast over decorative gradients that reduce legibility.
- Keep Tours, ARCE, and Burial Locator as distinct destinations. Do not layer
  competing browse surfaces over the map.
- Keep the general ARCE map quiet: imagery and boundary first. Reveal section
  geometry or burial locations only after an explicit browse choice.
- Treat a chosen burial record as one person. When source coordinates represent
  a shared plot, expose that stack deliberately instead of silently merging it
  into the original selection.

## Accessibility rules

- Every form control needs a label or accessible name.
- Async notices and status updates should use `aria-live="polite"` when they matter.
- Icon-only controls need explicit labels.
- Focus styles must remain visible.
- Reduced-motion users should not be forced through long animated transitions.
- State should never rely on color alone.

## Performance rules

- Keep high-frequency interactions cheap: typing, filtering, tab changes, and map panning.
- Do not load the full search payload or mount Leaflet until the active destination needs it.
- Prefer CSS/layout solutions over measurement-heavy JavaScript.
- Large lists should use `content-visibility`, virtualization, or another bounded rendering strategy.
- Defer toolchain-level performance work until shared boundaries are stable enough to migrate safely.

## File placement

- Put shared UI patterns and tokens in top-level shell CSS or reusable UI helpers.
- Keep domain logic out of styling helpers.
- Put FAB-only presentation differences in [`src/features/fab/`](../src/features/fab).

## Review checklist

- Is the interaction simpler than before?
- Does it work with keyboard and touch?
- Are safe areas and the fixed mobile tabs still correct?
- Is focus visible?
- Does reduced motion still behave well?
- Did the change make the code easier for the next contributor to find?
