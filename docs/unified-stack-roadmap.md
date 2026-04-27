# Unified Stack Roadmap

This is the current staged plan for the next round of `fab` work.

The goals are:

- keep the shipped web surface and `FABFG` hosted URL contract aligned
- keep the UI clearer, more performant, and closer to Apple HIG expectations
- reduce contributor friction for new maintainers
- keep development-only tools isolated on `dev-features`

## Current State

The repo has the right major seams:

- profile-based FAB wiring under [`src/features/fab/`](../src/features/fab)
- map orchestration in [`src/Map.jsx`](../src/Map.jsx)
- browse, tour, routing, and deep-link contracts under owning feature folders
- a documented branch boundary for dev-only surfaces in
  [`dev-branch-workflow.md`](./dev-branch-workflow.md)

The biggest remaining pressure points are:

- very large orchestration files like [`src/Map.jsx`](../src/Map.jsx) and
  [`src/BurialSidebar.jsx`](../src/BurialSidebar.jsx)
- mixed legacy and current React patterns while the app still runs on React 17
  and `react-scripts`
- contributor docs drifting behind architecture changes

## Stage 1: Contributor DX

Status: active

- keep [CONTRIBUTING.md](../CONTRIBUTING.md), [AGENTS.md](../AGENTS.md), and this docs set current
- document which files own which decisions
- make validation expectations explicit by change type

## Stage 2: Shared Contracts For Web + Native

Status: next

- extract and stabilize shared record, browse, deep-link, and navigation contracts first
- treat `fab` as the source of shared URL and selection behavior
- keep wrapper-specific packaging and native-shell concerns in `FABFG`

Decision rule:
do contract cleanup before any large framework migration

## Stage 3: UI System Refresh

Status: active

- move shared UI decisions into documented tokens and patterns instead of one-off tweaks
- favor Apple-HIG-inspired interaction choices:
  clearer hierarchy, bigger touch targets, simpler gestures, visible focus, restrained motion
- keep safe-area and mobile sheet behavior first-class

## Stage 4: Production Map Simplification

Status: active

- keep `master` on the shipped Leaflet map path
- move renderer experiments, operator tooling, and artifact previews to `dev-features`
- promote only focused, production-ready contracts back to `master`

## Stage 5: Toolchain Modernization

Status: later

- modernize the build/runtime stack only after shared boundaries are cleaner
- upgrade to a supported React/toolchain combination that can use newer concurrency patterns cleanly
- adopt newer React APIs after the upgrade, not before

## Guardrails

- prefer additive refactors over broad moves
- do not let branch-only dev tools leak back into shared product code
- if a change can affect hosted URLs or deep links, check both web and `FABFG`
- if source data changes, regenerate derived artifacts instead of patching outputs manually
