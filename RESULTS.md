# Results

What was measured about the parts that themis 2.0.0 keeps, and the rule gate added in 2.2.0. The numbers come from the 1.x evaluation rounds: headless sessions on `claude-opus-5-5` at `medium` effort, each in a fresh temp git repo, with user settings, hooks and plugins excluded in every arm (`--setting-sources project,local`).

- **base**: no plugin. For `init` the base prompt is the built-in `/init`; for `audit` it is the same request in plain words.
- **themis**: the plugin, loaded with `--plugin-dir`.

| case | targets | base | themis | base $/run | themis $/run |
|---|---|---:|---:|---:|---:|
| c13-themis-init | lean CLAUDE.md with the real gotchas (vs `/init`) | 0/3 | **3/3** | $0.134 | $0.158 |
| c14-themis-audit | prune a bloated CLAUDE.md, keep gotchas, fix stale commands | 0/3 | **3/3** | $0.128 | $0.241 |
| c15-cap | adding to a CLAUDE.md near the cap stays under it | 0/3* | **3/3** | $0.134 | $0.174 |
| c20-cap-shell | shell appends to CLAUDE.md are blocked | — | 3/3 | — | $0.122 |

\* On the calibrated fixture. The first fixture (3/3) sat far below the cap and tested nothing.

## What these numbers do not cover

- **They were not re-run for 2.0.0.** They were taken on 1.0.0, when the skill was called `hestia`, was user-invoked only, and ran next to a resident rule that 2.0.0 removes. The skill's text on what belongs in the file is unchanged; its AGENTS.md and sync parts are new.
- **Parity has no session-level measurement.** Copying an edit to the other file, refusing an edit while the two differ and the session-start report are covered by the hook tests in `tests/hooks.test.ts`, which are deterministic. How reliably a model asks the user instead of choosing a version was not measured.
- n is 3 per cell, so small effects are invisible.
- The fixtures are small Node repos.
- Graders are deterministic regexes and file checks. In the themis arm they now also require `AGENTS.md` to be an exact copy of `CLAUDE.md`; that check has not been run in a session.
- The token estimate for the cap is characters ÷ 3.6. It is not calibrated against the real tokenizer.

## Rule gate

The gate (`hooks/dist/gate.js`, new in 2.2.0) judges each rule with fixed checks and no model. It was measured on a corpus it had never seen.

**The corpus.** `tests/gate/holdout.jsonl`: 1,502 rules from 40 public repositories when measured (1,499 now: three bare `---` lines were removed once the parser stopped treating them as rules), all of them the root `CLAUDE.md` of a Node, JavaScript or TypeScript project. The repositories are listed in `tests/gate/holdout/SOURCES.md`, with the commit and licence of each. No repository that has only an `AGENTS.md` made it in, because the code search that finds candidates hit a rate limit.

**The labels.** Each rule was labelled once, by one of four labelling agents; each agent was given a quarter of the repositories. Each had the rule, a snapshot of the repository and plain-language definitions of the verdicts, and was instructed not to read the gate's code, its tables, the regression corpus or its output. That was an instruction, not an enforced restriction. Labels: 909 keep, 475 cut, 59 fix, 29 move, 16 rewrite, 14 conflict.

**The measurement was blind.** The gate's tables and checks were frozen in commit 9995519 before the corpus was collected, and nothing was tuned before this run. The changes made after it, and their numbers, are kept apart below.

```
node hooks/dist/gate.js report tests/gate/holdout.jsonl
```

| | |
|---|---|
| rules | 1,502 |
| interrupted (verdict other than keep) | 150 |
| **precision of interruption** | **62.0%**: 93 of the 150 were labelled as deserving some interruption; 76 of the 150 got the same verdict as the label |
| **false-cut rate** | **6.3%**: 57 of the 909 rules labelled keep were interrupted (45 as `fix dead-reference`, 7 as `move long-procedure`, 5 as `cut inferable-script`) |
| coverage | 42.4% |

By the gate's verdict, how many of its answers matched the label exactly:

| gate said | rules | same as label |
|---|---:|---:|
| cut | 24 | 16 |
| fix | 73 | 27 |
| move | 46 | 26 |
| rewrite | 7 | 7 |
| keep | 1,352 | 852 |

Recall is low, by design: the gate is built to leave a rule alone when in doubt. Of the 593 rules labelled as anything other than keep, it flagged 93 (16%). Of the 475 labelled cut, it cut 16.

The 57 false interruptions (rules labelled keep that the gate interrupted), by cause:

| cause | rules |
|---|---:|
| script that lives in another `package.json` | 11 |
| path that resolves as the tail of a tracked path (`src/module.ts` for `packages/core/src/module.ts`) | 16 |
| line-range or symbol suffix on a live path (`a.ts:146-162`, `a.ts::fn()`) | 4 |
| build output or runtime data | 5 |
| a file the rule says is absent or is to be created | 4 |
| a hypothetical example path | 2 |
| a URL without a scheme | 1 |
| an agent memory file | 2 |
| a code block of 8 or fewer content lines, flagged `long-procedure` | 7 |
| `inferable-script` | 5 |

Three things qualify these numbers:

- **The gate ran on reduced snapshots.** `collect.mjs` stored the files the gate reads, but not `.gitignore`, which question 7 reads to skip ignored paths. A path the repository ignores could be reported as missing.
- **The labels on tail-of-path cases are inconsistent.** For the same situation, a path that exists under a deeper directory, labellers said `fix` 15 times and `keep` 16 times.
- **5 `inferable-script` cuts were labelled keep only because the snapshot lacked a sub-package manifest.** The same shape was labelled cut elsewhere.

**The condition for `ask` as the default was not met.** It was a precision of interruption of at least 95% on at least 100 interrupted rules. The gate interrupted enough rules (150) and reached 62.0%. The default of the `gate` option stays `report`.

### After the fixes that the measurement prompted (not blind)

A review of the blind run found checks that flagged rules carrying information, and they were changed: a script rule is cut only when everything around the command is a label from a closed list; a title only as a heading whose other words are all filler; a tree only when its comments are short plain descriptions; question 7 reports a missing script only in its `run` form and never when the repository has another `package.json`, counts a path as present when a tracked path ends with it, strips line ranges and symbols, and no longer judges a path whose first segment the repository does not have; question 6 counts the content lines of a code block, without fences and blank lines; "keep it updated" counts as filler only when the rule names the file; and `---` is no longer parsed as a rule, which removed three cases (all three labelled cut), so this run has 1,499 cases against the blind run's 1,502.

**These checks were changed after seeing this corpus, so the numbers below are an upper bound for it, not a validation.** A new held-out corpus is needed to measure them.

| | blind (1,502 rules) | after the fixes (1,499 rules) |
|---|---|---|
| interrupted | 150 | 65 |
| precision of interruption, some interruption deserved | 62.0% (93 of 150) | 87.7% (57 of 65) |
| precision of interruption, same verdict as the label | 50.7% (76 of 150) | 70.8% (46 of 65) |
| false-cut rate | 6.3% (57 of 909) | 0.9% (8 of 909), all `fix dead-reference` |
| coverage | 42.4% | 40.1% |
| recall: rules labelled other than keep that were interrupted | 15.7% (93 of 593) | 9.7% (57 of 590) |

The 95% condition is still not met: precision is 87.7%, and 65 interruptions are fewer than the 100 it requires. The default stays `report`.

### What the gate numbers do not cover

- **The labels have not been reviewed by the user.** The plan has a review step: a sample of 30 labels, plus every case where the gate interrupts and the label says keep. It has not been done, so every number above is provisional until it is.
- **The 1.x session evals c13 to c15 were not re-run with the gate.** One mismatch is known. The c14 grader (`evals/cases/c14-themis-audit/grade.ts`) requires "double-check" lines to be removed, while the gate keeps "Double-check your work" and "Be thorough", because no vendor guide for a model in the two-month window asks to remove them. c14 as graded today would fail on that line.
- **The regression corpus is not a measurement.** `tests/gate/corpus.jsonl` has 681 cases on 66 small repositories, with 32 recorded gaps. It pins the gate's behaviour so a change is noticed, but its labels were written alongside the checks.
- **Root `CLAUDE.md` files of Node projects only.** No `AGENTS.md`-only repository, no other language, and a file of more than 60 rules contributes its first 60.
- **No model-behaviour check.** The question "do recent models already do this by default?" is not active, so nothing here measures it.

## Re-running

```
node evals/run.ts --case "c1*,c20*" --arms base,themis --runs 3 --tag mytag   # billed sessions
node evals/report.ts base=mytag themis=mytag
node hooks/dist/gate.js report tests/gate/holdout.jsonl   # the gate, no billing
```

Each case's fixture, prompt and grader are in `evals/cases/`. The cases and results for the parts removed in 2.0.0 are in the git history before that release.
