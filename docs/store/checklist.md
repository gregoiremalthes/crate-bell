# Release checklist

Before every Chrome Web Store upload:

- [ ] `pnpm check` and `pnpm build && pnpm test:e2e` pass (CI green on `main`).
- [ ] Manual pass on real Discogs, logged in: release in wantlist, release not in wantlist, master page, "Items I Want" with a real save, then delete that alert.
- [ ] Manual pass logged out: record page shows "Log in to Discogs to set sale alerts".
- [ ] Version bumped in `package.json`, entry added to `CHANGELOG.md`.
- [ ] Tag `vX.Y.Z` pushed: the release workflow attaches the zip.
- [ ] Listing text and screenshots still match the UI (`docs/store/listing.md`, `store-assets/`).
- [ ] Permissions unchanged, or justified in the Privacy tab and an ADR.
