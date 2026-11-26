# Hooks: the cap and parity

What the three hooks of themis do, in full: which file Claude Code reads, the size cap, how `CLAUDE.md` and `AGENTS.md` are kept identical, and what the hooks read and write. The [README](../README.md) has the summary.

## Which file Claude Code reads

As of Claude Code v2.1.277, from the [memory documentation](https://code.claude.com/docs/en/memory):

| The repository has | Claude Code reads |
|---|---|
| `AGENTS.md` and no `CLAUDE.md` or `CLAUDE.local.md` in the working directory or above it | `AGENTS.md` |
| `AGENTS.md` and a `CLAUDE.md` or `CLAUDE.local.md` | the `CLAUDE.md` files only |

So with the pair themis maintains, Claude Code reads `CLAUDE.md` and ignores `AGENTS.md`, which is there for every other tool. Nothing is loaded twice.

One setting changes that. If you set **Project instructions** to `claude-md-and-agents-md` in `/config`, Claude Code loads both files. It skips an `AGENTS.md` that `CLAUDE.md` imports or symlinks to, but two separate identical files are both loaded, and the rules cost twice the tokens. Leave the setting on its default with themis.

Versions before v2.1.277 never read `AGENTS.md` on their own.

## The size cap

An `Edit`, `Write` or `MultiEdit` that would take `CLAUDE.md`, `AGENTS.md` or `CLAUDE.local.md` past about 2,500 tokens is denied, with instructions to condense instead. Files pulled in with `@path` count toward the total. An edit that shrinks a file already over the cap is allowed.

Shell commands that write to those files (`>`, `>>`, `tee`, `sed -i`, `perl -i`, `Set-Content`, `Add-Content`, `Out-File`) are denied, so the cap can't be bypassed from the shell.

2,500 tokens is the size Boris Cherny reports for his own CLAUDE.md; the official guidance is "under 200 lines". The estimate is characters ÷ 3.6, and `gate audit` and `gate check` print it with the same arithmetic the hook uses, so the skill does not estimate by hand. Configure it with `claude_md_cap` (0 disables it).

## Parity

`CLAUDE.md` and `AGENTS.md` in the same directory are two real files with the same bytes. Not an `@AGENTS.md` import and not a symlink: a tool that reads only one of them gets the whole text.

**Edits are copied.** After Claude edits either file, a `PostToolUse` hook copies it over the other one, byte for byte, and creates the other one if it doesn't exist. Claude edits one file; there is no second step to forget.

**A difference is never resolved for you.** If the two files already differ when Claude tries to edit one, somebody changed one of them outside themis: in an editor, with `git checkout`, in a merge. Copying would silently discard one side, so the `PreToolUse` hook stops instead:

- `Edit` and `MultiEdit` are denied. Claude is told which two files differ and to ask you which text is right.
- `Write`, which replaces the whole file, raises a permission prompt that says both files will get this text. This is how a difference gets resolved: the skill shows you the diff, you choose one side or a merge, and you approve the write. In an unattended `claude -p` run nobody can answer the prompt, so the write is denied and the difference stays for a person to resolve.
- Creating the missing file of a pair is allowed only as an exact copy of the one that exists.

**Differences are reported.** At session start, and after any shell command that names one of the files, themis checks every pair in the project: the working directory up to the repository root, and every directory below it (from `git ls-files`, so ignored directories are skipped). Outside a git repository it checks the working directory only, so a session opened in your home directory says nothing about the projects under it. A directory with only one of the two files is not reported. If all pairs match it says nothing. Otherwise Claude gets one line per pair, such as `differ: CLAUDE.md (modified 2026-10-08 07:59 UTC) and AGENTS.md (modified 2026-10-07 18:02 UTC)`, with the instruction to tell you and not to choose a version.

What parity covers:

| File | Cap | Parity |
|---|---|---|
| `CLAUDE.md` ⇄ `AGENTS.md`, in the repository root and any subdirectory | yes | yes |
| `.claude/CLAUDE.md` ⇄ `.claude/AGENTS.md` in a project | yes | yes |
| `CLAUDE.local.md` | yes | no. It is personal and uncommitted, and no tool reads an `AGENTS.local.md` |
| `~/.claude/CLAUDE.md` and the managed-policy `CLAUDE.md` | yes | no. Those directories belong to Claude Code |
| A pair linked by an `@AGENTS.md` import or a symlink | yes | left as it is and reported; `sync` offers to turn it into two copies |

Limits worth knowing:

- The hooks see Claude's tool calls. A change made in your editor or by git is not blocked; it is reported at the next session start, or the next time Claude touches the files.
- The shell block matches common write commands, not every program that can write a file. What it misses is caught by the report after the command.
- Outside a git repository the check walks four directory levels below the working directory.

Turn parity off with the `parity` option if you want only one of the two files; the cap keeps working.

## What the hooks do

| Event | Runs on | Does |
|---|---|---|
| `PreToolUse` | `Edit`, `Write`, `MultiEdit`; shell commands that mention `CLAUDE` or `AGENTS` | Denies an edit over the cap, a shell write to a rule file, and an edit to a pair that already differs. Asks you to confirm a `Write` to such a pair. Runs the rule gate on the new rules of an edit. |
| `PostToolUse` | `Edit`, `Write`, `MultiEdit`; shell commands that mention `CLAUDE` or `AGENTS` | Copies the edited file to its twin and records the rules you approved. After a shell command, reports pairs that differ. |
| `SessionStart` | every start, resume, `/clear` and compaction | Reports pairs that differ or are linked instead of copied. Silent otherwise. |

The hooks write three things: the `CLAUDE.md` or `AGENTS.md` next to the one Claude just edited; `.claude/themis-accepted.json` in the repository, when you approve a rule the gate asked about; and a pending-approval file under the OS temp directory in `themis-gate/`, removed once used or after 24 hours. Besides the rule files, the gate reads `package.json`, tool configs, `.claude/settings*.json`, `.gitignore`, the README, `docs/`, husky and workflow files, and the output of `git ls-files`; with `gate_paths` on, also the first 32 KB of each source file a rule describes. The hooks make no network calls and fail silent on unexpected input. See [SECURITY.md](../SECURITY.md).
