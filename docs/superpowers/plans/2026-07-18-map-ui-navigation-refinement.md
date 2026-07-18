# FAB Map UI and Navigation Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make search-to-navigation clearer, remove duplicate desktop and result-card UI, hide inert utility controls, and replace abstract product copy while preserving the current map, selection, deep-link, and routing contracts.

**Architecture:** Keep `Map.jsx` as the owner of viewport, selection, route, install, and share state. Add pure presentation decisions in the existing map and browse helper modules, teach the popup components an explicit compact/full mode, and let `BurialSidebar.jsx` render only the controls that the map says are actionable. Preserve the mobile place sheet and all current performance safeguards.

**Tech Stack:** React 17, MUI 5, Leaflet/React-Leaflet, Bun unit tests, Jest + Testing Library DOM tests, Playwright browser tests, CSS in `src/index.css`.

---

## Guardrails

- Do not change public query keys, packed share payloads, burial/tour data, route-selection rules, or the trusted-click external Maps handoff.
- Do not add a dependency, global listener, full-dataset pass, barrel module, or compatibility wrapper.
- Keep the existing worker search, paging, `content-visibility`, lazy burial data, idle tour loading, memoized indexes, marker decluttering, and reduced-motion behavior.
- Preserve the unrelated untracked `.agents/` directory and `skills-lock.json`; stage only files named in each task.
- Follow red-green-refactor within each task. Run the stated failing test before production edits, then rerun it after the smallest implementation.
- Use the approved design as the source of truth: `docs/superpowers/specs/2026-07-18-map-ui-navigation-refinement-design.md`.

## Task 1: Add pure popup-mode and utility-menu policies

**Files:**

- Modify: `test/mapViewHelpers.test.js`
- Modify: `src/features/map/mapViewHelpers.js`
- Modify: `test/browseSidebarPresentation.test.js`
- Modify: `src/features/browse/sidebarPresentation.js`

- [ ] **Step 1: Write popup-mode tests.**

  Extend the import in `test/mapViewHelpers.test.js` with `MAP_POPUP_PRESENTATION_MODES` and `resolveMapPopupPresentationMode`, then add:

  ```js
  describe("resolveMapPopupPresentationMode", () => {
    test("hides map popups on mobile", () => {
      expect(resolveMapPopupPresentationMode({
        isMobile: true,
        isSearchPanelVisible: true,
      })).toBe(MAP_POPUP_PRESENTATION_MODES.NONE);
    });

    test("uses compact context while the desktop sidebar is visible", () => {
      expect(resolveMapPopupPresentationMode({
        isMobile: false,
        isSearchPanelVisible: true,
      })).toBe(MAP_POPUP_PRESENTATION_MODES.COMPACT);
    });

    test("restores the full popup when the desktop sidebar is collapsed", () => {
      expect(resolveMapPopupPresentationMode({
        isMobile: false,
        isSearchPanelVisible: false,
      })).toBe(MAP_POPUP_PRESENTATION_MODES.FULL);
    });
  });
  ```

- [ ] **Step 2: Run the popup-mode test and confirm it fails for missing exports.**

  Run: `bun test test/mapViewHelpers.test.js`

  Expected: FAIL because the new mode constant and resolver do not exist.

- [ ] **Step 3: Implement the pure popup-mode contract.**

  Add near the top of `src/features/map/mapViewHelpers.js`:

  ```js
  export const MAP_POPUP_PRESENTATION_MODES = Object.freeze({
    COMPACT: "compact",
    FULL: "full",
    NONE: "none",
  });

  export const resolveMapPopupPresentationMode = ({
    isMobile = false,
    isSearchPanelVisible = true,
  } = {}) => {
    if (isMobile) {
      return MAP_POPUP_PRESENTATION_MODES.NONE;
    }

    return isSearchPanelVisible
      ? MAP_POPUP_PRESENTATION_MODES.COMPACT
      : MAP_POPUP_PRESENTATION_MODES.FULL;
  };
  ```

- [ ] **Step 4: Write utility-menu availability tests.**

  Import `buildAppMenuPresentation` in `test/browseSidebarPresentation.test.js` and add a table-driven test covering no commands plus each command independently:

  ```js
  test("shows the app menu only when it has an enabled command", () => {
    expect(buildAppMenuPresentation()).toEqual({
      canClearSavedShareDetails: false,
      canCopyShareLink: false,
      canInstallApp: false,
      hasActions: false,
    });

    [
      "canClearSavedShareDetails",
      "canCopyShareLink",
      "canInstallApp",
    ].forEach((enabledKey) => {
      expect(buildAppMenuPresentation({ [enabledKey]: true })).toMatchObject({
        [enabledKey]: true,
        hasActions: true,
      });
    });
  });
  ```

- [ ] **Step 5: Run the sidebar presentation test and confirm it fails for the missing helper.**

  Run: `bun test test/browseSidebarPresentation.test.js`

  Expected: FAIL because `buildAppMenuPresentation` is not exported.

- [ ] **Step 6: Implement normalized utility-menu availability.**

  Add to `src/features/browse/sidebarPresentation.js`:

  ```js
  export const buildAppMenuPresentation = ({
    canClearSavedShareDetails = false,
    canCopyShareLink = false,
    canInstallApp = false,
  } = {}) => {
    const actions = {
      canClearSavedShareDetails: Boolean(canClearSavedShareDetails),
      canCopyShareLink: Boolean(canCopyShareLink),
      canInstallApp: Boolean(canInstallApp),
    };

    return {
      ...actions,
      hasActions: Object.values(actions).some(Boolean),
    };
  };
  ```

- [ ] **Step 7: Run both pure suites and commit.**

  Run: `bun test test/mapViewHelpers.test.js test/browseSidebarPresentation.test.js`

  Expected: PASS.

  Stage:

  ```text
  test/mapViewHelpers.test.js
  src/features/map/mapViewHelpers.js
  test/browseSidebarPresentation.test.js
  src/features/browse/sidebarPresentation.js
  ```

  Commit: `feat: define map popup and utility menu policies`

## Task 2: Add compact spatial-context popups without weakening full popups

**Files:**

- Modify: `src/features/map/popupCardContent.test.jsx`
- Modify: `src/features/map/popupCardContent.jsx`
- Modify: `src/index.css`
- Modify: `test/uiAssetContracts.test.js`

- [ ] **Step 1: Write compact single-record and stack tests.**

  Import `MAP_POPUP_PRESENTATION_MODES` from `./mapViewHelpers` in `popupCardContent.test.jsx`. Add one test for `PopupCardContent` and one for `PopupCardStackContent` asserting:

  - the active name and complete location remain visible;
  - `3 people at this plot` is visible for a shared marker;
  - the compact root has `popup-card--compact` and a useful accessible group label;
  - the stack has `popup-card-stack--compact`;
  - no person list, biography paragraph/image, Details link, Navigate button, or Close button is rendered.

  Use the existing Reynolds record for the biography/image assertions and `stackRecords` for the shared-marker assertion:

  ```js
  const reynoldsRecord = {
    id: "reynolds",
    source: "tour",
    displayName: "Marcus T. Reynolds",
    Section: "17",
    Lot: "1",
    Birth: "8/20/1869",
    Death: "3/18/1937",
    extraTitle: "Albany Architect",
    portraitImageName: "Reynolds5d.png",
    biographyLink: "Reynolds5",
  };
  ```

  ```jsx
  <PopupCardContent
    record={reynoldsRecord}
    recordCount={3}
    presentationMode={MAP_POPUP_PRESENTATION_MODES.COMPACT}
    onNavigate={jest.fn()}
    onRemove={jest.fn()}
    showActions
    schedulePopupLayout={jest.fn()}
    getPopup={() => ({})}
  />
  ```

  ```jsx
  <PopupCardStackContent
    records={stackRecords}
    activeRecordId="one"
    presentationMode={MAP_POPUP_PRESENTATION_MODES.COMPACT}
    onNavigate={jest.fn()}
    onRemove={jest.fn()}
    onSelectRecord={jest.fn()}
    schedulePopupLayout={jest.fn()}
    getPopup={() => ({})}
  />
  ```

- [ ] **Step 2: Run the popup DOM suite and confirm compact behavior fails.**

  Run: `node_modules/.bin/jest --config ./jest.dom.config.cjs src/features/map/popupCardContent.test.jsx --runInBand`

  Expected: FAIL because the popup ignores `presentationMode` and still renders full content/actions.

- [ ] **Step 3: Implement the explicit compact card mode.**

  In `PopupCardContent`:

  - import `MAP_POPUP_PRESENTATION_MODES`;
  - add `presentationMode = MAP_POPUP_PRESENTATION_MODES.FULL` and `recordCount = 1` props;
  - derive `isCompact`, `shouldShowDetails`, and `shouldShowActions`;
  - append `popup-card--compact` only in compact mode;
  - set `role="group"` and an `aria-label` containing the heading, location, and shared count in compact mode;
  - suppress the source eyebrow, paragraphs, detail rows, image, and action row in compact mode;
  - render a `popup-card__context-count` paragraph only when `recordCount > 1`.

  The key logic should be:

  ```js
  const isCompact = presentationMode === MAP_POPUP_PRESENTATION_MODES.COMPACT;
  const shouldShowDetails = showDetails && !isCompact;
  const shouldShowActions = !isCompact && showActions && (onNavigate || onRemove);
  const locationLabel = popupView.subtitle || locationRow?.value || "";
  const sharedPlotLabel = recordCount > 1 ? `${recordCount} people at this plot` : "";
  const compactAccessibleLabel = [popupView.heading, locationLabel, sharedPlotLabel]
    .filter(Boolean)
    .join(". ");
  ```

  Keep the title and location rendering shared between both modes so compact and full content cannot drift.

- [ ] **Step 4: Implement compact stack composition.**

  In `PopupCardStackContent`:

  - accept the same `presentationMode` prop with a full default;
  - derive `isCompact`;
  - append `popup-card-stack--compact` in compact mode;
  - omit `PopupCardStackList` in compact mode;
  - pass `recordCount={stackRecords.length}` and `presentationMode` to `PopupCardContent`;
  - preserve the current list, active-person switching, Navigate, Close, and details behavior in full mode.

- [ ] **Step 5: Add restrained compact-popup styling and a CSS contract.**

  Add styles adjacent to the existing popup rules:

  ```css
  .popup-card--compact {
    min-width: 196px;
    max-width: min(240px, calc(100vw - 44px));
    padding: 0.78rem 0.85rem 0.8rem;
  }

  .popup-card__context-count {
    margin: 0.42rem 0 0;
    color: var(--accent-strong);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .leaflet-popup .popup-card--compact,
  .leaflet-popup .popup-card-stack--compact {
    max-height: none;
    overflow: visible;
  }
  ```

  Extend `test/uiAssetContracts.test.js` to read `.popup-card__context-count` and assert it contains `font-variant-numeric: tabular-nums`.

- [ ] **Step 6: Run popup and CSS-contract tests, then commit.**

  Run:

  ```text
  node_modules/.bin/jest --config ./jest.dom.config.cjs src/features/map/popupCardContent.test.jsx --runInBand
  bun test test/uiAssetContracts.test.js
  ```

  Expected: PASS, including all pre-existing full-popup and stack tests.

  Stage:

  ```text
  src/features/map/popupCardContent.test.jsx
  src/features/map/popupCardContent.jsx
  src/index.css
  test/uiAssetContracts.test.js
  ```

  Commit: `feat: add compact map popup context`

## Task 3: Wire popup policy and actionable-only More controls through the app

**Files:**

- Modify: `src/BurialSidebar.test.jsx`
- Modify: `src/BurialSidebar.jsx`
- Modify: `src/Map.jsx`

- [ ] **Step 1: Write sidebar utility-control visibility tests.**

  Add `hasAppMenuActions: false` to `createBaseProps()` in `BurialSidebar.test.jsx`. Add tests that render desktop and mobile variants and assert:

  ```js
  expect(screen.queryByRole("button", { name: /More/i })).not.toBeInTheDocument();
  ```

  Then render each viewport with `hasAppMenuActions: true`, click the desktop `More` button and mobile `More options` icon button, and assert `onOpenAppMenu` is called once for each render.

- [ ] **Step 2: Run the sidebar DOM suite and confirm the hidden-state assertion fails.**

  Run: `node_modules/.bin/jest --config ./jest.dom.config.cjs src/BurialSidebar.test.jsx --runInBand`

  Expected: FAIL because both More controls currently render unconditionally.

- [ ] **Step 3: Gate both Sidebar More controls.**

  Add `hasAppMenuActions = false` to `BurialSidebar` props. Build `desktopMoreButton` and `mobileMoreButton` only when their viewport condition and `hasAppMenuActions` are both true. Give the desktop button class `left-sidebar__more-button`; retain the mobile `aria-label="More options"`.

- [ ] **Step 4: Derive menu availability once in `Map.jsx`.**

  Import `buildAppMenuPresentation` from `sidebarPresentation`. Replace `const appMenuOpen = Boolean(appMenuAnchorEl)` with:

  ```js
  const appMenuPresentation = useMemo(() => buildAppMenuPresentation({
    canClearSavedShareDetails: Boolean(
      isFieldPacketsEnabled && fieldPacket?.selectedRecords?.length
    ),
    canCopyShareLink: Boolean(
      isFieldPacketsEnabled && (
        fieldPacket?.selectedRecords?.length || selectedBurials.length
      )
    ),
    canInstallApp: Boolean(!isInstalled && installPromptEvent),
  }), [
    fieldPacket?.selectedRecords?.length,
    installPromptEvent,
    isFieldPacketsEnabled,
    isInstalled,
    selectedBurials.length,
  ]);
  const appMenuOpen = appMenuPresentation.hasActions && Boolean(appMenuAnchorEl);
  ```

  Pass `hasAppMenuActions={appMenuPresentation.hasActions}` to `BurialSidebar`.

  Render only these enabled items:

  - `Copy share link` when `canCopyShareLink`;
  - `Clear saved share details` when `canClearSavedShareDetails`;
  - `Install on this device` when `canInstallApp`.

  Delete all disabled installed/unavailable/iOS-instruction `MenuItem` branches. Keep iOS Add to Home Screen guidance in the existing notice/share panel instead.

- [ ] **Step 5: Derive popup presentation without creating new selection state.**

  Extend the `mapViewHelpers` import with `MAP_POPUP_PRESENTATION_MODES` and `resolveMapPopupPresentationMode`. Replace the mobile boolean derivation with:

  ```js
  const popupPresentationMode = resolveMapPopupPresentationMode({
    isMobile,
    isSearchPanelVisible,
  });
  const shouldUseMapPopups = popupPresentationMode !== MAP_POPUP_PRESENTATION_MODES.NONE;
  const popupPresentationModeRef = useRef(popupPresentationMode);
  const shouldUseMapPopupsRef = useRef(shouldUseMapPopups);
  ```

  Update both refs in the existing popup-availability effect. Mobile still closes an open popup immediately.

- [ ] **Step 6: Pass mode through React and imperative Leaflet popups.**

  For selected-location React popups, pass `presentationMode={popupPresentationMode}` to `PopupCardStackContent`.

  For tour layers:

  - add `getPresentationMode = () => MAP_POPUP_PRESENTATION_MODES.FULL` to `bindReactPopup`;
  - read the current mode inside `renderPopup`;
  - pass it to `PopupCardContent`;
  - set `showDetails` and `showActions` only for full mode;
  - add `getPresentationMode` to `createOnEachTourFeature` and pass `() => popupPresentationModeRef.current` from `ensureTourLayerLoaded`.

  Use a module-level `WeakMap` from Leaflet layer to `renderPopup`. When `popupPresentationMode` changes and an imperative tour popup is currently open, call its stored renderer and `schedulePopupLayout` so collapsing/restoring the sidebar updates the open card without closing it or clearing reducer focus. Delete the renderer when the layer is removed.

- [ ] **Step 7: Run focused DOM and pure tests.**

  Run:

  ```text
  bun test test/mapViewHelpers.test.js test/browseSidebarPresentation.test.js
  node_modules/.bin/jest --config ./jest.dom.config.cjs src/BurialSidebar.test.jsx src/features/map/popupCardContent.test.jsx --runInBand
  ```

  Expected: PASS.

- [ ] **Step 8: Commit the wiring.**

  Stage:

  ```text
  src/BurialSidebar.test.jsx
  src/BurialSidebar.jsx
  src/Map.jsx
  ```

  Commit: `feat: remove duplicate map actions and inert menus`

## Task 4: Simplify result-card hierarchy and replace abstract UI copy

**Files:**

- Modify: `test/browseResultPresentation.test.js`
- Modify: `src/features/browse/browseResultPresentation.js`
- Modify: `src/BurialSidebar.jsx`
- Modify: `test/browseSidebarPresentation.test.js`
- Modify: `src/features/browse/sidebarPresentation.js`
- Modify: `src/features/browse/BrowseWorkspacePanel.test.jsx`
- Modify: `src/features/browse/BrowseWorkspacePanel.jsx`
- Modify: `test/appProfile.test.js`
- Modify: `src/features/fab/profile.js`
- Modify: `src/BurialSidebar.test.jsx`
- Modify: `src/features/map/mapChrome.test.jsx`
- Modify: `src/features/map/mapChrome.jsx`
- Modify: `test/mapRouting.test.js`
- Modify: `src/features/map/mapRouting.js`
- Modify: `src/Map.jsx`
- Modify: `e2e/app.spec.js`

- [ ] **Step 1: Update result-presentation tests to the approved hierarchy.**

  In `test/browseResultPresentation.test.js`, change the scoped location expectation to `Lot 12 · Tier A · Grave 5` and remove `metadataSummary` from the expected object. Add a global burial case expecting exactly `Section 49 · Lot 12 · Tier A · Grave 5` plus life dates and no duplicate metadata field.

- [ ] **Step 2: Run the result-presentation test and confirm it fails.**

  Run: `bun test test/browseResultPresentation.test.js`

  Expected: FAIL because the helper still uses commas and returns the duplicate metadata eyebrow.

- [ ] **Step 3: Implement one plot line.**

  In `browseResultPresentation.js`:

  - replace `RESULT_METADATA_SEPARATOR` with `RESULT_LOCATION_SEPARATOR = " · "`;
  - join the filtered `buildLocationParts(result)` with the middle-dot separator;
  - delete `shouldShowSectionChip`, `metadataSummary`, and the returned `metadataSummary` key;
  - preserve `secondarySummary` and tour-chip behavior.

  Remove the `presentation.metadataSummary` Typography block from `BrowseResultCard`. Leave the visible hierarchy as name, location, supporting detail/life dates, then state/tour chips.

- [ ] **Step 4: Write exact copy expectations before changing production text.**

  Update or add focused expectations for:

  - `test/appProfile.test.js`: `Loading cemetery map…`;
  - `test/browseSidebarPresentation.test.js`: `Preparing search…`, the concise offline notice, and `In Safari, use Add to Home Screen to save this map.`;
  - `BrowseWorkspacePanel.test.jsx`: `Choose a tour to follow its stops.`;
  - `BurialSidebar.test.jsx`: `Share this map`, `Copy a link to these records and this map view.`, and the revised Safari sentence;
  - `mapChrome.test.jsx`: `Calculating route…` for an active calculation with no more-specific notice;
  - `mapChrome.test.jsx`: `On-site navigation will start when you arrive.` when that notice is supplied;
  - `test/mapRouting.test.js`: direct directions/on-site error copy where the old burial-specific or “Continue with Maps for now” text was asserted;
  - `e2e/app.spec.js`: replace readiness checks for `Preparing fast search…` and `Starting on-site navigation...` with the revised strings.

- [ ] **Step 5: Run the copy-owning tests and confirm they fail.**

  Run:

  ```text
  bun test test/appProfile.test.js test/browseSidebarPresentation.test.js test/mapRouting.test.js
  node_modules/.bin/jest --config ./jest.dom.config.cjs src/BurialSidebar.test.jsx src/features/browse/BrowseWorkspacePanel.test.jsx src/features/map/mapChrome.test.jsx --runInBand
  ```

  Expected: FAIL on the old copy.

- [ ] **Step 6: Apply the approved plain-language copy.**

  Make these exact replacements in their owning modules:

  | Owner | Revised text |
  | --- | --- |
  | `profile.js` | `Loading cemetery map…` |
  | `sidebarPresentation.js` | `Preparing search…` |
  | `sidebarPresentation.js` | `Offline. Cached searches and cemetery layers may still work; maps, links, and GPS can be limited.` |
  | `sidebarPresentation.js` | `In Safari, use Add to Home Screen to save this map.` |
  | `BrowseWorkspacePanel.jsx` | `Choose a tour to follow its stops.` |
  | `BurialSidebar.jsx` | `Share this map` |
  | `BurialSidebar.jsx` | `Copy a link to these records and this map view.` |
  | `BurialSidebar.jsx` | `In Safari, use Add to Home Screen to save this map.` |
  | `mapChrome.jsx` | `Calculating route…` |
  | `Map.jsx` / `mapRouting.js` | `Directions aren’t available for this record.` |
  | `Map.jsx` | `Opening driving directions…` |
  | `Map.jsx` | `On-site navigation will start when you arrive.` |
  | `Map.jsx` | `Starting on-site route…` |
  | `Map.jsx` route fallback | `On-site route unavailable. Opening driving directions…` |
  | `profile.js` route-location fallback | `On-site navigation will start when you arrive.` |
  | `mapRouting.js` out-of-range error | `On-site route unavailable. Try Navigate again.` |

  In `Map.jsx`, define constants for the repeated navigation strings near the existing route constants and replace all four missing-coordinate status branches. Keep `window.open` inside the trusted click and do not move, await, or wrap the external handoff.

  In `mapRouting.js`, change only user-visible error strings; do not alter snapping, graph, or fallback logic.

- [ ] **Step 7: Run all focused result/copy tests and commit.**

  Run:

  ```text
  bun test test/browseResultPresentation.test.js test/appProfile.test.js test/browseSidebarPresentation.test.js test/mapRouting.test.js
  node_modules/.bin/jest --config ./jest.dom.config.cjs src/BurialSidebar.test.jsx src/features/browse/BrowseWorkspacePanel.test.jsx src/features/map/mapChrome.test.jsx --runInBand
  ```

  Expected: PASS.

  Stage only the files listed in Task 4.

  Commit: `refactor: simplify map copy and result hierarchy`

## Task 5: Apply restrained HIG-inspired visual details

**Files:**

- Modify: `src/BurialSidebar.jsx`
- Modify: `src/features/map/mapChrome.jsx`
- Modify: `src/index.css`
- Modify: `test/uiAssetContracts.test.js`

- [ ] **Step 1: Add static visual-contract assertions.**

  Extend `test/uiAssetContracts.test.js` to assert:

  - `.left-sidebar__more-button.MuiButton-root` contains `min-height: 40px`;
  - `.route-status-overlay__content` contains `font-variant-numeric: tabular-nums`;
  - `.mobile-sheet-header__icon-button.MuiIconButton-root` names `background-color` and `scale` in `transition-property`;
  - the stylesheet contains no `transition: all` declaration.

- [ ] **Step 2: Run the CSS contract test and confirm it fails.**

  Run: `bun test test/uiAssetContracts.test.js`

  Expected: FAIL on the new selectors/properties.

- [ ] **Step 3: Improve hierarchy and feedback without redesigning the shell.**

  In `BurialSidebar.jsx`:

  - add semantic result-copy classes to the name, location, secondary, and life-date Typography elements;
  - replace the empty-result informational gradient with a solid translucent neutral surface;
  - replace the shared-link informational gradient with a solid accent-tinted surface;
  - keep primary-button gradients because they identify actions rather than decorate an informational panel.

  In `mapChrome.jsx`, give the route message wrapper class `route-status-overlay__content`.

  In `index.css`:

  ```css
  .left-sidebar__more-button.MuiButton-root {
    min-height: 40px;
    border-radius: 12px;
    transition-property: background-color, color, scale;
    transition-duration: 150ms;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }

  .left-sidebar__more-button.MuiButton-root:active,
  .mobile-sheet-header__icon-button.MuiIconButton-root:active {
    scale: 0.96;
  }

  .left-sidebar__result-name {
    text-wrap: balance;
  }

  .left-sidebar__result-location,
  .left-sidebar__result-supporting {
    text-wrap: pretty;
  }

  .route-status-overlay__content {
    font-variant-numeric: tabular-nums;
  }
  ```

  Add `transition-property: background-color, scale`, a 150ms duration, and the existing motion curve to the mobile header icon button. Do not add `will-change` or a broad transition. The existing reduced-motion rule must remain the final override.

- [ ] **Step 4: Run CSS and DOM regressions, then commit.**

  Run:

  ```text
  bun test test/uiAssetContracts.test.js
  node_modules/.bin/jest --config ./jest.dom.config.cjs src/BurialSidebar.test.jsx src/features/map/mapChrome.test.jsx --runInBand
  ```

  Expected: PASS.

  Stage:

  ```text
  src/BurialSidebar.jsx
  src/features/map/mapChrome.jsx
  src/index.css
  test/uiAssetContracts.test.js
  ```

  Commit: `style: refine map hierarchy and interaction feedback`

## Task 6: Lock the desktop/mobile flows in Playwright

**Files:**

- Modify: `e2e/app.spec.js`

- [ ] **Step 1: Update the desktop search-selection test for one authoritative action surface.**

  In `searching for a burial opens the map popup and external maps popup`:

  - assert the Leaflet popup is visible and has `popup-card--compact`;
  - retain the name and plot assertions;
  - assert the popup has no Navigate, Close, or Details control;
  - trigger `expectExternalMapsNavigation` from the sidebar selected-summary Navigate button instead of the popup.

- [ ] **Step 2: Add a desktop full-popup fallback test.**

  Search for and select LaMont, collapse the sidebar, then assert:

  - `.left-sidebar--desktop` is absent;
  - the open popup no longer has `popup-card--compact`;
  - full popup Navigate and Close buttons are visible;
  - the map Search control restores the sidebar.

  This test must not click Close because that changes the selection and would test a separate behavior.

- [ ] **Step 3: Add actionable-only utility-menu coverage.**

  On initial desktop and initial 390×844 mobile states, assert no More/More options button exists. After selecting a burial with field packets enabled, assert More appears, opens a menu with enabled `Copy share link`, and contains none of the removed installed/unavailable disabled rows.

- [ ] **Step 4: Update tour and deep-link popup assertions.**

  Keep the existing selection/sidebar assertions. Add `popup-card--compact` and no-action assertions while the desktop sidebar is visible. Preserve the tour source label only in full/sidebar-hidden presentation; compact tour context should be carried by the selected sidebar rather than the map card.

- [ ] **Step 5: Preserve mobile place mode and hit-target coverage.**

  Keep the existing tests for:

  - no Leaflet popup;
  - one selected-location marker and plot count;
  - Back to results;
  - person switching;
  - Navigate and Details;
  - Details expansion/collapse;
  - short-phone visibility and 44px targets.

  Add an initial-state no-More assertion before making a selection. Do not change sheet snap points or geometry thresholds.

- [ ] **Step 6: Run the focused Playwright flows.**

  Run:

  ```text
  bun run test:e2e -- --grep "searching for a burial|full popup|utility menu|tour browsing|deep links|short shared plot|one shared plot|short phones"
  ```

  Expected: PASS on the default 1440×960 desktop and configured 390×844 mobile contexts.

- [ ] **Step 7: Commit browser coverage.**

  Stage: `e2e/app.spec.js`

  Commit: `test: cover refined map navigation surfaces`

## Task 7: Full verification and rendered QA

**Files:**

- Verify all modified files
- Do not modify generated data because no source dataset changes are part of this plan

- [ ] **Step 1: Check patch hygiene and exact stale-copy removal.**

  Run: `git diff --check`

  Run:

  ```text
  rg -n "Loading map experience|Preparing fast search|Switch to one curated|Share Link|Send someone straight|Or save it to your Home Screen|Directions unavailable for this burial|Starting on-site navigation|Continue with Maps for now|App install unavailable|App installed on this device" src test e2e
  ```

  Expected: no old user-facing copy remains. If a legacy phrase is intentionally retained in a migration fixture, document why before proceeding.

- [ ] **Step 2: Run the full default validation gate.**

  Run: `bun run check`

  Expected: doctor, lint, release metadata, Bun tests, and Jest DOM tests all PASS.

- [ ] **Step 3: Build the production bundle.**

  Run: `bun run build`

  Expected: PASS with the `/fab` public path intact and no new bundle/runtime warnings attributable to these changes.

- [ ] **Step 4: Run the complete browser suite.**

  Run: `bun run test:e2e`

  Expected: PASS, including search, section, tour, deep-link, external directions, on-site routing, and mobile sheet flows.

- [ ] **Step 5: Perform desktop rendered QA in the in-app Browser.**

  Start the app on an unused local port, for example:

  ```text
  PORT=3010 FAB_IMAGE_SERVER_PORT=8010 bun run start
  ```

  Open `http://127.0.0.1:3010/fab` and verify:

  1. initial More is absent;
  2. search cards show one middle-dot plot line;
  3. selection produces a compact popup and authoritative sidebar actions;
  4. More appears only after a share/install command is actionable;
  5. sidebar collapse restores the full popup;
  6. section selection, section marker selection, tour stop selection, and a restored deep link still resolve to the same record;
  7. keyboard focus is visible and map controls remain usable;
  8. console contains no unexplained app error or framework overlay.

  Capture screenshots of initial, compact-selection, and collapsed/full-popup states.

- [ ] **Step 6: Perform 390×844 mobile rendered QA.**

  In the same app session, emulate a 390×844 touch viewport and verify:

  1. initial More is absent and the header remains aligned;
  2. search opens results without duplicated plot metadata;
  3. selecting a shared plot opens no Leaflet popup;
  4. Back to results, person selector, Navigate, Details, and collapse behavior remain intact;
  5. icon controls and actions have at least 44×44px hit areas;
  6. safe-area placement and sheet/map balance remain correct;
  7. reduced-motion emulation removes meaningful transition duration;
  8. console contains no unexplained app error.

  Capture screenshots of initial, selected-place, and Details-expanded states.

- [ ] **Step 7: Review the final diff for scope and performance regressions.**

  Confirm that the diff introduces no new dependency, no new global event listener, no data regeneration, no route-algorithm change, no public URL/query change, no `transition: all`, and no `will-change: all`.

  Run: `git status --short --branch`

  Expected: only intended tracked changes/commits plus the user's pre-existing untracked `.agents/` and `skills-lock.json`.

- [ ] **Step 8: Final implementation commit only if verification required a tracked correction.**

  If QA found and fixed a real issue, stage only those named files and commit `fix: finish map UI navigation refinement`. If no correction was needed, do not create an empty commit.

## Completion report

Report:

- the desktop compact/full popup behavior;
- the unchanged mobile place-sheet behavior;
- actionable-only More behavior;
- result-card and copy changes;
- routing contract preservation;
- exact validation commands and outcomes;
- desktop/mobile rendered QA evidence;
- any expected warning that remains, with its source and why it is safe.
