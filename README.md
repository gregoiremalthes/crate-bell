<p align="center"><img src="public/icon/128.png" width="96" alt="" /></p>

# Crate Bell

**Sale alerts for Discogs, made simple.** One pink button on every record page: click it, and Discogs emails you when a copy goes on sale.

Discogs already sends these emails, but setting one up takes a hidden setting, a separate page, filters, a form, a name and a frequency. Crate Bell turns that into a guided, three-click flow that a collector who is not into computers can follow.

- **Record pages:** "Set a sale alert", or "Alert me when it's for sale" (adds the record to your wantlist first).
- **Album pages:** one alert for every pressing you would accept, for example all vinyl versions.
- **Discogs' alert page:** a guide that points at the right button, fills in the alert name and email frequency, and confirms when it is saved. You always click Save yourself.
- **Alert status:** once an alert exists, the record page says "Sale alert on" (or "paused" if the record left your wantlist) and guides its deletion.
- **Wantlist page:** a small "Set alert" button on every record, an "Alert on" tag where one exists.
- **Email check:** tells you when the one Discogs setting alerts need is off, and takes you there.
- **Your usual filters, set once:** condition, sleeve, generic sleeves, seller rating, ships from.
- English, French, German. No account, no ads, no tracking. Not affiliated with Discogs.

Website: <https://gregoiremalthes.github.io/crate-bell/> · Feedback: <https://forms.gle/gs8Y3k1JSijNJEuB6> · Privacy: [PRIVACY.md](PRIVACY.md) · Support the project: <https://ko-fi.com/gregoirep>

## Install

Chrome Web Store: coming soon. Meanwhile:

1. Download `crate-bell-x.y.z-chrome.zip` from the [latest release](https://github.com/gregoiremalthes/crate-bell/releases/latest) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, choose the unzipped folder.

## Develop

Requirements: Node 22+, pnpm 10.

```bash
pnpm install
pnpm dev          # Chrome opens with the extension loaded and reloads on change
pnpm check        # lint + typecheck + unit tests
pnpm build && pnpm test:e2e   # end-to-end tests (Playwright, Discogs pages served from fixtures)
pnpm zip          # .output/crate-bell-x.y.z-chrome.zip, ready for the Chrome Web Store
```

If Playwright's own Chromium is not installed, point the tests at any Chrome for Testing build: `CHROME_PATH=/path/to/chrome pnpm test:e2e`.

### How the code is organised

```
src/
  entrypoints/
    discogs.content/   one content script for www.discogs.com, routes by page
    background.ts      opens the guide at install, goodbye page on uninstall
    popup/             email status, quick preferences, links
    options/           the guide: emails, set an alert, remove an alert, preferences, questions
  lib/
    discogs/           everything we know about Discogs' pages (selectors, URLs, limits)
    features/          release, master, Items I Want and settings page UIs
    pages/             pieces shared by popup and guide
    ui/                tiny DOM helper, icons, spotlight
  assets/              Highlighter design tokens and styles
locales/               en, fr, de translations (source of public/_locales)
tests/                 unit tests, end-to-end tests, Discogs page fixtures
docs/                  spec, plan, discovery notes, decisions, store listing, website
```

Read [AGENTS.md](AGENTS.md) for the rules, [docs/spec.md](docs/spec.md) for the behaviour and [docs/discovery.md](docs/discovery.md) for the Discogs facts we depend on.

### When Discogs changes its pages

Something stops showing? Open an issue with the "Discogs changed something" template. Fixes go in `src/lib/discogs/` with updated fixtures in `tests/fixtures/`. A weekly GitHub Action checks Discogs' public pages for the anchors we use.

## License

MIT. Fonts: Fraunces and DM Sans, SIL Open Font License (see `public/fonts/`).

Crate Bell is an independent tool. It is not affiliated with, or endorsed by, Discogs.
