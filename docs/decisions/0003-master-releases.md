# 3. Alerts for "any pressing" on master pages

Date: 2026-11-24 · Status: accepted

## Context

Discogs alerts only fire for releases in the wantlist, and saved searches have no master filter. Many collectors want "any vinyl copy of this album".

## Decision

- On master pages, fetch the versions from the public API (`api.discogs.com/masters/{id}/versions`, no token, CORS allowed), group by format, default to vinyl.
- Step 1 points at Discogs' own "Add to Wantlist ▾ → Add all versions" menu (we do not add versions ourselves).
- Step 2 opens "Items I Want" with one `release` filter per chosen version, oldest first, capped so the alert stays within Discogs' 100-filter limit (user preferences are kept first). A notice explains the cap.

## Consequences

- Alerts only cover versions the user actually put in their wantlist: explained in the card.
- Albums with more than about 90 versions in one format are covered partially. Acceptable for v1.
