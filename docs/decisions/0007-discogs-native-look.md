# 7. Discogs-native look on Discogs, Highlighter elsewhere

Date: 2026-11-25 · Status: accepted · Amends [0005](0005-design-highlighter.md)

## Context

Bright pink, 48px, 2px-stroke buttons stood out too much next to Discogs' own controls. Feedback asked for something "integrated, almost demure".

## Decision

- Inside Discogs pages (shadow roots), Crate Bell matches Discogs' measured button style: release pages 38px, `#f5f4ec` fill, 1px `#cecdc6` frame, 4px corners, 14px Helvetica Neue; marketplace listings 36px flat `#eee`.
- Pink stays as a signal only: hover, focus ring, the dot on "Alert on" tags, the ring pointing at the next click on Discogs' alert page.
- The popup, guide page and goodbye page keep the full Highlighter system from 0005.
- The new colours are Discogs-matching values kept in `content.css` as `--d-*` custom properties, not new brand colours.

## Consequences

- If Discogs restyles its buttons, update the `--d-*` values and `docs/discovery.md`.
- Pink-button wording in copy was replaced by the button's label.
