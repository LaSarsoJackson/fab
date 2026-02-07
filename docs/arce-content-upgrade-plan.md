# ARCE Content Upgrade Plan (for `fab` + `FABFG`)

Last reviewed: 2026-02-07

## Live site baseline reviewed

- https://www.albany.edu/arce/
- https://www.albany.edu/arce/Locate_Burials&Graves.html
- https://www.albany.edu/arce/Biographies.html
- https://www.albany.edu/arce/feedback.html

## Content and UX gaps observed

1. Landing copy quality and trust
- Homepage hero includes a typo ("cemetary") and inconsistent title casing.
- Primary calls to action are split across many legacy pages, creating decision friction.

2. Information architecture
- Burial search, tours, biographies, and help content are distributed across separate pages with inconsistent labels.
- Similar tasks are described differently between pages, making onboarding harder.

3. Biography content experience
- Long A-Z list is difficult to scan on mobile and lacks modern filtering/sorting affordances.
- Entry quality appears inconsistent (variable metadata and image quality).

4. Mobile and installability
- Legacy pages are not presented as one coherent installable app flow.
- Native companion app currently embeds separate URLs, which increases maintenance and inconsistency.

5. Help and support flow
- Tutorial/help paths are hard to find from the primary journey.
- Feedback collection is disconnected from context (users leave workflow to submit comments).

## Upgrade strategy

1. Consolidate entry points
- Route all primary journeys through one installable PWA shell (`fab`).
- Keep deep links for "Burials" and "Tours" so native tabs can map to task-specific starts.

2. Modernize shell and navigation content
- Present a single map-first interface with clear labels and states.
- Surface install state, online/offline status, and data readiness in-app.

3. Keep legacy pages as reference, not primary workflow
- Preserve links to legacy info pages where content still has value.
- Prioritize migration of high-value content into PWA-native cards/search over time.

4. Native companion alignment
- Point `FABFG` tabs at PWA deep links to eliminate duplicate URL maintenance.
- Use one shared hosted-experience component for web and native wrappers.

## Executed in this iteration

- Added asynchronous loading of heavy burial dataset in `fab` to improve initial render behavior.
- Added PWA install/offline plumbing in `fab` (manifest updates + service worker registration).
- Added URL query state support (`view`, `tour`, `section`, `q`) in `fab` for deep links.
- Refreshed `fab` visual shell and responsive sidebar for better mobile readability.
- Created centralized URL constants in `FABFG` and repointed tabs to PWA endpoints.
- Replaced duplicated iframe/webview implementations in `FABFG` with shared hosted experience components.

## Next content migration candidates

1. Convert biography A-Z into searchable cards with normalized metadata fields.
2. Convert tutorial/how-to pages into in-app guided tips with screenshots.
3. Add contextual feedback action from map/search results panels.
4. Standardize naming and copy style across all tour labels and section descriptions.
