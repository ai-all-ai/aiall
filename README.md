# AI-ALL (`@ai.all/aiall`)

**Portable AI instructions, skills and project governance — without a resident service or build-time dependency.**

AI-ALL creates a project-wide `ALL.md` registry and minimal native entrypoints, which point each coding agent to common rules. It does **not** claim that every agent automatically expands Markdown links, discovers arbitrary skill directories, or obeys all instructions. Real agent loading must be smoke-tested per product/version.

> This repository is a proposed **v0.2.0 implementation**. The existing published package was `@ai.all/aiall@0.1.0`. Review and test this code before merging or publishing. No npm publishing occurs automatically.

## Quick start

Install nothing permanently:

```bash
npx @ai.all/aiall@0.2.0 init
```

After `0.2.0` is published, the above works in your current directory. **Before publication**, run from this source checkout:

```bash
node ./bin/cli.js init --path /absolute/path/to/your-project
node ./bin/cli.js check --path /absolute/path/to/your-project
```

Requires Node.js 18 or newer. No third-party runtime dependencies.

## CLI

| Command | Behavior | Writes files? |
| --- | --- | --- |
| `init` | Create missing `ALL.md`, initial guides, configured native entrypoints and `.ai/aiall.json` | Yes; create-only |
| `detect` | Report detectable CLI installation, adapter-specific project files and configured selection separately | No |
| `sync` | Restore missing baseline docs/entrypoints only; **never overwrite** | Yes; create-only |
| `check` | Check required files, managed adapter differences, Markdown paths in `ALL.md` | No |
| `doctor` | `check` plus detection evidence | No |
| `upgrade` | Print guidance for safe package upgrade | No |
| `--version` | Print installed CLI version | No |

Common options:

```bash
node bin/cli.js init --path /projects/shop
node bin/cli.js init --path /projects/shop --all-agents --dry-run
node bin/cli.js init --path /projects/shop --agents codex,claude,gemini,cursor,copilot
node bin/cli.js detect --path /projects/shop --json
node bin/cli.js sync --path /projects/shop
node bin/cli.js doctor --path /projects/shop
node bin/cli.js check --path /projects/shop
node bin/cli.js check --path /projects/shop --agents cursor
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
- No network requests, automatic Git operations or postinstall scripts are used.
- No direct generation of slashes/commands/skills for every IDE: their native discovery formats vary and must be proven per tool.

## What appears in a target project

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

## Managing permanent instructions

`ALL.md` is the primary read/route entrypoint, not a giant concatenation of all project docs. The template contains core rules, a task-routing table, a skills table and governance directions.

When a user wants a permanent rule: search existing references, avoid duplicates, prefer updating a related file, add or edit the applicable `ALL.md` routing row and validate links. An agent must not invent new enduring restrictions because it encountered an issue twice. The project owner decides policy changes. Read `.ai/GOVERNANCE.md` for details.

## Git and team workflows

Commit `ALL.md`, `AGENTS.md`, the selected native entrypoints, `.ai/`, and the project-owned skills. Do **not** commit API tokens, `.env` secrets or local detection caches. The initializer does not mutate `.gitignore`, change branches, stage files or commit automatically. For simultaneous agents, use separate worktrees and review diffs; `git status` is useful but is not a lock.

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
      - run: npx --yes @ai.all/aiall@0.2.0 check
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

## Development and release

```bash
npm test
npm run check
npm pack --dry-run
node bin/cli.js --version
```

Before publishing after `0.1.0`, ensure the code has been reviewed and version is available:

```bash
npm whoami
npm view @ai.all/aiall versions --json
npm publish --dry-run
npm publish --access public
```

Never republish an existing version. npm authentication/passkey approval is required. This project is not configured to auto-publish.

## License

MIT; see `LICENSE`.
