# Release process

1. Review changes and run `npm test`, `npm run check`, `npm pack --dry-run`.
2. Confirm package name `@ai.all/aiall` and repository metadata in `package.json`.
3. Check `npm view @ai.all/aiall versions --json` before choosing a new version.
4. Ensure `LICENSE`, `README.md`, `bin/`, `src/` and `templates/` are included in the npm tarball. `docs/` remains GitHub-only unless explicitly added to package files.
5. Review the Git diff and commit/push to the intended repository with owner permission.
6. Publish only with explicit owner authorization; use npm 2FA / passkey / Trusted Publishing where configured.
7. Run `npm view @ai.all/aiall version` and exercise `npx @ai.all/aiall@VERSION init` in a fresh temporary project.

No automation in this source tree publishes to npm. Do not publish this proposed version until reviewed.
