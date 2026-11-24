# 4. No data collection, two permissions

Date: 2026-11-24 · Status: accepted

## Decision

- Permissions: `storage`, host `https://www.discogs.com/*`. Nothing else.
- Requests go only to www.discogs.com (pages the user visits, the notification settings page) and api.discogs.com (master versions, public data). The settings page is read to know if alert emails are on.
- Preferences, the email status and a counter of alerts set are stored in `chrome.storage.local` and never leave the browser.
- No analytics. Success is measured with the Chrome Web Store dashboard and an optional goodbye page (no data in its URL).
- Fonts are bundled (SIL Open Font License), never loaded from a CDN.

## Consequences

We cannot see funnels. We accept it: trust is the product.
