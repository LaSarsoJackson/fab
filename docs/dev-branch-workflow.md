# Dev branch workflow

`master` is the current production-facing web and native-wrapper surface. Keep
it focused on the shipped Leaflet map, search, browse, tours, routing, deep
links, and deployable static assets. If the remote default branch is renamed to
`main`, apply the same rules there; the CI/CD workflows already accept both
branch names.

The `dev-features` branch preserves experimental and operator-only surfaces:

- static admin/editor flows
- custom map renderer experiments
- PMTiles detail previews
- site-twin and digital-twin debug tooling
- similar DevEx or DevOps tools that should not ship as dormant runtime paths

## Working model

Use `dev-features` when building or operating those surfaces. In GitHub Desktop,
choose the `dev-features` branch before editing them. In the CLI:

```bash
git switch dev-features
```

If you need production work and dev-tool work at the same time, prefer a
separate worktree so the `master` checkout stays available:

```bash
git worktree add ../fab-dev-features dev-features
```

## Promoting work back

Promote code from `dev-features` to `master` only when it is part of the shipped
app. Keep those PRs focused:

- add the production contract first
- remove any dev-only runtime switch before merging
- update `README.md`, `CONTRIBUTING.md`, and architecture notes with the actual
  command surface
- run the same validation gate expected for production-facing map or routing
  changes
- follow [`release-workflow.md`](./release-workflow.md) for version, changelog,
  branch-policy, and CI/CD requirements

Do not keep master-side feature flags, query params, routes, scripts, or
dependencies solely to make dev-only tools reachable. The branch is the
boundary.
