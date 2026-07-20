# Release workflow

FAB uses a small SemVer release model. Pull requests are the production gate.
The current production branch is `main`. The old `master` branch is retired.

## Branch model

- Start ordinary work from `dev`.
- Use `dev` as the integration branch for validated work.
- Use `staging` as the pre-production branch for final validation.
- Use `main` as the production branch and remote default branch.
- Use short-lived branches named `codex/*`, `feature/*`, `fix/*`, `docs/*`,
  `chore/*`, or `hotfix/*`.
- Promote in order: short-lived branch -> `dev` -> `staging` -> `main`.
- Squash or rebase short-lived pull requests into `dev`.
- Use merge commits for long-lived branch promotions. These commits preserve
  shared ancestry and prevent promotion conflicts.
- `.github/workflows/promote-dev-to-staging.yml` promotes `dev` after green CI.
- Close the generated pull request when `staging` must remain unchanged.
- Accept `release/*` branches into `staging` for release preparation.
- Accept `hotfix/*` branches into `staging` or `main` for emergency production
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
5. After `dev` CI passes, GitHub Actions opens or updates the promotion pull
   request.
6. GitHub Actions enables merge-commit auto-merge after the required checks
   pass.
7. Promote `staging` to `main` manually with a merge commit after final
   validation.
8. CI runs lint, unit/DOM tests, Playwright browser regressions,
   generated-shell drift, release metadata, and branch policy checks.
9. Merge after the required checks pass.
10. For a numbered release, tag the merge commit as `vX.Y.Z` where `X.Y.Z`
   exactly matches `package.json`.

GitHub Actions then:

- Deploys `main` to GitHub Pages with the official Pages artifact workflow.
- Validates release tags with `bun run release:check`.
- Creates a GitHub Release for SemVer tags.

## GitHub branch protection

Configure `main`, `staging`, and `dev` in GitHub with branch protection.

For `main`, require:

- pull requests from `staging` or `hotfix/*`
- status checks:
  `CI / Lint and test`, `CI / Release metadata`,
  `CI / Browser regression`, `CI / Pull request branch policy`, and
  `CI / Generated shell drift`
- branches to be up to date before merging when practical
- merge commits for `staging` promotions
- conversation resolution
- no force pushes or deletions

For `staging`, require:

- pull requests from `dev`, `release/*`, or `hotfix/*`
- the same status checks as `main`
- merge commits for `dev` promotions
- conversation resolution
- no force pushes or deletions
- auto-merge may be enabled for the generated `dev` -> `staging` promotion PR

For `dev`, require:

- pull requests from short-lived work branches
- status checks to pass before merging:
  `CI / Lint and test`, `CI / Release metadata`,
  `CI / Browser regression`, `CI / Pull request branch policy`, and
  `CI / Generated shell drift`
- linear history, conversation resolution, no force pushes, and no deletions

Use linear history for `dev`, where short-lived work is squashed or rebased.
Disable linear history on `staging` and `main`.

Squashing or rebasing between long-lived branches rewrites promoted commits.
It also destroys common ancestry and causes promotion conflicts.

These settings live in GitHub, not in the repository, so this document and the
workflow checks are the repo-side contract.
