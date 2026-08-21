# Maintainability playbook

KISS here means fewer owners and fewer representations, not fewer user
capabilities.

## Current invariants

- one web product route contract
- one visible tab owner
- one map renderer
- one canonical burial source
- one generated browser search artifact
- one selected-record card
- one production build directory

## Admission test for new machinery

Before adding an adapter, registry, storage format, build stage, or control,
write down:

1. the observed user or maintenance problem
2. the simplest direct change
3. why that direct change is insufficient
4. the test that proves the new machinery earns its cost

“Modern,” “flexible,” and “we may need it” are not mechanisms.

## Comments

Comment constraints, ownership, generated contracts, and non-obvious browser
behavior. Delete comments that narrate ordinary syntax or describe a file that
no longer exists.

## State

Derive state in render when possible. Route state comes from the URL. Map style
state stays in `MapView`. Worker search state stays in `useBurialSearch`. Do not
mirror the same choice in React state, query params, and local storage.

## Dependencies

The runtime dependency set is React, React DOM, and MapLibre. Add another runtime
package only when the platform or existing dependencies cannot do the job
clearly. Semantic controls and CSS are preferred over a component framework.

## Cleanup

Delete superseded code in the same change after the replacement passes its
tests. Retain source data unless deletion is specifically approved. A retired
tracked artifact can remain recoverable in Git while being excluded from the
runtime and deployment output.
