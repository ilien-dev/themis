---
name: hestia
description: "CLAUDE.md: create (init), prune (audit) or edit it so it keeps only what Claude cannot infer from the repo, under the themis size cap."
when_to_use: "Use before creating or editing any CLAUDE.md or CLAUDE.local.md, including adding rules or conventions to it, and when a CLAUDE.md edit is rejected for its size."
argument-hint: "[init | audit]"
---

Mode: $ARGUMENTS
- `init` or `audit`: run that section below.
- Anything else, or loaded by Claude in the middle of a task: run **edit**. Change only what was requested; do not audit the rest of the file.
- Empty, invoked by the user: `audit` if `CLAUDE.md` or `.claude/CLAUDE.md` exists, else `init`.

Cap: 2500 estimated tokens (characters ÷ 3.6), including files pulled in with `@path`. The themis hook rejects edits that exceed it.

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
4. Show the draft with its token estimate, then write `CLAUDE.md`.

## edit

1. Read the target file and its `@imports`, and estimate the total.
2. Write each new line in the shortest form that keeps its meaning. Lines the user explicitly asked for go in; if one fails the test above, add it anyway and say in one line why it may not be needed.
3. If the result would exceed the cap, merge or condense lines close to the change, then say what you condensed. If that is not enough, stop and propose `/themis:hestia audit`.

## audit

1. Read `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/*.md` and every `@import`, and estimate the total.
2. Check every command and path against the repo; mark each line keep, cut (with the reason from the lists above), fix (stale), or move (to a doc, with a pointer).
3. Show the table and the resulting token estimate, then apply the approved changes. Merge before adding: when something new must go in, remove or condense something else so the file stays under the cap.
