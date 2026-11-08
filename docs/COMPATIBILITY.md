# Adapter sources and verification notes

The CLI implements only the small list in `src/core.js`. This directory does not make third-party code available, install plugins or guarantee prompt loading. Review current vendor documentation before relying on a native adapter in a particular version/mode.

- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Claude Code memory/imports: https://code.claude.com/docs/en/memory
- Gemini CLI context and imports: https://geminicli.com/docs/cli/gemini-md/
- Cursor project rules: https://cursor.com/docs/rules
- OpenCode V2 instructions: https://opencode.ai/docs/instructions
- Copilot repository instructions: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions
- Windsurf rules: https://docs.windsurf.com/windsurf/cascade/memories
- Roo Code instructions: https://docs.roocode.com/features/custom-instructions
- Google Antigravity rules: https://antigravity.google/docs/rules
- Portable Agent Skills: https://agentskills.io/

## Smoke test per agent

1. Open the project in that agent from repository root.
2. Inspect its reported loaded instruction sources, if supported; Claude Code and Gemini CLI provide context/memory inspection commands.
3. Ask agent to identify a unique, non-secret sentence temporarily added to `ALL.md`. Require it to read the file if its native shim only contains a text request.
4. Verify that triggered project-specific docs are read in a real coding task; inspect tool logs when available.
5. Remove test phrase, review Git diff and record the agent/version/result in project documentation.
6. Check for duplicate sources (e.g., AGENTS.md plus product-specific rules).

Agent compliance is probabilistic and cannot be proven by file existence alone. Use CI, repository permissions and real tests for enforceable guarantees.

## AI-ALL detection and adapter selection

`aiall detect --json` reports separate evidence:

- `installed`: `true`/`false` only for supported command-line executables that can be checked on `PATH`; `null` means this version cannot reliably detect installation (for example, an IDE application).
- `projectFiles`: the exact native adapter file AI-ALL recognizes in the project. A shared `AGENTS.md` is listed as a project file, not proof that Codex is installed.
- `selected`: whether `.ai/aiall.json` explicitly selects the adapter.

These are not interchangeable. In particular, selection records project intent, and a native file's presence does not prove that the agent loaded it. AI-ALL does not scan private application directories or guess from arbitrary skills.

## Configuration and safe synchronization

`.ai/aiall.json` uses a package-independent `schemaVersion` and an `agents` array, for example:

```json
{
  "schemaVersion": 1,
  "agents": ["codex", "claude", "gemini"]
}
```

`init`/`sync` use this list unless `--agents` is given. An explicit list updates the config only after the selected files have been preflighted and missing files have been safely created. Existing instructions are preserved; removing an adapter from the list does not remove its file. On a write error, AI-ALL removes only files it created during that operation and leaves an existing config untouched. Config replacement uses a same-directory atomic rename; first creation uses an exclusive hard link so it cannot overwrite a concurrently-created file. `--dry-run` does not write.

The CLI rejects symlinks in managed paths and checks Markdown links for project containment. This avoids following known external links, but portable path-based filesystem APIs cannot eliminate every race if another process replaces a checked parent directory during the operation. Run sync in a repository not concurrently modified by an untrusted process.

## Loading and token cost

The short native shims reduce duplicated instructions, but text such as “read `ALL.md`” is still a request, not proof of loading. Prefer a vendor-supported import where its behavior has been verified; otherwise smoke-test actual context loading. Avoid selecting several adapters for the same IDE if both a generic `AGENTS.md` and a native file are automatically loaded, as the same router may appear more than once. Keep `ALL.md` concise and load linked policy documents only when their stated task triggers match.
