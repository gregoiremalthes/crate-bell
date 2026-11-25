# 1. WXT, TypeScript and no UI framework

Date: 2026-11-24 · Status: accepted

## Context

A Manifest V3 extension with a content script on discogs.com, a popup and one guide page. It must stay small, easy for Chrome Web Store reviewers to read, and easy for coding agents to change.

## Decision

- WXT (Vite based) for builds, manifest generation, dev reloads, zips and future Firefox and Edge builds.
- Plain TypeScript DOM with a 40-line helper (`src/lib/ui/dom.ts`) instead of React or Svelte.
- Content UI in shadow roots (`createShadowRootUi`) so Discogs' CSS and ours never meet.

## Consequences

- Bundle under 300 KB including fonts and three languages. No runtime dependencies to audit.
- Re-rendering is manual: views are small state machines (`render()` per state).
