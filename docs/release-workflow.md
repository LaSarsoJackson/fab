# Release workflow

FAB has one long-lived branch and one delivery path.

## Branch and deployment model

- `main` is production.
- Focused pull requests target `main` directly when branch protection requires
  review and checks.
- The single `CI / Quality` job runs lint, unit and DOM tests, generated-file
  drift checks, a production build, and browser regression tests.
- On `main`, the same workflow uploads the validated build and runs its Pages
  deployment job only after `Quality` succeeds.
- Do not add `dev`, `staging`, automated promotion branches, or branch-name
  policy checks. They add handoffs without changing the deployed artifact.

GitHub should protect `main` with the `CI / Quality` check, conversation
resolution, and no force pushes or deletion. Keep the repository default branch
and Pages source on `main`.

## Versions and tags

The app version lives in [`package.json`](../package.json) and uses SemVer.
Production releases also have a matching [`CHANGELOG.md`](../CHANGELOG.md)
section and an optional `vX.Y.Z` tag.

- Patch: bug fixes and behavior-preserving cleanup.
- Minor: backward-compatible product behavior.
- Major: breaking hosted URL, data, or native-wrapper contracts.

Pushing a matching SemVer tag runs the release workflow, validates metadata,
builds the app, and creates the GitHub Release. Tags do not control deployment;
`main` does.

## Release checklist

1. Run `bun run check` and `bun run build`.
2. Verify the browser flows affected by the change.
3. Merge the focused pull request to `main`.
4. Verify the public GitHub Pages route, not only the Actions result.
5. For a numbered release, update the version and changelog before tagging the
   merged commit.

Because `FABFG` loads hosted FAB URLs, routing, selection, and deep-link changes
need web and native-wrapper acceptance before the release is considered done.
