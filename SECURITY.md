# Security

## What runs on your machine

themis ships two Node.js hooks (Node 18+ required). Both read the hook payload from stdin, exit 0 on any unexpected input, make no network calls and write no files.

| Hook | Event | What it reads | What it can do |
|---|---|---|---|
| `hooks/session-start.mjs` | `SessionStart` | `hooks/core.txt` | Adds the resident rule as session context |
| `hooks/pre-tool.mjs` | `PreToolUse` (`Edit`, `Write`, `MultiEdit`, shell commands mentioning `CLAUDE`) | The targeted `CLAUDE.md` / `CLAUDE.local.md` and the files it `@imports` | Denies the tool call when the file would exceed the size cap, or when a shell command writes to `CLAUDE.md` |

The skills are Markdown instructions. `argus` runs in a read-only subagent (`agents/argus-eye.md`). Nothing in the plugin pushes to a remote without asking you first.

The `evals/` directory is a research harness, not part of the plugin. It runs billed `claude -p` sessions and is never executed by the plugin.

## Reporting a vulnerability

Open a [private security advisory](https://github.com/ilien-dev/themis/security/advisories/new) on GitHub. Please do not file public issues for security problems.
