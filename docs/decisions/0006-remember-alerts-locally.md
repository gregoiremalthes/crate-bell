# 6. Remember alerts locally, kept in step with Discogs' menu

Date: 2026-11-24 · Status: accepted

## Context

The record page should show "Sale alert on" instead of the button once an alert exists, and the wantlist page should tag records that have one. Discogs does not show which records a saved search covers anywhere public.

## Options

- **A. Local memory, synced from Discogs' "Saved Searches" menu.** Crate Bell stores the alerts it saved (name, records, frequency, Discogs id). Each visit to "Items I Want" compares that list with the menu (only when the menu's count label matches its entries): deleted alerts are forgotten, renamed ones followed by id. A saved search the user opens in the menu is learned (its records are read from the address once Discogs applies it).
- **B. Read Discogs' internal saved-searches endpoint.** Complete and instant, but a private API (against ADR 2) and more fragile.

## Decision

A (chosen by the product owner).

## Consequences

- Alerts made before Crate Bell, or on another computer, appear once opened in the menu.
- An alert deleted elsewhere is still shown until the next visit to "Items I Want". The record card keeps a "Set a different alert" link for that case.
- Stored locally only: alert names, record ids, frequency, dates. Nothing leaves the browser.
