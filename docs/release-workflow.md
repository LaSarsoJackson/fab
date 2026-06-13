# Release workflow

FAB uses a small SemVer release model with pull requests as the production
gate. The current production branch is `main`; the old `master` branch has been
retired.

## Branch model

- Start ordinary work from `dev`.
- Use `dev` as the integration branch for validated work.
- Use `staging` as the pre-production branch for final validation.
- Use `main` as the production branch and remote default branch.
- Use short-lived branches named `codex/*`, `feature/*`, `fix/*`, `docs/*`,
  `chore/*`, or `hotfix/*`.
- Promote in order: short-lived branch -> `dev` -> `staging` -> `main`.
- Allow `release/*` branches into `staging` for release preparation.
- Allow `hotfix/*` branches into `staging` or `main` for emergency production
  fixes.
- Do not push directly to `dev`, `staging`, or `main` except for emergency
  rollback. Protect these branches in GitHub and require the CI checks in this
  repo before merge.

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

1. Create a short-lived branch from `dev`.
2. Make the smallest coherent production change, including tests and docs.
3. Run `bun run check` locally for cross-cutting work.
4. Open a pull request into `dev`.
5. Promote `dev` to `staging` after the integration checks pass.
6. Promote `staging` to `main` after final validation.
7. CI runs lint, tests, generated-shell drift, release metadata, and branch
   policy checks.
8. Merge after the required checks pass.
9. For a numbered release, tag the merge commit as `vX.Y.Z` where `X.Y.Z`
   exactly matches `package.json`.

GitHub Actions then:

- deploys `main` to GitHub Pages from a reproducible build;
- validates release tags with `bun run release:check`;
- creates a GitHub Release for SemVer tags.

## GitHub branch protection

Configure `main`, `staging`, and `dev` in GitHub with branch protection.

For `main`, require:

- pull requests from `staging` or `hotfix/*`
- status checks:
  `CI / Lint and test`, `CI / Release metadata`,
  `CI / Pull request branch policy`, and `CI / Generated shell drift`
- branches to be up to date before merging when practical
- linear history, conversation resolution, no force pushes, and no deletions

For `staging`, require:

- pull requests from `dev`, `release/*`, or `hotfix/*`
- the same status checks as `main`
- linear history, conversation resolution, no force pushes, and no deletions

For `dev`, require:

- pull requests from short-lived work branches
- status checks to pass before merging:
  `CI / Lint and test`, `CI / Release metadata`,
  `CI / Pull request branch policy`, and `CI / Generated shell drift`
- linear history, conversation resolution, no force pushes, and no deletions

These settings live in GitHub, not in the repository, so this document and the
workflow checks are the repo-side contract.
