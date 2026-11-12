# Changelog

## 2.3.0 — 2026-11-12

### Added

- `gate audit` and `gate check` print the token estimate the cap is checked against, own text plus `@path` imports, in the hook's arithmetic. `audit --json` has it as `tokens`. The skill no longer estimates by hand.
- `gate audit` prints a `Not judged:` line with the number of rules that matched nothing, and says when the repository has no `package.json`. A rule kept for lack of a check is not a rule approved, and the skill now passes that on instead of reporting a file as clean.
- Session evals for the parts of the skill that had none: c21 (what `edit` does with `cut`, `rewrite` and `keep`), c22 (a pair that differs is not resolved by choosing a version) and c23 (an unresolved reference is repaired or reported).

### Changed

- The skill reads the cap, `gate` and `gate_paths` from the plugin options (`${user_config.*}`) instead of a written 2500 and "if the user turned it on". An option never set stays as written, and the skill then uses the defaults.
- The pair check in the skill is `git diff --no-index --quiet`, which exists in every shell; `cmp` does not in PowerShell.
- `audit` runs the gate once for an identical pair, and reports the new token estimate after applying the verdicts.
- `sync` says not to make a pair match with the shell, and to end with the question when nobody can answer it.
- `edit` over the cap: make room without asking by merging lines that repeat one pattern or condensing others, and say what changed; stop only if meaning would be lost.
- The text to check goes to a file in the system temporary directory, not in the repository.
- The c14 grader follows the gate: it no longer requires removing "Double-check your work", which the gate keeps, and requires the shouted rules to lose their emphasis.

### Measured

- The session evals were re-run for the first time since 1.0: c13 to c15 and c20 to c23 all 3/3 with the plugin; c13 to c15 0/3 without it. c15 fell to 0/3 on an intermediate text, because with the token estimate in hand Claude stopped to ask before condensing; the `edit` step now says to make room without asking. See [RESULTS.md](RESULTS.md) for what they do not cover.

### Known limits

- Whether `${user_config.*}` is filled in the skill for an option the user has set was not observed in a session; the documentation says it is.
- Shell writes to a rule file are denied for redirects, `tee`, `sed -i`, `perl -i` and the PowerShell cmdlets. `cp` and `mv` over one are not; parity is reported after them.

## 2.2.0 — 2026-11-12

### Added

- The rule gate. When a rule is written to `CLAUDE.md` or `AGENTS.md`, fixed checks with no model judge whether it is inferable from the repo, already enforced by a tool or a `permissions.deny` rule, generic advice, an absolute ban that belongs in a hook, a long procedure, or shouted. The verdicts are `keep`, `cut`, `move`, `rewrite` and `conflict`. A rule that names a path or script the repository does not have is kept with the note `unresolved-reference`, which says what did not resolve; the skill checks it and repairs it if it moved. See *The rule gate* in the README.
- Detectors that use the repository as their dictionary: the heading and sentence `/init` writes (`file-filler`), a list of the manifest's dependencies with nothing but names and versions (`inferable-stack`, or `conflict` · `stale-version` when a version disagrees with `package.json`), a script described only by its own name and command (`inferable-script`), a summary made of the manifest's description and the README (`inferable-overview`), and an existing path with a short description in words of that file (`inferable-path`).
- `gate_paths` option, `false` by default, and `--paths` on the command line: turn on the described-path check. It is off because a description built from words of the file is not proof the file says it.
- `gate` option: `report` (default; the edit goes through and Claude is told), `ask` (you confirm each flagged rule) or `off`. Where nobody can answer a prompt, `ask` acts as `report`.
- `.claude/themis-accepted.json`: rules you approved after a flag are remembered by the hash of their text, so they are not flagged again until they change. Entries under `fix` · `dead-reference`, which no check gives any more, still load.
- `hooks/dist/gate.js` with `check`, `audit` and `report` commands. `report` measures a labelled corpus.
- A regression corpus of 794 cases on 68 small repositories. A case can name a note the kept rule must carry.
- Two held-out corpora, measured blind; the numbers are in [RESULTS.md](RESULTS.md). The first, 1,502 rules from 40 public repositories (1,499 once three bare `---` lines stopped counting as rules), measured the first checks: precision of interruption 62.0%, false-cut rate 6.3%, recall 16%. The checks it showed to flag informative rules were fixed and the new detectors were built on it, so it is now development data. The second, 1,223 rules from 40 other repositories (22 `AGENTS.md`, 18 `CLAUDE.md`), measured the frozen detectors: 99 interruptions, precision 73.7%, false-cut rate 3.1%, recall 19.5%, against an estimate of about 50%. With `--paths`, 103 interruptions, precision 74.8%. Both runs found that a reference that does not resolve was the main source of false interruptions (27 of 73 firings correct on the first corpus, 1 of 18 on the second), so it became the note `unresolved-reference` instead of the verdict `fix` · `dead-reference`, and such a rule is still checked for emphasis; on the second corpus, not blind since this change was decided from it, the gate interrupts 81 rules with precision 84.0%, false-cut rate 1.5% and recall 18.2%. The condition for making `ask` the default, a precision of 95% on at least 100 interruptions, was not met, so the default is `report`. The labels of neither corpus have been reviewed, so the numbers are provisional.
- The snapshots of third-party repositories are not stored in the repository; `tests/gate/holdout/collect.mjs` and `fetch-cited.mjs` rebuild them from the commits in `sources.json`, with the commands in each corpus's `SOURCES.md`. The unlabelled copies of the cases are not stored either; `unlabel.mjs` writes them.
- A CI step that runs the gate on Node.js 18.

### Changed

- The skill no longer decides by its own judgment what belongs in a rule file: `edit`, `init` and `audit` run the gate and follow its verdict, and `audit` shows its table.

### Known limits

- Node, JavaScript and TypeScript repositories only; English and Spanish phrase tables.
- The check on whether recent models already do something by default is not active yet.
- In a repository with more than one `package.json` a missing script gets no note, and a path counts as present when a tracked path ends with it, so a dead reference there can go unnoticed.
- The gate flags about one redundant rule in five. Its verdicts are a floor for what can go, not a full audit.
- Bare level-1 titles (`# CLAUDE.md`, a title that is only the package name) are cut, while the labellers of the second corpus kept them: 9 of its 13 remaining false interruptions. Which is right is not settled.
- The session evals c13 to c15 were not re-run with the gate. The c14 grader still requires removing "double-check" lines, which the gate keeps. (Both done in 2.3.0.)

## 2.1.1 — 2026-10-10

### Fixed

- A session opened outside a git repository, such as a home directory, reported on the `CLAUDE.md` and `AGENTS.md` of every project up to four levels below it. Outside a repository themis now checks the working directory and its `.claude/` only. Inside one nothing changes: the working directory up to the repository root, and every directory below it.

### Changed

- A directory that holds only one of the two files is no longer reported at session start or after a shell command. Only a pair whose two files both exist can be out of step. The missing file is still created when you edit the one that exists, or by `sync`.

## 2.1.0 — 2026-10-08

No change to what the plugin does. The requirement stays Node.js 18 or later.

### Changed

- Every script is strict TypeScript: the hooks, their tests, the evaluation runner and graders, and the scripts that build the logo files and animations. No `.mjs` file is left.
- The hooks run from `hooks/dist/`, compiled from `hooks/*.ts` and committed, so installing still needs no build step. `hooks.json` points there.
- A hook payload is read as unknown data and checked field by field. A field of the wrong type counts as absent.
- The tests and the scripts in `evals/` and `assets/` run as `.ts` files and need Node.js 22.18 or later. This affects contributors, not users of the plugin.

### Added

- `tsconfig.json` with `strict` and the checks beyond it (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `verbatimModuleSyntax`, unused locals and parameters).
- ESLint with the `strictTypeChecked` and `stylisticTypeChecked` rule sets of typescript-eslint, plus rules for type imports, explicit types on exports, single quotes and semicolons. Warnings fail the run.
- CI on every pull request: typecheck, lint, build, a comparison of `hooks/dist/` with its source, the tests, and a run of the compiled hooks on Node.js 18.
- Releases from CI: when a version in `.claude-plugin/plugin.json` that has no tag reaches `main`, the checks run, the tag `v<version>` is created and the GitHub release is published with that version's section of this file.

### Not converted

- `evals/cases/*/fixture/`: the JavaScript there is test data, the small repositories the evaluation cases hand to a session. Changing it would invalidate the measurements in RESULTS.md.
- The script inside `assets/motion/source/scenes.html`, which runs in the browser that renders the animations.

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
