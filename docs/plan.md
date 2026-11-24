# Crate Bell: step-by-step plan

Each phase ends with something you can check. Status as of 2026-11-24.

## Phase 0. Decide (done)

- Challenge the idea: the value is in guiding the "Items I Want" page, not only in a shortcut. One smart button instead of two. Pre-fill instead of redirect. Never save for the user. Masters included.
- Decisions recorded in `docs/decisions/` (framework, no auto-save, masters, privacy, design).

## Phase 1. Discovery on live Discogs (done)

- Inspect release, master, "Items I Want" and settings pages in a logged-in Chrome.
- Record stable hooks, URL parameters and limits in `docs/discovery.md`.
- Save reduced page copies as test fixtures (`tests/fixtures/`), without personal data.

## Phase 2. Spec and design (done)

- `docs/spec.md`: personas, user stories, acceptance criteria, non-goals, measures.
- UI in the Highlighter system: pink primary button, square cards with 2px black strokes, Fraunces titles, DM Sans text, pink Disc illustrations, no emoji.

## Phase 3. Project setup (done)

- WXT + TypeScript strict, no UI framework, Biome, Vitest (happy-dom), Playwright.
- `AGENTS.md` (rules only) and `CLAUDE.md` pointing to it.
- GitHub Actions: `ci.yml` (lint, typecheck, unit, build, e2e, zip artifact), `release.yml` (tag `v*` → zip attached to a GitHub release), `smoke.yml` (weekly check that Discogs' public pages still have our anchors).

## Phase 4. Build (done)

1. `src/lib/discogs/`: the only place that knows Discogs (selectors, URLs, limits, master versions).
2. Content script router (`src/entrypoints/discogs.content`) for release, master, "Items I Want" and settings pages, with UIs in shadow roots.
3. Popup and guide page (`src/entrypoints/popup`, `src/entrypoints/options`).
4. Translations en, fr, de in `locales/`.

## Phase 5. Quality (done, keep doing)

- 68 unit tests (selectors on fixtures, URLs, limits, names, storage, email check, translations including house style).
- 11 end-to-end tests: built extension in Chromium, Discogs pages served from fixtures with a small simulator of Discogs' scripts.
- Live probe on discogs.com: detection, anchor and form pre-fill verified on the real pages (nothing saved).
- Independent review by a separate agent: 13 findings, all fixed (false success after Cancel, late list refresh, focus loss, unconfirmed wantlist add, Back button state, per-tab pending alerts, email check timing, plurals, contrast).
- Accessibility: 48px targets, visible focus rings, `role=status/alert` on changing messages, reduced motion respected, text contrast from Highlighter tokens (black on pink 10.5:1).

## Phase 6. Your test drive (next: you)

1. Download `crate-bell-1.0.0-chrome.zip` from the latest GitHub Actions run (or `pnpm zip`), unzip it.
2. Chrome → `chrome://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder.
3. Try: a release in your wantlist, one that is not, a master page, the guide page, the popup. Save one real alert, then delete it.
4. Report anything odd as a GitHub issue (template "Discogs changed something" or "Bug").

## Phase 7. Chrome Web Store launch (when you are happy)

1. Create the developer account: <https://chrome.google.com/webstore/devconsole> (one-time 5 USD fee, Google account, 2-step verification required).
2. Turn on GitHub Pages for this repo: Settings → Pages → Deploy from a branch → `main` / `docs`. The privacy policy is then at `https://gregoiremalthes.github.io/crate-bell/privacy.html`.
3. New item → upload the zip from the `v1.0.0` GitHub release.
4. Store listing: copy from `docs/store/listing.md` (English, then French and German), category "Shopping" (or "Tools"), screenshots and promo tile from `store-assets/`.
5. Privacy tab: single purpose and permission justifications from `docs/store/listing.md`; declare that no user data is collected; privacy policy URL from step 2.
6. Submit for review (usually a few days). Answer reviewer questions with `docs/store/listing.md`.
7. Edge Add-ons (free, same zip): <https://partner.microsoft.com/dashboard/microsoftedge>.

## Phase 8. After launch

- Weekly smoke test watches Discogs' public pages; fix within a week when it fails.
- Automated publishing: add `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` secrets and use `wxt submit` in `release.yml`.
- Next ideas, by expected value: price filter once currency is verified; Firefox build; "you already have an alert for this record" badge on release pages; bulk alerts for a whole list.
