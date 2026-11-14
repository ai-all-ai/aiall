# Contributing to AI-ALL

AI-ALL is a small CLI with one job: create, detect and check agent instruction files in a project. Changes should keep that scope.

## Before you start

- Open an issue first for a new command, a new agent adapter or a change to the file format. Small fixes can go straight to a pull request.
- Read [docs/GLOSSARY.md](docs/GLOSSARY.md) for the terms used in the code and docs.

## Development

```bash
npm test            # node --test
npm run check       # syntax checks, then tests
npm pack --dry-run  # the files that would be published
```

Requires Node.js 18 or newer. The package has no runtime dependencies.

## Rules

- Code, comments, documentation and commit messages are in English.
- Do not add a runtime dependency without a clear reason in the pull request.
- The only network request is `upgrade --check`, which reads the npm registry. Do not add other network calls.
- Never overwrite a user's file without a tested rule for it. Managed blocks are the only text the CLI replaces.
- A user-visible change needs a test and a line in `CHANGELOG.md` under `Unreleased`.

## Code style

- JavaScript, JSON and YAML are formatted with Prettier 3.6.2 using the shared `.prettierrc.json`. Run `npm run format`, then `npm run format:check` before committing. CI checks it.
- Editor settings (indentation, line endings, final newline) come from `.editorconfig`.
- Markdown, shell scripts and Ruby files are not formatted by Prettier; keep them consistent with the files around them.

## Commits and pull requests

- One concern per commit. Subject in the imperative mood, under 72 characters. The body explains why.
- No `Co-Authored-By` or tool trailers unless the maintainer asks for them.
- The pull request says what changed, why, and how it was checked.
- Release commits and npm publishing are done by the maintainer; see [docs/RELEASE.md](docs/RELEASE.md).
