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

Homebrew needs no step from this repository. The tap repository `ai-all-ai/homebrew-tap` checks the npm `latest` version every six hours and opens a pull request that updates its formula. Review and merge that pull request after its checks pass.

No automation in this repository publishes to npm or creates GitHub Releases.
