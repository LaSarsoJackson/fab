# Release workflow

FAB uses a small SemVer release model with pull requests as the production
gate. The current production branch is `main`; the old `master` branch has been
retired.

## Branch model

- Start production work from `main`.
- Use `dev` as the integration branch for validated work that is ready to
  batch toward production.
- Use short-lived branches named `codex/*`, `feature/*`, `fix/*`, `docs/*`,
  `chore/*`, `release/*`, or `hotfix/*`.
- Keep experimental and operator-only tooling on `dev-features`; promote it to
  production only through a focused pull request into `dev` or `main`.
- Do not push directly to `main` except for an emergency rollback. Protect
  the branch in GitHub and require the CI checks in this repo before merge.

## Version policy

The app version lives in [`package.json`](../package.json). Use SemVer:

- Patch: bug fixes, documentation corrections, generated artifact refreshes,
  and behavior-preserving cleanup.
- Minor: new user-facing map, browse, routing, tour, PWA, or hosted URL
  behavior that remains backward compatible.
- Major: breaking URL, data, or native-wrapper contracts.

Every production release must update [`CHANGELOG.md`](../CHANGELOG.md) with a
section matching the package version, for example `## [1.4.2] - 2026-06-12`.
Keep future work under `## [Unreleased]` until a release branch or release PR
promotes it.

## Pipeline

1. Create a short-lived branch from `main`.
2. Merge validated work into `dev` when you want an integration checkpoint.
3. Make the smallest coherent production change, including tests and docs.
4. Run `bun run check` locally for cross-cutting work.
5. Open a pull request into `main`.
6. CI runs lint, tests, generated-shell drift, release metadata, and branch
   policy checks.
7. Merge after the required checks pass.
8. For a numbered release, tag the merge commit as `vX.Y.Z` where `X.Y.Z`
   exactly matches `package.json`.

GitHub Actions then:

- deploys `main` to GitHub Pages from a reproducible build;
- validates release tags with `bun run release:check`;
- creates a GitHub Release for SemVer tags.

## GitHub branch protection

Configure `main` in GitHub with these protections:

- Require a pull request before merging.
- Require status checks to pass before merging:
  `CI / Lint and test`, `CI / Release metadata`,
  `CI / Pull request branch policy`, and `CI / Generated shell drift`.
- Require branches to be up to date before merging when practical.
- Restrict direct pushes to maintainers.
- Require signed tags or restricted tag creation for `v*.*.*` releases when the
  repository has multiple maintainers.

These settings live in GitHub, not in the repository, so this document and the
workflow checks are the repo-side contract.
