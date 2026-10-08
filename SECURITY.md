# Security

## What runs on your machine

themis ships two Node.js hooks (Node 18+ required). Both read the hook payload from stdin, exit 0 on any unexpected input and make no network calls.

| Hook | Event | What it reads | What it can do |
|---|---|---|---|
| `hooks/pre-tool.mjs` | `PreToolUse` (`Edit`, `Write`, `MultiEdit`, shell commands mentioning `CLAUDE` or `AGENTS`) | The targeted `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md`, the files it `@imports`, and its twin in the same directory | Denies the tool call when the file would exceed the size cap, when a shell command writes to a rule file, or when `CLAUDE.md` and `AGENTS.md` already differ. Asks for confirmation on a `Write` to a pair that differs. Writes nothing |
| `hooks/parity.mjs` | `PostToolUse` (same tools) | The edited rule file and its twin | Overwrites or creates one file: the `AGENTS.md` next to an edited `CLAUDE.md`, or the `CLAUDE.md` next to an edited `AGENTS.md`, with the same bytes. Never in `~/.claude/` or a managed-policy directory |
| `hooks/parity.mjs` | `SessionStart`, and `PostToolUse` on shell commands mentioning `CLAUDE` or `AGENTS` | Runs `git rev-parse` and `git ls-files` in the working directory to find rule files (a bounded directory walk outside a git repository), then reads each `CLAUDE.md` and `AGENTS.md` it finds | Adds a note to the session context listing pairs that are not identical. Writes nothing |

The copy can be turned off with the `parity` option.

The skill is Markdown instructions. Nothing in the plugin pushes to a remote.

The `evals/` directory is a research harness, not part of the plugin. It runs billed `claude -p` sessions and is never executed by the plugin.

## Reporting a vulnerability

Open a [private security advisory](https://github.com/ilien-dev/themis/security/advisories/new) on GitHub. Please do not file public issues for security problems.
