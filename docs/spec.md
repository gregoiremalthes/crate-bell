# Crate Bell: product spec

Status: v1.0 built, in owner testing. Owner: Grégoire (gregoiremalthes).

## Problem

Discogs can email collectors when a record from their wantlist goes on sale, but setting it up takes a hidden global setting, a separate "Items I Want" page, a filter panel, a "Save Search" form, a name and a frequency choice. Collectors who are not tech savvy (many are 50+) give up or never find it, and miss records they have wanted for years.

The number of clicks is not the main problem. Understanding is: people do not know the setting exists, do not know what a "saved search" is, and do not know how alerts stop.

## Who it is for

- **Marc, 58, collects soul 45s.** Uses Discogs weekly to look up records, rarely buys online, gets lost in menus. Wants: "tell me when it shows up".
- **Grégoire, power user.** Large wantlist, buys often, wants realtime alerts on rare records with condition and country filters, without the 8-click routine.

## What it does

1. **Record page (release).** Under Discogs' own "Add to Collection / Wantlist" buttons, one pink button:
   - not in the wantlist: "Alert me when it's for sale" adds it to the wantlist with Discogs' own button, then opens the alert page;
   - in the wantlist: "Set a sale alert" opens the alert page;
   - just added with Discogs' button: the button gently moves and says "Added to your wantlist. Want an email when a copy is for sale?";
   - logged out: "Log in to Discogs to set sale alerts".
2. **Album page (master).** A card "Want any pressing of this album?": pick formats (vinyl by default), see where Discogs' "Add all versions to Wantlist" menu is, then set one alert covering all those pressings.
3. **Alert page ("Items I Want").** A guide panel: points at "Save Search" with a pink ring, fills in the alert name and the email frequency in Discogs' form, points at the final "Save Search", then confirms and explains how the alert will stop. It never saves for the user. Discogs' limits and errors are explained in plain words.
4. **Notification settings page.** The one line that matters is highlighted, with a hint; Crate Bell remembers whether it is on.
5. **Popup.** Email status (on, off, unknown) with a fix button, the two main preferences, links to the guide.
6. **Guide page** (opens at install, also the options page): three steps (turn on emails, set an alert, remove an alert), preferences, questions.

## User stories and acceptance criteria

**US1: set an alert from a record page.**

- Given a release in my wantlist, when I click "Set a sale alert", then `https://www.discogs.com/shop/mywants/?release=<id>` opens, plus my usual filters.
- Given a release not in my wantlist, when I click "Alert me when it's for sale", then Discogs' own wantlist button is clicked, and once Discogs shows it in the wantlist (8 s timeout) the alert page opens. On timeout, an error says to check I am logged in.
- The card appears right after the block holding Discogs' wantlist button; if that block is not found, after "Statistics"; if nothing is found, as a floating card.

**US2: finish on Discogs' alert page.**

- Arriving from US1 within 10 minutes with the same release filters, the guide shows "Almost there" and rings "Save Search".
- When Discogs' save form opens, the name is replaced only if it is Discogs' default ("My Saved Search N"), made unique against my saved alerts, and the frequency radio matches my preference.
- When the form closes and the new name appears in "Saved Searches", the guide says the alert is set. Cancelling brings back step 1.
- Discogs errors (30 daily digests, 100 filters, 300 saved searches, name too long, name taken) are explained.
- If Discogs' page fails ("Put on a record; we'll be right back."), the guide says so and offers to reload.

**US3: any pressing (master).** Versions come from the public Discogs API; formats are grouped with counts; the alert URL holds every chosen version id, oldest first, capped so the alert stays under 100 filters, with a notice when capped.

**US4: emails.** The status is read from `/settings/notifications` (`input[name=email][value=5]`), at most every 6 hours while browsing, and on demand. When off, the record page card and the popup say so and link to the setting.

**US5: remove an alert.** The guide page and the alert page explain: alerts stop when the record leaves the wantlist (for example added to the collection from the feedback screen); the saved alert stays until deleted from "Saved Searches" with "Delete".

**US6: preferences.** Frequency (default realtime), minimum record and sleeve condition, hide generic sleeves, seller rating, ships from (with a European Union shortcut). Saved locally, applied to every alert URL.

## Non-goals (v1)

- Clicking "Save" for the user, or creating saved searches through Discogs' private API.
- Our own notifications (polling the marketplace): Discogs already sends them; duplicating would need tokens, servers and rate-limit care.
- Price filters (currency handling on Discogs' side is not verified yet).
- Firefox and Safari builds (WXT makes them cheap: planned after launch).

## Success measures (no tracking: from the Chrome Web Store dashboard and feedback)

| Measure                  | Target 3 months after launch | Source          |
| ------------------------ | ---------------------------- | --------------- |
| Weekly active users      | 500                          | Store dashboard |
| Rating                   | 4.5 or more                  | Store reviews   |
| Uninstalls within 7 days | under 20%                    | Store dashboard |
| "It broke" reports fixed | within 7 days                | GitHub issues   |
| Coffees                  | any is a win                 | Ko-fi           |
