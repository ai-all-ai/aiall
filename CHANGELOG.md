# Changelog

All notable changes to AI-ALL are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/). Earlier versions are in the git history.

## [0.3.0] — 2026-11-14

### Added
- Packs: `packs list`, `packs add` and `packs remove`. `aiall-core` is built in. Pack manifest: `aiall-pack.json`.
- `--dry-run` for `packs`, and tests for packs.
- `docs/GLOSSARY.md`.

### Changed
- `sync` replaces only the packs block in `ALL.md`; your text is kept.
- The `ALL.md` template no longer has a routing table; sections are renumbered.
- Package metadata: public npm access, homepage and bug tracker.
