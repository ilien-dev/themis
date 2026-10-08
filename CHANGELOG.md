# Changelog

## 2.0.0 — 2026-10-08

themis is now only a manager for `CLAUDE.md` and `AGENTS.md`. This release is not compatible with 1.x.

### Added

- `AGENTS.md` is a managed file: the size cap and the block on shell writes apply to it as they do to `CLAUDE.md`.
- Parity. `CLAUDE.md` and `AGENTS.md` in the same directory are kept as two identical files. A `PostToolUse` hook copies every edit of one to the other and creates the missing one. When the two already differ, `Edit` is denied and `Write` asks for confirmation, so a difference is resolved by the user and not by a silent copy. Pairs that differ are reported at session start and after shell commands that name them.
- `sync` mode in the skill: creates the missing file, or shows how two files differ and asks which text is right.
- `parity` option (default on) to turn the copying and the reports off.

### Changed

- The skill `hestia` is now `themis`: `/themis:hestia` becomes `/themis:themis`. Its `init`, `audit` and edit behavior is the same, extended to `AGENTS.md`.
- The shell block denies a command only when it writes to a rule file: a redirect, `tee`, `sed -i`, `perl -i`, `Set-Content`, `Add-Content` or `Out-File` aimed at one. In 1.x any command that named `CLAUDE.md` and had a `>` anywhere was denied, including `cat CLAUDE.md 2>&1` and `git diff CLAUDE.md > out.patch`.
- The hooks now write a file: the twin of the rule file Claude just edited. In 1.x they wrote nothing.
- The tagline, lockups, social preview and README animations describe the new plugin. The skill icons are gone.

### Removed

- The skills `ariadne`, `daedalus`, `apollo`, `argus` and `hermes`, and the `argus-eye` agent.
- The resident rule injected at session start (`hooks/core.txt`).
- The evaluation cases, research notes and plan that covered those parts. The four cases about the rule files remain in `evals/`.

### Migrating from 1.x

- **Removed commands.** `/themis:ariadne`, `/themis:daedalus`, `/themis:apollo`, `/themis:argus` and `/themis:hermes` no longer exist and have no replacement in themis. Claude Code's built-in `/code-review` and `/simplify` cover review; planning, building, debugging and commit messages are plain requests again. To keep the old skills, pin the marketplace to the last 1.x release (`/plugin marketplace add ilien-dev/themis#v1.1.1`), or copy their `SKILL.md` files from the `v1.1.1` tag into your own `.claude/skills/`.
- **The resident rule.** Sessions no longer start with "describing a problem gets an assessment, not an edit; reuse helpers; list other defects". If you relied on it, put that sentence in your own `CLAUDE.md`.
- **`.themis/` folders.** `ariadne` wrote `.themis/spec.md` and tickets into your projects, and `daedalus` read them. Nothing reads them now. themis does not delete or touch them: keep them as plain documents, move what is still useful into your tracker, or remove the folder.
- **`/themis:hestia`** is `/themis:themis`. Update any docs, aliases or `CLAUDE.md` lines that name it.
- **Your first session after updating.** If a repository has a `CLAUDE.md` and no `AGENTS.md` (or the reverse), themis reports the pair as incomplete at session start, and the first edit Claude makes to the existing file creates the other. If you already have both and they differ, themis reports it and asks; nothing is overwritten until you choose. If your `CLAUDE.md` is a one-line `@AGENTS.md` import, it is left alone and reported; `/themis:themis sync` converts it on request.
- **If you want only one of the two files**, set the `parity` option to `false`.
- `claude_md_cap` keeps its name and default, and now also governs `AGENTS.md`.

## 1.1.1 — 2026-10-02

- Visual identity in `assets/`: the coin emblem (a blindfolded Themis in profile), horizontal lockups for light and dark, a companion mark and favicons, one icon per skill, and a social preview. All vector, text set as outlines.
- README animations, light and dark: `hero`, `flow`, `describe` (case h03) and `cap` (the CLAUDE.md cap and hestia).
- `assets/README.md` documents the palette, type, licences, the Codex prompts and how to rebuild every file.
- No change to the plugin's behavior.

## 1.1.0 — 2026-10-01

- Skill descriptions rewritten to lead with their role (PLAN, BUILD, DEBUG, REVIEW, SHIP, CLAUDE.md) and say exactly what each does.
- `hestia` is now model-invocable: Claude loads it before creating or editing a CLAUDE.md. New `edit` mode changes only what was asked instead of auditing the whole file.
- The cap hook's rejection now tells Claude to load `hestia`.
- Not re-measured: c13–c15 were run with `hestia` user-invoked only.
- Public release on GitHub (`ilien-dev/themis`): LICENSE (MIT), SECURITY.md, homepage and repository in the manifest, install instructions for the GitHub marketplace.
- Eval scripts no longer hard-code local paths; an optional extra root CA is read from `evals/deepswe/extra-ca.crt`.

## 1.0.0 — 2026-09-29

First release. Every component was kept only after it beat the no-plugin baseline in A/B sessions on Claude Opus 5.5 (see RESULTS.md).

- Resident rule (~80 tokens): describing a problem or asking a question gets an assessment, not an edit; changes reuse existing helpers and list other defects instead of fixing them.
- CLAUDE.md / CLAUDE.local.md size cap (~2,500 tokens including imports; shell writes blocked).
- Skills: `ariadne` (start and align), `daedalus` (implement a ticket), `apollo` (debug), `argus` (review against the request), `hermes` (commit/PR), `hestia` (create or audit CLAUDE.md).
- Evaluation harness (`evals/run.mjs`) with 40+ cases and the mining scripts used to study real sessions.
