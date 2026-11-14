# Glossary

Terms used in the AI-ALL and DS7 documents. Each term is defined here once; other documents link to this file.

- **ALL.md**: the routing file at the project root. Agents read it first. It contains the core rules and, between the packs markers, the directives of the enabled packs.
- **Entrypoint**: a native file that an agent loads automatically, such as `CLAUDE.md`, `AGENTS.md` or `GEMINI.md`. Entrypoints point to `ALL.md`; they do not hold rules of their own.
- **Adapter**: support for one agent tool. It decides which entrypoint file is created for that tool (for example `codex`, `claude`, `gemini`, `cursor`).
- **Config**: `.ai/aiall.json`. It records the selected adapters and the enabled packs. It never contains the text of a pack.
- **Pack**: a named set of directives that AI-ALL can deliver to a project. A pack is an npm package with an `aiall-pack.json` file, or a project-relative `.json` file. `aiall-core` is built in.
- **Directive**: one instruction in a pack. It has an `id`, a `title`, a `summary` (when to read) and a `doc` (the file to read, relative to the project root).
- **Managed block**: the text between `<!-- aiall:begin packs -->` and `<!-- aiall:end packs -->` in `ALL.md`. `sync` generates it from the enabled packs and replaces it as a whole. Do not edit text inside it; text outside it belongs to the project and is never changed by AI-ALL.
- **Sync**: the command that brings entrypoints and the managed block up to date. It creates missing files and never overwrites existing instructions.
- **Check**: the command that verifies required files, the managed block, and the links in `ALL.md`. It returns a non-zero exit code when something is wrong.
- **Standard (DS7)**: the web architecture rules in `@ai.all/ds7`. It is delivered as the `ds7` pack.
