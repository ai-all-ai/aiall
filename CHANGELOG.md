# Changelog

All notable changes to AI-ALL are recorded here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/). Earlier versions are in the git history.

## [1.0.0] — 2026-11-14

### Added
- `upgrade --check`: compares the installed version with npm on request. Without the flag, `upgrade` makes no network request.
- `init --detect`: selects the agents found on PATH or present in the project and saves them to `.ai/aiall.json`. Cannot be combined with `--agents`.
- `scripts/release-check.sh`: checks a clean tree, the tag, the CHANGELOG section and the npm version before a release.
- `.github/workflows/release.yml`: creates or updates the GitHub Release for a tag, with notes taken from the CHANGELOG section.
- `CONTRIBUTING.md`, `SECURITY.md` and a pull request template for the repository.

### Compatibility
- Projects made with 0.3.0 pass `check` without changes. The packs block is compared without the pack versions in its headings, so a new release of a pack does not fail `check` by itself. `sync` still updates the headings.
- `upgrade` prints the installed version; `upgrade --check` compares it with npm.
- Commands, flags and file formats from 0.3.0 are unchanged.

### Notes
- From 1.0.0, the `aiall-pack.json` format, the CLI flags and the `--json` output follow semantic versioning. Breaking changes need a new major version.

## [0.3.0] — 2026-11-14

### Added
- Packs: `packs list`, `packs add` and `packs remove`. `aiall-core` is built in. Pack manifest: `aiall-pack.json`.
- `--dry-run` for `packs`, and tests for packs.
- `docs/GLOSSARY.md`.

### Changed
- `sync` replaces only the packs block in `ALL.md`; your text is kept.
- The `ALL.md` template no longer has a routing table; sections are renumbered.
- Package metadata: public npm access, homepage and bug tracker.
