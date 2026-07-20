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
- Honor safe areas. Do not use controls that compete with system edges.

## Visual rules

- Use the shared tokens in [`src/App.js`](../src/App.js) and [`src/index.css`](../src/index.css) before adding one-off colors or shadows.
- Keep hierarchy strong: section labels, titles, supporting text, then metadata.
- Prefer calm surfaces and strong contrast over decorative gradients that reduce legibility.
- Treat the map as the primary surface. Sidebars and sheets must support the
  map without obscuring it.

## Accessibility rules

- Every form control needs a label or accessible name.
- Use `aria-live="polite"` for important asynchronous notices and status
  updates.
- Icon-only controls need explicit labels.
- Focus styles must remain visible.
- Do not force reduced-motion users through long animated transitions.
- Do not use color as the only indication of state.

## Performance rules

- Keep high-frequency interactions cheap: typing, filtering, drawer changes, and map panning.
- Prefer CSS/layout solutions over measurement-heavy JavaScript.
- Large lists must use `content-visibility`, virtualization, or another bounded
  rendering strategy.
- Defer toolchain-level performance work until shared boundaries are stable enough to migrate safely.

## File placement

- Put shared UI patterns and tokens in top-level shell CSS or reusable UI helpers.
- Keep domain logic out of styling helpers.
- Put FAB-only presentation differences in [`src/features/fab/`](../src/features/fab).

## Review checklist

- Is the interaction simpler than before?
- Does it work with keyboard and touch?
- Are safe areas and mobile drawers still correct?
- Is focus visible?
- Does reduced motion still behave well?
- Did the change make the code easier for the next contributor to find?
