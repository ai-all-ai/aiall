# Security policy

## Supported versions

Only the latest 1.x release receives security fixes.

## Reporting a vulnerability

Do not open a public issue. Use GitHub's private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. The maintainer aims to reply within 7 days.

## In scope

- The CLI writing or deleting files outside the project directory, or following symbolic links to unexpected places.
- Pack manifests or project files causing code execution. Packs are data; the CLI does not run code from a pack.
- Secret values copied into generated files or printed output.
- Network requests other than `upgrade --check`.

## Out of scope

- Vulnerabilities in the agent products themselves.
- Instructions in a project's `ALL.md` that the project owner chose to write.
