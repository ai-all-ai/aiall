# Release process

> **How it fits with DS7.** [DS7](https://github.com/ai-all-ai/ds7) (`@ai.all/ds7`) is a web architecture standard delivered as the `ds7` pack of AI-ALL. AI-ALL works without it. For web projects, install the pack; see [Packs](../README.md#packs).


1. Review changes and run `npm run check`, `npm pack --dry-run`.
2. Confirm package name `@ai.all/aiall`, the version, and repository metadata in `package.json`.
3. Check `npm view @ai.all/aiall versions --json` before choosing a new version.
4. Ensure `LICENSE`, `README.md`, `bin/`, `src/` and `templates/` are included in the npm tarball. `docs/` remains GitHub-only unless explicitly added to package files.
5. Review the Git diff and commit/push to the intended repository with owner permission.
6. Publish the exact version to npm only with explicit owner authorization; use npm 2FA / passkey / Trusted Publishing where configured.
7. Verify `npm view @ai.all/aiall@VERSION version dist.tarball` and exercise `npx @ai.all/aiall@VERSION init` in a fresh temporary project.
8. Publish a GitHub Release for the matching `vVERSION` tag after npm publication is confirmed.

## Compatibility check before publishing

Run this once for each release, in an empty folder, with the tarball of the new version and the previous published version:

1. `npm pack @ai.all/aiall@PREVIOUS` (the last published release) and create a project with it: `npx aiall init --path project`.
2. Install the new tarball into the same project and run `aiall check --path project`. It must pass before any `sync`.
3. Run `aiall sync --path project` and check again. Text you wrote outside the packs block must be unchanged.
4. If the release changes a command, flag or file format, the change must be a major version, or it must keep the old behaviour.

Homebrew needs no step from this repository. The tap repository `ai-all-ai/homebrew-tap` checks the npm `latest` version every six hours and opens a pull request that updates its formula. Review and merge that pull request after its checks pass.

No automation in this repository publishes to npm or creates GitHub Releases.
