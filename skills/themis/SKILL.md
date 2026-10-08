---
name: themis
description: "CLAUDE.md and AGENTS.md: create (init), prune (audit), edit or sync them so they keep only what the model cannot infer from the repo, stay under the themis size cap, and hold identical text."
when_to_use: "Use before creating or editing any CLAUDE.md, AGENTS.md or CLAUDE.local.md, including adding rules or conventions to one, when an edit to one is rejected for its size or because the two differ, and when themis reports that CLAUDE.md and AGENTS.md are not identical."
argument-hint: "[init | audit | sync]"
---

Mode: $ARGUMENTS
- `init`, `audit` or `sync`: run that section below.
- Anything else, or loaded by Claude in the middle of a task: run **edit**. Change only what was requested; do not audit the rest of the file.
- Empty, invoked by the user: `sync` if themis reported a pair that is not identical, else `audit` if `CLAUDE.md`, `AGENTS.md` or `.claude/CLAUDE.md` exists, else `init`.

Cap: 2500 estimated tokens (characters ÷ 3.6), including files pulled in with `@path`. The themis hook rejects edits that exceed it.

## Two files, one text

`CLAUDE.md` and `AGENTS.md` in the same directory are two real files with the same bytes: no `@AGENTS.md` import, no symlink. Claude Code reads `CLAUDE.md` when both exist; `AGENTS.md` is there for other tools.

- Edit **one** of the two. After each Edit or Write the themis hook copies that file over the other, and creates the other if it is missing. Do not repeat the edit on the second file.
- When you finish, confirm the two are identical (`cmp CLAUDE.md AGENTS.md`). If they are not (the hooks are off), Write the same text to the other one.
- Other tools read `@path` as plain text, so prefer a `path — when to read it` pointer to an import.
- `CLAUDE.local.md` is personal and uncommitted and has no `AGENTS.md` counterpart: the cap applies, the copy does not. Neither does it apply in `~/.claude/`.

## What belongs

Each line must pass: *would the model make a mistake in this repo without it?*

- Commands that are not guessable from the manifest: build, test (single file and full), lint, dev server, required env setup.
- Conventions that differ from the language or framework default.
- Gotchas: things that look wrong but are intentional, fragile areas, generated files not to edit, ordering constraints. Keep these inline, one line each, even when a doc also mentions them.
- Repo etiquette: branch naming, commit format, what must not be pushed.
- Pointers: `path — when to read it` for docs the model should open on demand.

## What does not belong

- Project name, title or overview; the directory name and README already say it. Repository overviews do not improve agent success (ICLR 2026, "Evaluating AGENTS.md").
- Anything the code, manifest or config reveals (stack, folder tree, dependency list).
- Standard practice and generic advice ("write clean code", "handle errors", "use TypeScript types").
- Behavior rules current models already follow or that the harness already enforces: staying in scope, reading before editing, reusing existing code, not editing tests to pass, replying in the configured language.
- Rules for older models (e.g. "think step by step", "double-check your work", "be thorough", ALL-CAPS emphasis on many lines).
- Long procedures: move them to a doc or skill and leave a one-line pointer.
- Long passages duplicated from README or docs: point to them instead.

## init

1. Read the manifest(s), scripts, CI config, README, lint/format config and a few representative source files.
2. Run the test and build commands you find, if cheap, to confirm they work.
3. Draft only lines that pass the test above. No heading for the project; plain `##` sections only when there are several lines of one kind.
4. Show the draft with its token estimate, then write `CLAUDE.md`. Check that `AGENTS.md` now exists with the same text.

## edit

1. Read the target file and its `@imports`, and estimate the total. If `CLAUDE.md` and `AGENTS.md` differ, stop and run **sync** first.
2. Write each new line in the shortest form that keeps its meaning. Lines the user explicitly asked for go in; if one fails the test above, add it anyway and say in one line why it may not be needed.
3. If the result would exceed the cap, merge or condense lines close to the change, then say what you condensed. If that is not enough, stop and propose `/themis:themis audit`.

## audit

1. Read `CLAUDE.md`, `AGENTS.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/*.md` and every `@import`, and estimate the total. If a pair is not identical, run **sync** on it first.
2. Check every command and path against the repo; mark each line keep, cut (with the reason from the lists above), fix (stale), or move (to a doc, with a pointer).
3. Show the table and the resulting token estimate, then apply the approved changes. Merge before adding: when something new must go in, remove or condense something else so the file stays under the cap.

## sync

For each directory that has a `CLAUDE.md` or an `AGENTS.md` (the session-start notice lists the ones that need work):

- **Only one exists.** Create the other with Write, with exactly the same text. No question needed.
- **Both exist and differ.** Someone changed one outside themis, and you do not know which is right. Show which lines only each file has (`git diff --no-index CLAUDE.md AGENTS.md`, and `git log -1` on each for when it changed), then ask the user: keep `CLAUDE.md`'s text, keep `AGENTS.md`'s, or merge (show the merged text). Never choose for them, even when one looks newer or longer. Then Write the agreed full text to one of the two; Edit is rejected while they differ, and the Write asks the user to confirm.
- **One imports or symlinks the other.** That keeps them in step but they are not two copies. Say so and ask whether to convert; if yes, Write the full text to the file that held only the import (for a symlink, the user removes the link first: Write does not go through one).

Finish by confirming each pair is identical.
