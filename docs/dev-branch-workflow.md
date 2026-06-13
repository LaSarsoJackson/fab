# Dev/staging/main branch workflow

`main` is the production-facing web and native-wrapper surface. Keep
it focused on the shipped Leaflet map, search, browse, tours, routing, deep
links, and deployable static assets. The old `master` branch has been retired
in favor of `main`.

`staging` is the pre-production branch. It should mirror what is ready for final
validation before production deploy. GitHub Actions opens or updates the
`dev` -> `staging` promotion PR after `dev` CI passes and enables auto-merge on
that promotion PR once its required checks pass.

`dev` is the integration branch for validated work that is not yet promoted to
staging.

Short-lived branches are the only place for active feature, fix, cleanup, or
experiment work. Use prefixes such as `codex/`, `feature/`, `fix/`, `docs/`,
`chore/`, or `hotfix/`.

## Working model

Start work from `dev` unless the change is an emergency production hotfix:

```bash
git switch dev
git switch -c feature/short-description
```

Open pull requests in this order:

1. `feature/*`, `fix/*`, `docs/*`, `chore/*`, `codex/*` -> `dev`
2. `dev` -> `staging` through the generated auto-merge promotion PR
3. `staging` -> `main` manually after final validation

GitHub Pages deploys from the `main` branch build through GitHub Actions. The
legacy `gh-pages` branch is not part of the normal deployment path.

## Promoting work back

Promote code only when it is part of the shipped app. Keep those PRs focused:

- add the production contract first
- remove any dev-only runtime switch before merging
- update `README.md`, `CONTRIBUTING.md`, and architecture notes with the actual
  command surface
- run the same validation gate expected for production-facing map or routing
  changes
- follow [`release-workflow.md`](./release-workflow.md) for version, changelog,
  branch-policy, and CI/CD requirements
- keep `staging` -> `main` as the manual gate for public GitHub Pages and
  native-wrapper-facing changes

Do not keep main-side feature flags, query params, routes, scripts, or
dependencies solely to make dev-only tools reachable. A short-lived branch is
the boundary.
