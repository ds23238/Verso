# Pinned library source snapshots

The authoritative libraries remain the separate `lyricsfile` and `lyricsbridge`
repositories. These reviewable snapshots let a clean Verso checkout build in CI
without private local paths, additional repository permissions or compiled files
in Git. `manifest.json` pins source commits and per-file SHA-256 checksums.

Run `python scripts/bootstrap-libraries.py` before `npm ci` in a fresh checkout.
Existing sibling repositories are never overwritten. Update snapshots deliberately
with `python scripts/snapshot-libraries.py` after committing library changes.

No `.git` directories, native/WASM binaries or the three external fixture files
are included. CI recreates disposable fixtures outside the repository using
`scripts/prepare-ci-fixtures.py`.
