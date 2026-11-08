# Git workflow

- Run `git status --short` before writing in shared projects; inspect relevant diffs.
- Do not overwrite or discard unrelated uncommitted work.
- Do not automatically commit, push, reset, clean, rebase or force-push without user authorization.
- Prefer focused changes, meaningful commits, and documented checks when commits are requested.
- In simultaneous-agent scenarios, prefer separate worktrees/branches and review integration conflicts.
- Before committing, inspect `git diff --check`, the staged diff and any relevant tests.
