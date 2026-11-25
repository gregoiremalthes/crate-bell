# 2. Prepare everything, never click Save

Date: 2026-11-24 · Status: accepted

## Context

Crate Bell could create saved searches through Discogs' private API or click "Save Search" itself.

## Decision

Crate Bell opens Discogs' own page with filters in the URL, fills in the name and frequency in Discogs' own form, and points at the button. The user clicks Save.

## Why

- The user stays in control of their account: important for trust, and for a 50+ audience wary of tools acting on their behalf.
- Private APIs change without notice and their use is a grey area in Discogs' terms. URL filters and visible form fields are the public surface.
- Chrome Web Store reviewers look for extensions acting without user action.

## Consequences

One more click than "fully automatic". The guide makes that click obvious (pink ring, "Click here").
