# Security

## What runs on your machine

themis ships two Node.js hooks (Node 18+ required). They are written in TypeScript (`hooks/*.ts`) and run from the compiled files in `hooks/dist/`, which are committed and which CI rebuilds and compares on every pull request. They have no dependencies. Both read the hook payload from stdin, exit 0 on any unexpected input and make no network calls.

| Hook | Event | What it reads | What it can do |
|---|---|---|---|
| `hooks/dist/pre-tool.js` | `PreToolUse` (`Edit`, `Write`, `MultiEdit`, shell commands mentioning `CLAUDE` or `AGENTS`) | The targeted `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md`, the files it `@imports`, and its twin in the same directory. Unless the `gate` option is `off`, the rule gate also reads the repository the file is in (see below) | Denies the tool call when the file would exceed the size cap, when a shell command writes to a rule file, or when `CLAUDE.md` and `AGENTS.md` already differ. Asks for confirmation on a `Write` to a pair that differs, and, with `gate: ask`, on new rules the gate flags. Writes one kind of file: when the gate asks, a pending-approval file (the hashes of the flagged rules) under the OS temp directory in `themis-gate/`. Every call on a rule file removes the pending file of that session and file; a file older than 24 hours is removed the next time one is written |
| `hooks/dist/parity.js` | `PostToolUse` (same tools) | The edited rule file and its twin; the pending-approval file of that session and file, and, when there is one, the repository as the gate reads it | Overwrites or creates the `AGENTS.md` next to an edited `CLAUDE.md`, or the `CLAUDE.md` next to an edited `AGENTS.md`, with the same bytes; never in `~/.claude/` or a managed-policy directory. When you approved a gate prompt for that edit inside a git repository, writes `.claude/themis-accepted.json` at the repository root (the hash, verdict and date of each approved rule); outside a repository nothing is remembered. Removes the pending-approval file it read |
| `hooks/dist/parity.js` | `SessionStart`, and `PostToolUse` on shell commands mentioning `CLAUDE` or `AGENTS` | Runs `git rev-parse` and `git ls-files` in the working directory to find rule files (a bounded directory walk outside a git repository), then reads each `CLAUDE.md` and `AGENTS.md` it finds | Adds a note to the session context listing pairs that are not identical. Writes nothing |

The copy can be turned off with the `parity` option.

**What the rule gate reads.** From the rule file's directory up to the repository root: the nearest `package.json` and the `package.json` files on the way, Prettier, ESLint, Biome, commitlint, EditorConfig and TypeScript configs (following a relative `extends` of `tsconfig.json`), and lockfile names. At the root and in the rule file's directory: `.claude/settings.json` and `.claude/settings.local.json` (for `permissions.deny`), `.husky/*`, `lefthook.yml`, `.pre-commit-config.yaml`, `.github/workflows/*.yml`, `README.md`. At the root: `.gitignore`, `docs/*.md` and `.claude/themis-accepted.json`. It runs `git rev-parse --show-toplevel` and `git ls-files` for the file list. It never runs a config file and never executes repository code.

`hooks/dist/gate.js` is the same gate as a command the skill runs. `check` and `audit` write nothing; `audit --prune` rewrites `.claude/themis-accepted.json` without the entries that match no rule. `report` copies each repository of a corpus to a temporary directory, runs `git init` there and removes the copies when it ends.

The skill is Markdown instructions. Nothing in the plugin pushes to a remote.

The `evals/` directory is a research harness, not part of the plugin. It runs billed `claude -p` sessions and is never executed by the plugin.

## Reporting a vulnerability

Open a [private security advisory](https://github.com/ilien-dev/themis/security/advisories/new) on GitHub. Please do not file public issues for security problems.
