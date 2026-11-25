# Discogs facts Crate Bell relies on

Observed on the live site on 2026-11-24, logged in, English UI. When something here changes, update `src/lib/discogs/` and `tests/fixtures/` together.

## Release page `/release/{id}-{slug}` (also `/de/release/…`, `/fr/…`, `/ja/…`)

- Right column: `aside` with sections `#release-actions`, a div with `#shopping-box-host` (For Sale), `#release-stats`, a rating block, then a block (`div.wrapper_*`) holding:
  - `div.buttons_*` with two buttons: "Add to Collection" and "Add to Wantlist" / "Remove from Wantlist";
  - once in the wantlist: `div.box_* wantlist_*` "In Wantlist · Added … · Remove · Notes".
- The button labels stay in English in every locale tested (de, fr, ja).
- Icons: eye path starts `M951 549` (add), minus path starts `M805 421` (remove).
- Clicking Discogs' button updates the page within about 20 ms (optimistic UI). No confirm dialog on remove.
- Buttons render after hydration: wait for them.
- Structured data: `script#release_schema` (JSON-LD, `name`, `releaseOf.byArtist[].name`). Artist names can end in " (17)" (Discogs disambiguation).
- Other "Want" buttons exist in recommendation cards (`aria-label="Add to wantlist"`): never use those.

## Master page `/master/{id}-{slug}`

- `aside`: `#master-actions`, For Sale box, `#master-statistics`, `#audio`, …
- `section#versions` with "108 versions" and an "Add to Wantlist ▾" menu: "Add all versions to Wantlist" / "Remove all versions from Wantlist".
- Structured data: `script#master_schema` with an `@graph` holding a `MusicAlbum`.
- Versions are available without login from `https://api.discogs.com/masters/{id}/versions?per_page=100&page=n` (CORS allowed, fields `id`, `major_formats`, `released`, `country`).

## "Items I Want" page `/shop/mywants/` (the Wantlister)

- A separate React app (Radix UI, Tailwind). Desktop and mobile layouts are both in the DOM: pick the visible element.
- URL filters (any number, repeated keys allowed): `release`, `artist`, `seller`, `shipsFrom`, `format`, `formatDescription`, `mediaCondition`, `sleeveCondition`, `hideGenericSleeves=true`, `hideSleevelessMedia=true`, `priceBucket`, `priceRangeLow`, `priceRangeHigh`, `currency`, `isDeal`, `allowsOffers`, `sellerRatingMin`, `sellerRatingCountMin`, `genre`, `style`, `yearRangeLow`, `yearRangeHigh`, `listedWithinHours`, `showUnavailable`.
- Condition values are the full labels: `Mint (M)`, `Near Mint (NM or M-)`, `Very Good Plus (VG+)`, `Very Good (VG)`, `Good Plus (G+)`, `Good (G)`, `Fair (F)`, `Poor (P)`.
- Ships From values are country names as Discogs spells them (`United States`, `United Kingdom`, `Slovak Republic`, `European Union`, …).
- Several `release` values work: the page shows one chip per release.
- Limits (from Discogs' own messages): **100 filters per saved search** (the page shows "Applied Filters (108/100)" in red), **300 saved searches**, **30 with Daily Digest**, **name up to 100 characters**, **names must be unique**.
- Hooks: `[data-test="button-save-search"]`, `select[data-test="saved-searches"]` (native select, option values are ids), `[data-test="input-filter-name"]` / `#save-search-name`, `[data-test="button-drawer-save-search"]`.
- Save form: Radix sheet `[role="dialog"][data-slot="sheet-content"]` on the left. Default name "My Saved Search N". Greyed "Personal email (address)" checkbox mirrors the global setting, with a "notification-settings" link. Radios `name="notification-preference"`: `digest` (default), `realtime`, `no`.
- Selecting a saved search shows "Update Search", "Save As New", "Delete" (Delete asks in an in-page modal, not a browser dialog).
- Error screen: `h1` "Put on a record; we'll be right back." (seen briefly during discovery).
- Setting the name through the native value setter plus an `input` event, and clicking the radio, are picked up by React (verified live).

- Saved searches menu: `select[data-test="saved-searches"]` labelled by `p#saved-searches` ("9 Saved Searches"). The label count equals the number of entries once loaded.
- Picking a saved search applies its filters to the address (`?release=…&…`) and shows "Update Search", "Save As New", "Delete". Delete shows an inline box "Are you sure you want to delete this saved search?" with Cancel and Delete; confirming removes the entry from the menu.

## Wantlist page `/mywantlist`

- Server-rendered, 25 per page by default, full page loads between pages.
- Layouts, remembered per account by Discogs (`?layout=med|sm|big`): "Text With Covers" (`med`, default) and "Text Only" (`sm`) are a table with rows `tr.wantlist_r{releaseId}`, a checkbox `input[name="cw_releases"][value={id}]`, and `td.artist_title` holding `.release_title a[href*="/artist/"]` and `.release_title_link a` (title). The large cards layout (`big`) is `ul#wantlist > li.card[data-object-type="release"][data-object-id]` with `a.search_result_title` and `.card-artist-name a`.
- The artist/title cell is clickable (`data-followable`): it opens the record.

## Marketplace listing `/shop/item/{listingId}` (also `/sell/item/…`)

- Newer "hifi" React layout. The wantlist toggle is `button.hifi-wantlist-button-toggle`, text "Add to Wantlist" or "In Wantlist", inside `div.flex.items-center.gap-2` under the green "Add to Cart" button.
- Title and artist are `a.hifi-heading-link`; the title link points to `/release/{id}-{slug}`, which gives the release id.
- Buttons here are 36px high, flat `#eee` fill, 4px corners, medium weight (release pages: 38px, `#f5f4ec` fill, 1px `#cecdc6` frame).

## Notification settings `/settings/notifications`

- Server-rendered form (`POST /settings/notifications`), readable with a same-origin `fetch`.
- "When a release in my wantlist is listed for sale": `input[type=checkbox][name=email][value="5"]` in the Personal Email column. The Notifications (bell) column is empty for this line: email is the only channel.

## Open questions

- Whether the "Items I Want" app is translated on /de/, /fr/… paths. Default-name detection ("My Saved Search N"), the error texts and the "right back" screen are matched in English only. If the page is translated, Crate Bell keeps the user's name, says so, and only the error explanations are lost.
- The real delay between "Save Search" and the refreshed Saved Searches list. The guide shows "Checking with Discogs…" for 2.5 s and keeps looking for 8 s.
- Whether Discogs' pages are restored from the back/forward cache (the record card resets on `pageshow` either way).

- Logged-out markup of the release page header (assumed: a `/login` link in `header`).
- Whether a saved search disappears when its only release leaves the wantlist. Observed: a saved search whose release is not listed still loads with its chip, so it most likely stays. The guide says so.
