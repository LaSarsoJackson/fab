# Repo Cleanup & Maintainability Plan

Goal: a newcomer can clone, run, test, and confidently change this repo within
an hour, and the structure stops accumulating friction as it grows.

This plan is ordered by leverage-per-effort. Each phase is independently
shippable; stop at any point and the repo is still better than before. Items
are checkboxes so this doc can double as a tracking board.

Current state in one paragraph: the docs are much stronger than the average
small React app, and this branch now adds Quickstart guidance, CI/CD,
release-policy checks, generated-file documentation, and real app screenshots.
The remaining friction is mostly a dirty working tree, four toolchains
(Bun, Node/Jest, Playwright, Python/uv), tests split across two runners and two
directories, two large orchestration components, and 60MB+ of data checked into
git.

---

## Phase 0 — Stabilize the working tree (do first, ~1 hour)

The repo currently has ~25 modified files, a deleted `package-lock.json`, and
untracked new modules. Nothing else in this plan should land on top of an
ambiguous baseline.

- [ ] Review and commit (or revert) the in-flight changes. The untracked
      `src/features/map/mapMarkerDeclutter.js`, `test/mapMarkerDeclutter.test.js`,
      and `test/uiAssetContracts.test.js` look like a finished feature — commit
      them with the related modified files.
- [ ] Commit the `package-lock.json` deletion. `bun.lock` is the lockfile now;
      a deleted-but-uncommitted npm lockfile reads as an accident.
- [ ] Add to `.gitignore`: `.claude/`, `.env` (see Phase 1), and either ignore
      `.vscode/` or commit a minimal curated `.vscode/settings.json` +
      `extensions.json` and ignore the rest (`.vscode/*` with `!` exceptions).

**Done when:** `git status` is clean and every future change in this plan is
its own small commit.

## Phase 1 — Secrets & git hygiene (~1 hour, do before anything public)

- [x] **Keep local secrets out of git.** `.env` is ignored and `.env.example`
      documents safe local defaults. Real local values should stay in `.env` or
      `.env.local`.
- [ ] **Rotate/restrict the key.** Note: any `REACT_APP_*` var ships in the
      client bundle, so this key is public *at runtime* regardless. The real
      protection is on the GraphHopper side: set referrer/origin restrictions
      and a usage quota on the key. Rotation matters because the old key sits
      in git history with no restrictions documented.
- [ ] Decide whether scrubbing the key from git history is worth it
      (`git filter-repo`). If the key is rotated and restricted, history
      scrubbing is optional — document the decision either way.

**Done when:** `git ls-files | grep .env` returns only `.env.example`, and the
key in history is dead or restricted.

## Phase 2 — The 5-minute onboarding path (~half a day)

README content is good but assumes context. Optimize for the first hour of a
new contributor.

- [ ] Add a **Quickstart** block at the very top of `README.md`:
      prerequisites table (Bun 1.3.8 via `packageManager`, Node 20 via
      `.nvmrc`, Python 3.11 + `uv` *optional, only for data refresh scripts*),
      then literally: `bun install`, `bun run doctor`, `bun run start`.
- [ ] **Fix the hidden `ripgrep` dependency.** `test:bun`, `test:watch`, and
      `test:coverage` in `package.json` shell out to `rg`. A newcomer without
      ripgrep gets a cryptic failure from the most basic command (`bun run test`).
      Replace with `bun test` native glob discovery, a small JS glob script, or
      `find`; alternatively have `dev-doctor.sh` check for `rg` and say so.
- [ ] Extend `scripts/dev-doctor.sh` to check *everything* the scripts assume:
      bun version, node version, rg (until removed), python3, uv,
      playwright browsers. Doctor should be the single answer to "why doesn't
      X run on my machine."
- [ ] Add a "Which scripts are for me?" section to README or CONTRIBUTING:
      contributors need `start` / `test` / `lint`; maintainers use
      `build:*`, `deploy`, `download_*.py`, geoparquet tooling. Right now all
      ~20 scripts present with equal weight.

**Done when:** a fresh clone on a machine with only Bun + Node installed gets
a running app and passing unit tests from README instructions alone, or a
clear doctor message saying what's missing.

## Phase 3 — Make generated vs. source unmistakable (~half a day)

Several committed files are build outputs of other committed files. Newcomers
will edit the wrong one.

| Generated file | Source of truth | Generator |
|---|---|---|
| `public/index.html` | `public/index.template.html` + `src/features/fab/profile.js` | `scripts/sync-profile-shell.js` |
| `public/manifest.json` | `public/manifest.template.json` + profile | same |
| `src/data/TourMatches.json` | tour defs + burial data | `scripts/precalculate-metadata.js` |
| `src/data/TourBiographyAliases.json` | tour defs + burial data | `scripts/generate-tour-biography-aliases.js` |
| `public/data/Search_Burials.json` | `src/data/Geo_Burials.*` | `scripts/precalculate-metadata.js` |

- [ ] Add this table (or equivalent) to `docs/codebase-structure.md` and link
      it from CONTRIBUTING's checklist.
- [ ] `public/index.html` already gets a "Generated by…" header comment —
      add the same self-identifying marker to every generated JSON above
      where format allows (e.g. a `"__generated__"` key, or a sibling
      `.generated` marker note in the directory).
- [ ] Consider a `// @generated` grep-able convention so tooling and reviewers
      can spot hand-edits to generated files in PRs.
- [ ] Optional: a CI check (Phase 5) that re-runs `sync:profile-shell` and
      fails if `public/index.html`/`manifest.json` drift from their templates.

**Done when:** every generated-but-committed file says so in its first lines,
and the docs list them all in one place.

## Phase 4 — One mental model for tests (~1 day)

Today: `test/**/*.test.js` runs under **Bun**, `src/**/*.test.jsx` runs under
**Jest/jsdom**, `e2e/` under Playwright — three runners, two discovery roots,
and test names that don't always match the module they cover.

Recommendation: **don't** force a single runner now (Bun can't do jsdom DOM
tests well yet, and a Vitest migration belongs with the bundler decision in
Phase 7). Instead, make the split a documented rule rather than archaeology:

- [ ] Write the convention down in CONTRIBUTING:
      - Pure logic test → `test/<module>.test.js`, runs under `bun test`.
      - DOM/component test → co-located `src/**/<Component>.test.jsx`, runs
        under Jest.
      - Browser flow → `e2e/`.
- [ ] **Audit test-to-module mapping** and rename files so the covered module
      is obvious from the test filename (e.g. if `test/appProfile.test.js`
      actually exercises `sidebarState.js`, split or rename it). One module ↔
      one obviously-named test file.
- [ ] Make `bun run test` the only command anyone needs (it already chains
      both runners via `run-tests.sh`) and say so loudly in README; demote
      `test:bun`/`test:dom` to "advanced" docs.
- [ ] Unify coverage output locations so `test:coverage` doesn't produce two
      disjoint reports silently (at minimum, document where each lands).

**Done when:** CONTRIBUTING answers "where do I put a test for file X" in one
sentence, and filenames make test→module mapping greppable.

## Phase 5 — CI (~half a day, highest ongoing payoff)

Initial repo-side enforcement now lives in `.github/workflows/`. Every future
cleanup item should either add a fast automated check or explain why it remains
manual.

- [x] `ci.yml` on PR + push to main/staging/dev:
      1. `oven-sh/setup-bun` (pin 1.3.8) + `bun install`
      2. `bun run lint`
      3. `bun run release:check`
      4. `bun run pr:check` on pull requests
      5. `bun run test` (bun + jest suites)
      6. (Optional, can be a second job) Playwright smoke — start with
         `--grep` on a small critical-path subset; the full `e2e/app.spec.js`
         is huge and will be slow/flaky as a PR gate.
- [x] Generated-file drift check (from Phase 3): run `sync:profile-shell`,
      fail on `git diff --exit-code public/index.html public/manifest.json`.
- [x] `deploy.yml` on push to main: replace the manual
      `deploy-production.sh` / gh-pages flow with the official GitHub Pages
      actions, so deploys are reproducible and don't depend on one laptop. The
      shell script now performs a local production build check only.
- [x] `promote-dev-to-staging.yml`: after a successful `dev` push CI run, open
      or update the `dev` -> `staging` PR and enable auto-merge once the
      promotion PR checks pass.
- [x] `release.yml` on `v*.*.*` tags: validate package/changelog/tag metadata,
      build the production app, and create a GitHub Release.

**Done when:** a PR cannot merge with failing lint/tests, and main deploys
itself.

## Phase 6 — Shrink the god components (ongoing, PR-sized chunks)

The two files everyone is afraid of:

- `src/Map.jsx` — **4,756 lines** (Leaflet wiring, selection state, popup
  lifecycle, viewport logic)
- `src/BurialSidebar.jsx` — **2,685 lines** (search, browse, record detail,
  mobile bottom sheet)

The extraction pattern already exists and works — `mapDomain.js`,
`mapMarkerIcons.js`, `mapChrome.jsx`, `mapMarkerDeclutter.js` were all carved
out of `Map.jsx`. Continue it; do **not** attempt a big-bang rewrite.

Rules for every extraction PR:
1. Behavior-preserving only — no feature changes in the same PR.
2. Extracted module gets (or brings along) its own test per Phase 4.
3. Target: no extraction PR over ~500 lines of diff.

Suggested order (smallest risk first):

- [ ] `Map.jsx`: extract remaining pure helpers (viewport/bounds math,
      marker-building) into `src/features/map/` modules with bun tests.
- [ ] `Map.jsx`: extract the selection reducer + actions into
      `src/features/map/selection.js` (likely the single biggest win).
- [ ] `Map.jsx`: extract popup lifecycle (open/close/update orchestration)
      next to `popupCardContent.jsx`.
- [ ] `BurialSidebar.jsx`: split into `features/browse/` components — search
      input, results list, record detail, mobile-sheet shell — it already
      has a 1,599-line co-located test that documents the expected behavior;
      keep it green throughout.
- [ ] `src/features/map/mapDomain.js` (1,497 lines): once `Map.jsx` shrinks,
      evaluate splitting the reducer by concern (selection vs. viewport vs.
      popup) — only if it's still hard to navigate.
- [ ] Also move the remaining root-level feature files (`Map.jsx`,
      `BurialSidebar.jsx`) into `src/features/` once they're thin
      orchestrators, so `src/` root is just app shell (`index.js`, `App.js`,
      CSS).

**Done when:** no file in `src/` exceeds ~800 lines, and `src/` root contains
only the app shell.

## Phase 7 — Data weight & dependency modernization (deliberate, later)

These are real but expensive; schedule them, don't let them block Phases 0–6.

**Repo size.** Git tracks ~57MB in `src/data/` (404 files, including the 31MB
`Geo_Burials.json` and a 3.1MB parquet equivalent) plus 9.2MB of basemap
tiles. Every clone pays this forever, and git history grows with each data
refresh.

- [ ] Short term: document that `Geo_Burials.parquet` is the compact
      equivalent of the 31MB JSON; if the parquet path is mature, stop
      shipping/refreshing the JSON and make `download_geojson.py` +
      `build:geoparquet` the refresh path.
- [ ] Decide one of: keep as-is (simplest; data rarely changes), Git LFS for
      `src/data/**` + `public/basemaps/**`, or fetch-on-setup (gitignore the
      data, have doctor/setup run the download scripts). Fetch-on-setup hurts
      the "clone and run" goal — prefer LFS or status quo unless clone size
      actually becomes a complaint.

**Dependencies.** Not "cleanup," but flag it so it's a decision, not drift:

- [ ] React 17 + react-scripts 5 (CRA is deprecated upstream) + Jest 27. The
      eventual move is React 18 + Vite + Vitest, which would *also* collapse
      the two-test-runner split from Phase 4 into one. Treat as its own
      project after CI (Phase 5) exists to catch regressions.
- [ ] Add Prettier + `.editorconfig` (cheap, do anytime; enforce in CI once
      Phase 5 lands). One `bun run format` script, format-check in CI.

---

## Sequencing summary

| Phase | What | Effort | Why this order |
|---|---|---|---|
| 0 | Clean working tree, gitignore | 1 h | Baseline for everything else |
| 1 | `.env` secret out of git | 1 h | Security; cheap |
| 2 | Quickstart + doctor + rm `rg` dep | ½ day | First-hour experience |
| 3 | Generated-vs-source clarity | ½ day | Stops wrong-file edits |
| 4 | Test conventions + renames | 1 day | One mental model |
| 5 | CI + auto-deploy | ½ day | Locks in 0–4 permanently |
| 6 | God-component extraction | ongoing | PR-sized, behavior-preserving |
| 7 | Data weight, React 18/Vite | later | Big, schedule deliberately |

Non-goals (explicitly out of scope for "cleanup"): rewriting features,
changing the map UX, redesigning the data pipeline, or any refactor that
isn't behavior-preserving.
