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

## The gate

`node ${CLAUDE_PLUGIN_ROOT}/hooks/dist/gate.js` judges each rule with fixed checks, so results are repeatable. Its verdict is the criterion. In audit and init add no cuts of your own: what the gate keeps, stays.

To check new lines, write them to a temporary file and run `node ${CLAUDE_PLUGIN_ROOT}/hooks/dist/gate.js check --rules <temp file> --file <target>`.

Reasons: inferable from the repo (title, folder tree, scripts, stack lists, overview) or a stale version; enforced by a setting, lint rule or deny rule, or contradicting one; generic advice, filler, or a phrase a vendor guide asks to drop; an absolute command a hook or permission enforces better; a duplicated passage or long procedure; capitalised emphasis.

Described paths need `gate_paths`: if the user turned it on, add `--paths` to `check` and `audit`.

Verdicts: `keep`, `cut` (redundant, already enforced, or generic), `move` (belongs in a hook, `permissions.deny`, or a doc or skill plus a pointer), `rewrite` (drop the emphasis), `conflict` (contradicts the repo's configuration). Notes on a `keep` are information, not a reason to drop the rule.

## init

1. Read the manifest, scripts, CI and lint config, README and some source.
2. Run the cheap test and build commands to confirm they work.
3. Draft the lines the model would get wrong without: unguessable commands, non-default conventions, gotchas, repo etiquette, `path — when to read it` pointers. No project heading; `##` only for several lines of one kind. Check the draft with `check` (**The gate**) before showing it, and apply the verdicts as in **edit**.
4. Show the draft with its token estimate, then write `CLAUDE.md`. Check `AGENTS.md` now exists with the same text.

## edit

1. Read the target file and its `@imports`, and estimate the total. If `CLAUDE.md` and `AGENTS.md` differ, stop and run **sync** first.
2. Write each new line in the shortest form that keeps its meaning, and check them with `check` (**The gate**). Handle each verdict:
   - `keep`: write it. With `unresolved-reference`, first find the path or script the rule meant: if it moved or was renamed, use the right one; if it may exist later or you cannot tell, write it as given and tell the user which reference did not resolve.
   - `cut`: do not write it. Tell the user in one line the verdict, reason and evidence. Write it as given only if the user insists; with `gate: ask` themis then asks them to confirm.
   - `move`: do not write it here; offer the destination the gate names and use it if the user agrees.
   - `rewrite`: drop the capitalised emphasis, keep the meaning, then write it.
   - `conflict`: do not pick a side. Show the user both and ask which is right.
3. If the result would exceed the cap, condense lines close to the change and say what you condensed. If that is not enough, stop and propose `/themis:themis audit`.

## audit

1. Read `CLAUDE.md`, `AGENTS.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/*.md` and every `@import`, and estimate the total. If a pair is not identical, run **sync** on it first.
2. Run `node ${CLAUDE_PLUGIN_ROOT}/hooks/dist/gate.js audit <file> --prune` once for each file and show the table. `--prune` only drops remembered approvals of rules that no longer exist; it never edits the rule file. Do not re-check by hand anything the table covers.
3. Show the resulting token estimate, then, once the user approves, apply the verdicts. Leave rules marked `accepted` alone.
   - `cut`: remove the line.
   - `move`: put it at the destination the gate names; leave a one-line pointer if useful.
   - `keep` with `unresolved-reference`: check the reference and repair it in place if it moved (same search as in **edit**); else leave the line and tell the user.
   - `rewrite`: rewrite in place, no emphasis.
   - `conflict`: show both sides and ask; change nothing until the user answers.

   Remove headings whose section is left empty. Merge before adding: when something new must go in, remove or condense something else to stay under the cap.

## sync

For each directory that has a `CLAUDE.md` or an `AGENTS.md` (the session-start notice lists the ones that need work):

- **Only one exists.** Create the other with Write, with exactly the same text. No question needed.
- **Both exist and differ.** Someone changed one outside themis, and you do not know which is right. Show the lines only each file has (`git diff --no-index CLAUDE.md AGENTS.md`, `git log -1` on each for when it changed), then ask the user: keep `CLAUDE.md`'s text, keep `AGENTS.md`'s, or merge (show the merged text). Never choose for them, even when one looks newer or longer. Then Write the agreed text to one of the two; Edit is rejected while they differ, and the Write asks the user to confirm.
- **One imports or symlinks the other.** That keeps them in step but they are not two copies. Say so and ask whether to convert; if yes, Write the full text to the file that held only the import (for a symlink, the user removes the link first: Write does not go through one).

Finish by confirming each pair is identical.
