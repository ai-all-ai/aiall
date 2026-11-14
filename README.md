# AI-ALL

[![npm](https://img.shields.io/npm/v/@ai.all/aiall)](https://www.npmjs.com/package/@ai.all/aiall)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![repo](https://img.shields.io/badge/github-ai--all--ai%2Faiall-blue)](https://github.com/ai-all-ai/aiall)

> **One project file for every AI agent.** Portable instructions and entrypoints, no resident service, no runtime dependencies.

```bash
npx @ai.all/aiall init
```

AI-ALL creates a project-wide `ALL.md` registry and minimal native entrypoints, which point each coding agent to common rules. It does **not** claim that every agent automatically expands Markdown links, discovers arbitrary skill directories, or obeys all instructions. Real agent loading must be smoke-tested per product/version.

> This repository is the source of `@ai.all/aiall`. Publishing to npm is always manual; see [Release](#release).

## Related

- **npm:** [@ai.all/aiall](https://www.npmjs.com/package/@ai.all/aiall)
- **GitHub:** [ai-all-ai/aiall](https://github.com/ai-all-ai/aiall)
- **Web standard:** [DS7](https://github.com/ai-all-ai/ds7) (`@ai.all/ds7`) installs as the `ds7` pack. See [Packs](#packs).
- **Terms:** [docs/GLOSSARY.md](docs/GLOSSARY.md) defines pack, directive, managed block and entrypoint.

## Quick start

Run the commands in the root folder of your project. Nothing is installed permanently:

```bash
npx @ai.all/aiall init     # creates the files listed below; existing files are kept
npx @ai.all/aiall check    # verifies the files and the links in ALL.md
```

Then open `ALL.md` and add your project's own rules below the packs block. Commit the files (see [Git and team workflows](#git-and-team-workflows)).

Requires Node.js 18 or newer. No third-party runtime dependencies.

To run from a source checkout instead, use `node ./bin/cli.js` in place of `npx @ai.all/aiall`, and pass `--path` with the project folder.

## Commands

| Command | Behavior | Writes files? |
| --- | --- | --- |
| `init` | Create missing `ALL.md`, initial guides, configured native entrypoints and `.ai/aiall.json`. With `--detect`, select the agents found on PATH or in the project | Yes; create-only |
| `packs` | `packs list`, `packs add <name>`, `packs remove <name>`: enable or disable packs and refresh the packs block in `ALL.md` | Yes; `--dry-run` previews |
| `detect` | Report detectable CLI installation, adapter-specific project files and configured selection separately | No |
| `sync` | Create missing baseline docs and entrypoints, and refresh the packs block in `ALL.md`; never overwrites your text | Yes |
| `check` | Check required files, managed adapter differences, Markdown paths in `ALL.md` | No |
| `doctor` | `check` plus detection evidence | No |
| `upgrade` | Print the installed version. With `--check`, compare it with npm and print the upgrade command | No; `--check` reads the npm registry |
| `--version` | Print installed CLI version | No |

Common options:

```bash
npx @ai.all/aiall init --path /projects/shop
npx @ai.all/aiall init --path /projects/shop --all-agents --dry-run
npx @ai.all/aiall init --path /projects/shop --detect --dry-run
npx @ai.all/aiall init --path /projects/shop --agents codex,claude,gemini,cursor,copilot
npx @ai.all/aiall detect --path /projects/shop --json
npx @ai.all/aiall sync --path /projects/shop
npx @ai.all/aiall doctor --path /projects/shop
npx @ai.all/aiall check --path /projects/shop
npx @ai.all/aiall check --path /projects/shop --agents cursor
npx @ai.all/aiall packs add ds7/aiall-pack.json --path /projects/shop --dry-run
```

Default native adapters for a new project: `codex`, `claude`, `gemini`. Optional adapters: `cursor`, `copilot`, `windsurf`, `roo`, `antigravity`. `opencode` and some other coding agents can read `AGENTS.md` directly, so no duplicate native file is generated for them. `init --agents` and `sync --agents` save the selected list in `.ai/aiall.json`. Without an explicit option, `init` and `sync` use the saved list, or the defaults when no config exists. `check` and `doctor` follow the same rule; passing `--agents` to either performs a one-off check and does not change configuration.

`detect` reports three distinct signals: CLI installation (only for agents with a detectable CLI), the adapter-specific project entrypoint, and explicit selection in `.ai/aiall.json`. A shared `AGENTS.md` is listed as a project file but is not evidence that Codex is installed. IDEs without a detectable CLI are reported as unknown, not absent. Detection is **evidence**, not guaranteed detection of every installed IDE. This tool does not inspect users' private application folders, install extensions or read secrets.

### Safety / idempotence

- `init` and `sync` create missing instructions and **never overwrite an existing instruction file**. An explicit `--agents` may update only `.ai/aiall.json`; removing an agent from that list never deletes its existing entrypoint.
- `.ai/aiall.json` is validated before use. Invalid JSON, unsupported schema versions, malformed agent lists and unknown names are errors.
- Writes are preflighted; newly created files are rolled back if a later write fails. The configuration is replaced atomically. Concurrent external edits cannot be fully locked by a local CLI.
- `--dry-run` previews file creations and configuration changes without writes.
- `check` returns nonzero when required files are missing, managed entrypoints drift or file links in `ALL.md` break.
- `--json` returns one JSON object with `ok`, `command`, `code`, `errors`, `warnings`, `results`, and `issues`; diagnostics go to stdout as JSON without human-readable messages.
- For `detect`, `results` is the per-agent evidence list. For `doctor`, it contains both `files` (the check results) and `detected` (that evidence list).
- Custom entrypoints that do not contain AI-ALL's generated marker result in **warnings**, not destructive repairs; verify actual native loading in the IDE.
- The CLI refuses to read or write through symlinks in managed paths and flags unsafe or external `ALL.md` links.
- No network requests are made by default. `upgrade --check` reads the npm registry, and only when you pass the flag.
- No automatic Git operations or postinstall scripts are used.
- No direct generation of slashes/commands/skills for every IDE: their native discovery formats vary and must be proven per tool.

## Files

For a fresh project using defaults:

```text
project/
├── ALL.md                        # Single instruction router, edited by project agents/developers
├── AGENTS.md                     # Codex/OpenCode and other AGENTS.md consumers
├── CLAUDE.md                     # Native Claude import of ALL.md
├── GEMINI.md                     # Native Gemini import of ALL.md
├── .ai/
│   ├── aiall.json                # Selected native adapters
│   ├── GOVERNANCE.md             # Rules for updating the instruction system
│   ├── rules/
│   │   ├── security.md
│   │   ├── git.md
│   │   ├── coding.md
│   │   └── testing.md
│   ├── workflows/review.md
│   └── integrations/registry.md
└── ... original application files untouched
```

With optional `cursor,copilot,windsurf,roo,antigravity`, additional native shims appear at `.cursor/rules/aiall.mdc`, `.github/copilot-instructions.md`, `.windsurf/rules/aiall.md`, `.roo/rules/aiall.md` and `.agents/rules/aiall.md` respectively. In some IDE modes, loading several native files can cause duplicate routing text: prefer only necessary adapters and smoke-test.

The target project does **not** receive `src/`, `bin/`, generator code or a package dependency. The generated Markdown and adapter config are ordinary **tracked Git files**, usable after `git clone` even when the installer is absent.

### Example custom project docs and skills

```text
project/
├── ALL.md                         # Add precisely scoped routing rows here
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SEO.md
│   └── DESIGN.md
├── .agents/skills/
│   ├── frontend/SKILL.md
│   └── performance/SKILL.md
└── src/
```

These custom docs and skills are **not generated by default**. The developer or project agent adds them only when genuinely needed and links each mandatory guide in `ALL.md` with an exact `When → Read` trigger. A file inside `.ai/` or `.agents/skills/` is not automatically executed. Some agents natively index Agent Skills; others require an explicit file read or native adapter.

## Packs

A **pack** is a named set of agent directives. AI-ALL ships the `aiall-core` pack. Other packs are normal npm packages. `@ai.all/ds7` is the recommended pack for web projects.

The project stores only the list of enabled packs, never their text:

```json
{ "packs": ["aiall-core", "ds7"] }
```

`sync` renders the managed directive section of `ALL.md` from the enabled packs. Text you write outside that section is kept. To update a pack, run `npm i -D <pack>@latest` and then `npx @ai.all/aiall sync`. The project state does not change, so no version is recorded in the project.

**Recommended for web projects:** install DS7 as well.

```bash
npx @ai.all/ds7
```

DS7 runs `aiall init` itself and adds the `ds7` pack. Install order does not matter.

> Packs were added in version 0.3.0.

## Managing permanent instructions

`ALL.md` is the primary read/route entrypoint, not a giant concatenation of all project docs. The template contains core rules, a task-routing table, a skills table and governance directions.

When a user wants a permanent rule: search existing references, avoid duplicates, prefer updating a related file, add or edit the applicable `ALL.md` routing row and validate links. An agent must not invent new enduring restrictions because it encountered an issue twice. The project owner decides policy changes. Read `.ai/GOVERNANCE.md` for details.

## Git and team workflows

Commit `ALL.md`, `AGENTS.md`, the selected native entrypoints, `.ai/`, and the project-owned skills. Do **not** commit API tokens or `.env` secrets. AI-ALL does not read or change `.gitignore`, does not change branches, does not stage files and does not commit. Add your own ignore rules for dependencies, build output and local secrets; the `.gitignore` of this repository is one example. For simultaneous agents, use separate worktrees and review diffs; `git status` is useful but is not a lock.

Optional CI workflow for the **target** repository (you add it yourself):

```yaml
name: AI instruction integrity
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx --yes @ai.all/aiall@1.0.0 check
```

Pin a tested release and update deliberately; CI checks structure, **not** that each IDE loads the files.

## Supported adapters and caveats

| Agent | Native file | Delivery | Limitation |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | Requires agent to explicitly read `ALL.md` | Markdown link is not native import |
| Claude Code | `CLAUDE.md` | Native `@ALL.md` import | Check actual context and import behavior |
| Gemini CLI | `GEMINI.md` | Native `@./ALL.md` import | `/memory show` can confirm loaded memory |
| OpenCode V2 | `AGENTS.md` | Requires file-read of `ALL.md` | Direct config `instructions` can load ALL.md but may duplicate AGENTS.md |
| Cursor | `.cursor/rules/aiall.mdc` | `alwaysApply` directs read of `ALL.md` | Not a true import; may also read AGENTS.md |
| GitHub Copilot | `.github/copilot-instructions.md` | Directs read of `ALL.md` | Different IDE/cloud behaviors, possible duplication |
| Windsurf | `.windsurf/rules/aiall.md` | `always_on` routing text | Verify version's actual trigger support |
| Roo | `.roo/rules/aiall.md` | Routing text | May overlap with AGENTS.md in some versions |
| Antigravity | `.agents/rules/aiall.md` | Inline-file reference where supported | Verify native import semantics per release |

Vendor documentation is linked in [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). Docs are current research starting points, not guarantees for every version.

## Release

```bash
npm test
npm run check
npm pack --dry-run
bash scripts/release-check.sh   # clean tree, unused tag, CHANGELOG section, unused npm version
node bin/cli.js --version
```

For a new release, review the code, increment `package.json`, and verify the npm version is unused:

```bash
npm whoami
npm view @ai.all/aiall versions --json
npm publish --dry-run
npm publish --access public
```

Never republish an existing version. npm authentication/passkey approval is required; npm publishing remains manual. After the npm version is published and verified, push the matching tag. The Homebrew formula in [ai-all-ai/homebrew-tap](https://github.com/ai-all-ai/homebrew-tap) follows npm `latest` and is updated by a pull request within six hours. See [docs/RELEASE.md](docs/RELEASE.md) for the full release sequence.

## Contributing and security

Contribution rules: [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

MIT; see `LICENSE`.
