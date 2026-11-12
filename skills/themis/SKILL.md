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

Settings: cap `${user_config.claude_md_cap}`, gate `${user_config.gate}`, gate_paths `${user_config.gate_paths}`. A value still starting with `${` was never set: use cap 2500, gate `report`, gate_paths `false`.

The cap is in estimated tokens (characters ÷ 3.6), `@path` imports included; 0 means none. The themis hook rejects edits over it. `audit` and `check` print the `Tokens:` line the hook counts with; do not estimate by hand.

## Two files, one text

`CLAUDE.md` and `AGENTS.md` in the same directory are two real files with the same bytes: no `@AGENTS.md` import, no symlink.

- Edit **one** of the two. After each Edit or Write the themis hook copies that file over the other, and creates the other if it is missing. Do not repeat the edit on the second file.
- When you finish, confirm the two are identical (`git diff --no-index --quiet CLAUDE.md AGENTS.md` exits 0). If not (the hooks are off), Write the same text to the other one.
- Other tools read `@path` as plain text, so prefer a `path — when to read it` pointer to an import.
- `CLAUDE.local.md` is personal and uncommitted and has no `AGENTS.md` counterpart: the cap applies, the copy does not. Neither does it apply in `~/.claude/`.

## The gate

`node ${CLAUDE_PLUGIN_ROOT}/hooks/dist/gate.js` judges each rule with fixed checks. Its verdict is the criterion. In audit and init add no cuts of your own: what the gate keeps, stays.

To check new lines, Write them to a file in the system temp directory, not the repository, and run `node ${CLAUDE_PLUGIN_ROOT}/hooks/dist/gate.js check --rules <temp file> --file <target>`. Add `--paths` to `check` and `audit` if gate_paths is `true`.

Verdicts: `keep`, `cut` (redundant, already enforced, or generic), `move` (belongs in a hook, `permissions.deny`, or a doc or skill plus a pointer), `rewrite` (drop the emphasis), `conflict` (contradicts the repo's configuration). Notes on a `keep` are information, not a reason to drop it.

The gate leaves a rule alone when in doubt: a `keep` with `no-evidence` means no check applied, not approval. Pass any `Not judged:` or `No package.json found` line on to the user, and never call a file clean because the gate kept its rules.

## init

1. Read the manifest, scripts, CI and lint config, README and some source.
2. Run the cheap test and build commands to confirm they work.
3. Draft the lines the model would get wrong without: unguessable commands, non-default conventions, gotchas, repo etiquette, `path — when to read it` pointers. No project heading; `##` only for several lines of one kind. Check the draft with `check` (**The gate**) before showing it, and apply the verdicts as in **edit**.
4. Show the draft with the size `check` printed, then write `CLAUDE.md`. Check `AGENTS.md` now exists with the same text.

## edit

1. Read the target file and its `@imports`. If `CLAUDE.md` and `AGENTS.md` differ, stop and run **sync** first.
2. Write each new line in the shortest form that keeps its meaning, and check them with `check` (**The gate**). Handle each verdict:
   - `keep`: write it. With `unresolved-reference`, first find the path or script the rule meant: if it moved or was renamed, use the right one; if it may exist later or you cannot tell, write it as given and tell the user which reference did not resolve.
   - `cut`: do not write it. Tell the user in one line the verdict, reason and evidence. Write it as given only if the user insists; with gate `ask` themis then asks them to confirm.
   - `move`: do not write it here; offer the destination the gate names and use it if the user agrees.
   - `rewrite`: drop the capitalised emphasis, keep the meaning, then write it.
   - `conflict`: do not pick a side. Show the user both and ask which is right.
3. Add the two numbers of `check`'s `Tokens:` line. If the result would pass the cap, make room without asking: merge lines that repeat one pattern or condense others, keeping their meaning, and say what you changed. Stop and propose `/themis:themis audit` only if meaning would be lost.

## audit

1. Read `CLAUDE.md`, `AGENTS.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/*.md` and every `@import`. If a pair is not identical, run **sync** on it first.
2. Run `node ${CLAUDE_PLUGIN_ROOT}/hooks/dist/gate.js audit <file> --prune` once for each file (once for an identical pair) and show the table and the lines under it. `--prune` only drops approvals of rules that are gone. Do not re-check by hand what the table covers.
3. Once the user approves, apply the verdicts. Leave rules marked `accepted` alone.
   - `cut`: remove the line.
   - `move`: put it at the destination the gate names; leave a one-line pointer if useful.
   - `keep` with `unresolved-reference`: repair the reference in place if it moved (as in **edit**); else leave the line and tell the user.
   - `rewrite`: rewrite in place, no emphasis.
   - `conflict`: show both sides and ask; change nothing until the user answers.

   Remove headings whose section is left empty.
4. Run `audit` again and report the new `Tokens:` line.

## sync

For each directory that has a `CLAUDE.md` or an `AGENTS.md`:

- **Only one exists.** Create the other with Write, with exactly the same text.
- **Both exist and differ.** You do not know which is right. Show the lines only each file has (`git diff --no-index CLAUDE.md AGENTS.md`, `git log -1` on each), then ask the user: keep `CLAUDE.md`'s text, keep `AGENTS.md`'s, or merge (show the merged text). Never choose for them, even if one looks newer, nor make them match with the shell. If nobody can answer, leave both as they are and end with the question. Then Write the agreed text to one of the two; Edit is rejected while they differ, and the Write asks the user to confirm.
- **One imports or symlinks the other.** That keeps them in step but they are not two copies. Say so and ask whether to convert; if yes, Write the full text to the file that held only the import (for a symlink, the user removes the link first: Write does not go through one).

Finish by confirming each pair matches.
