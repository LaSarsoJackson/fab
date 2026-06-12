# Release workflow

FAB uses a small SemVer release model with pull requests as the production
gate. The current production branch is `master` because the remote is still
configured that way. If the repository is renamed to `main`, keep both branch
names in CI until GitHub Pages and local clones have moved.

## Branch model

- Start production work from `master`.
- Use short-lived branches named `codex/*`, `feature/*`, `fix/*`, `docs/*`,
  `chore/*`, `release/*`, or `hotfix/*`.
- Keep experimental and operator-only tooling on `dev-features`; promote it to
  production only through a focused pull request into `master`.
- Do not push directly to `master` except for an emergency rollback. Protect
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

1. Create a short-lived branch from `master`.
2. Make the smallest coherent change, including tests and docs.
3. Run `bun run check` locally for cross-cutting work.
4. Open a pull request into `master`.
5. CI runs lint, tests, generated-shell drift, release metadata, and branch
   policy checks.
6. Merge after the required checks pass.
7. For a numbered release, tag the merge commit as `vX.Y.Z` where `X.Y.Z`
   exactly matches `package.json`.

GitHub Actions then:

- deploys `master` to GitHub Pages from a reproducible build;
- validates release tags with `bun run release:check`;
- creates a GitHub Release for SemVer tags.

## GitHub branch protection

Configure `master` or `main` in GitHub with these protections:

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
