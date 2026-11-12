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

The gate (`hooks/dist/gate.js`, new in 2.2.0) judges each rule with fixed checks and no model. It was measured on two corpora it had never seen: the first for the checks of the first version, the second for the detectors added after it.

The snapshots of third-party repositories that both corpora run against are not stored in this repository (see `tests/gate/.gitignore`). The rules, labels, commits and licences are stored; `collect.mjs` and `fetch-cited.mjs` in `tests/gate/holdout/` rebuild the snapshots from GitHub at the recorded commits, with the commands in each corpus's `SOURCES.md`. Rebuilt first-corpus snapshots also contain `.gitignore` and the source files the rules cite, which the snapshots of the original blind run did not, so that run's figures may not reproduce exactly.

### First held-out corpus

**The corpus.** `tests/gate/holdout.jsonl`: 1,502 rules from 40 public repositories when measured (1,499 now: three bare `---` lines were removed once the parser stopped treating them as rules), all of them the root `CLAUDE.md` of a Node, JavaScript or TypeScript project. The repositories are listed in `tests/gate/holdout/SOURCES.md`, with the commit and licence of each. No repository that has only an `AGENTS.md` made it in, because the code search that finds candidates hit a rate limit.

**The labels.** Each rule was labelled once, by one of four labelling agents; each agent was given a quarter of the repositories. Each had the rule, a snapshot of the repository and plain-language definitions of the verdicts, and was instructed not to read the gate's code, its tables, the regression corpus or its output. That was an instruction, not an enforced restriction. Labels: 909 keep, 475 cut, 59 fix, 29 move, 16 rewrite, 14 conflict.

**The measurement was blind.** The gate's tables and checks were frozen in commit 9995519 before the corpus was collected, and nothing was tuned before this run. The changes made after it, and their numbers, are kept apart below.

```
node hooks/dist/gate.js report tests/gate/holdout.jsonl
```

The figures below were measured at commit 9995519. At the current commit the same command prints the figures of the current checks, which are in the last table of this section.

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

A review of the blind run found checks that flagged rules carrying information, and they were changed: a script rule is cut only when every word around the command is neutral (run, use, the, with…) or names that script's own job (test, tests, unit for `test`; lint, linter for `lint`…); a title only as a heading whose other words are all filler; a tree only when no entry carries a comment; question 7 reports a missing script only in its `run` form and never when the repository has another `package.json`, counts a path as present when a tracked path ends with it, strips line ranges and symbols, and no longer judges a path whose first segment the repository does not have; question 6 counts the content lines of a code block, without fences and blank lines; "keep it updated" counts as filler only when the rule names the file; and `---` is no longer parsed as a rule, which removed three cases (all three labelled cut), so this run has 1,499 cases against the blind run's 1,502.

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

**This corpus is now development data.** The detectors described below were designed and reviewed on it, and one label was changed after a reviewer checked the cited file (`mateenagy__vue-formify-16`, keep to cut), so it has 908 keep labels instead of 909. Its current numbers are an upper bound, not a validation, and were taken while the source files its rules cite were only partly stored. They do not count toward the condition for `ask` as the default, however high:

| | at d176786 | after demoting dead-reference |
|---|---|---|
| interrupted | 128 | 112 |
| precision of interruption, some interruption deserved | 93.8% | 100.0% (112 of 112) |
| recall | 20.3% | 19.0% (112 of 591) |
| with `--paths`: interrupted, precision, recall | 140, 94.3%, 22.3% | 124, 100.0%, 21.0% |

### Second held-out corpus

This corpus measures the detectors added after the first measurement: the `/init` heading and sentence (`file-filler`), described paths (`inferable-path`), stack lists (`inferable-stack`, and `stale-version` when a version disagrees with the manifest), described scripts (`inferable-script`) and project summaries (`inferable-overview`). Before measuring, they were estimated to bring recall from 16% to about 50%. That estimate came from counting patterns among the rules the gate missed on the first corpus; it was not a measurement.

**The corpus.** `tests/gate/holdout2.jsonl`: 1,223 rules from 40 public repositories not used before, 22 of them taken from `AGENTS.md` and 18 from `CLAUDE.md`, at most 40 rules per file. The repositories, commits and licences are in `tests/gate/holdout2/SOURCES.md`. Each snapshot also holds the source files the rules cite (up to 64 KB each), every `package.json` of the repository (up to 30) and `.gitignore`, which the first corpus's snapshots lacked.

**The labels.** Each rule was labelled once, by one of four labelling agents; each agent was given a quarter of the repositories and was instructed not to read the gate's code, tables, corpora or output. The instructions were the first corpus's plus three clarifications fixed before any of this data was seen: a path found under a deeper directory exists; a script defined in any `package.json` of the repository exists; a path with a plain description is inferable unless it adds a warning. So the labels are not strictly comparable with the first corpus. Labels: 849 keep, 305 cut, 36 move, 22 rewrite, 7 conflict, 4 fix.

**The measurement was blind.** The detectors were frozen at commit d176786 before the gate was run on this corpus. The collection did not read the detectors, and the two review rounds that reshaped the detectors did not read this corpus.

```
node hooks/dist/gate.js report tests/gate/holdout2.jsonl
node hooks/dist/gate.js report tests/gate/holdout2.jsonl --paths
```

The figures below were measured at commit d176786. At the current commit the same commands print the figures after the demotion, given in the next section.

| | default (`gate_paths` off) | with `--paths` |
|---|---|---|
| rules | 1,223 | 1,223 |
| interrupted | 99 | 103 |
| **precision of interruption** | **73.7%**: 73 of 99 deserved some interruption; 61 of 99 got the same verdict as the label | **74.8%**: 77 of 103; 65 of 103 the same verdict |
| **false-cut rate** | **3.1%**: 26 of the 849 rules labelled keep | 3.1%: the same 26 |
| coverage | 38.5% | 38.6% |
| recall: rules labelled other than keep that were interrupted | 19.5% (73 of 374) | 20.6% (77 of 374) |

By the gate's verdict, in the default configuration:

| gate said | rules | same as label |
|---|---:|---:|
| cut | 29 | 18 |
| fix | 18 | 1 |
| move | 43 | 33 |
| rewrite | 9 | 9 |
| keep | 1,124 | 823 |

By reason code, in the default configuration. "Deserved" counts the rules whose label is anything other than keep; "same" those whose label is the gate's verdict. The counts come from a dump of every verdict of the run.

| code | verdict | fired | deserved | same |
|---|---|---:|---:|---:|
| `long-procedure` | move | 40 | 38 | 30 |
| `dead-reference` | fix | 18 | 5 | 1 |
| `file-filler` | cut | 16 | 9 | 9 |
| `emphasis` | rewrite | 9 | 9 | 9 |
| `inferable-title` | cut | 6 | 4 | 4 |
| `duplicated-passage` | move | 3 | 3 | 3 |
| `inferable-script` | cut | 3 | 3 | 3 |
| `inferable-overview` | cut | 2 | 1 | 1 |
| `inferable-stack` | cut | 1 | 1 | 1 |
| `inferable-tree` | cut | 1 | 0 | 0 |

No other code fired; `stale-version`, `generic-advice` and `absolute-command` among them. With `--paths` the table is the same plus `inferable-path`: it fired 4 times, and all 4 were labelled cut. Four is too few to say anything about that detector's precision. It stays off by default, because an adversarial review showed that a description built from words that are in the cited file is not proof that the file says it.

The 26 false interruptions (rules labelled keep that the gate interrupted), by cause:

| cause | rules |
|---|---:|
| `fix dead-reference`: a bare extension such as `.json` or `.svelte.test.ts` (5), a placeholder or pattern such as `integrations/...` or `batch[1-4]` (2), a path absent from the snapshot such as `config/labby.db` (6) | 13 |
| a bare level-1 title: `# CLAUDE.md`, `# AGENTS.md`, `# Agent Guidance`, a title that is only the package name (7 as `file-filler`, 2 as `inferable-title`) | 9 |
| `move long-procedure` | 2 |
| `inferable-overview` on a licence header comment that the repository's CI checks | 1 |
| `inferable-tree` on a numbered description of a flow | 1 |

The nine titles are a disagreement between labellers, not clearly a fault of the gate: the labellers of this corpus kept titles as structure, those of the first corpus cut them. The owner has to settle which is right. Counting those nine as correct would give a precision of 82.8% (82 of 99).

**The condition for `ask` as the default is not met.** It is a precision of interruption of at least 95% on at least 100 interrupted rules; this run reached 73.7% on 99. The default of `gate` stays `report`, and `gate_paths` stays `false`.

**What this means.** In report mode the gate flags about one redundant rule in five (19.5%), and about one in four of its flags (26 of 99) is wrong. Recall was 16% on the first blind run and is 19.5% here, far from the estimated 50%. Those two figures come from two corpora labelled with different instructions, so their difference is not a measured gain. The largest family, a path with a description, could not be made safe by script and is off by default. Described scripts and plain stack lists had no wrong firings, but fired only 3 and 1 times. The `/init` boilerplate (`file-filler`) was right 9 of 16 times, and every miss was a bare title, which is the disputed case. The gate's verdicts are a floor for what can go, not a full audit of a file.

### After demoting dead-reference to a note (not blind)

Both blind runs found that `dead-reference` is the main source of false interruptions: 27 of its 73 firings matched the label on the first corpus, 1 of 18 on the second. So a reference that does not resolve no longer interrupts. The rule is kept with the note `unresolved-reference`, which names the path or script that was not found. **This change was decided from the two measurements, so the numbers below are not blind.** In the same step, and also not blind, a rule with an unresolved reference is still checked for emphasis: `` IMPORTANT: see `src/missing.ts` `` is a `rewrite`, where the first version of the demotion kept it whole. That second adjustment changed no figure on this corpus. Nothing else was changed or tuned against the second corpus, apart from replacing a test e-mail address and password in one rule's text with `[redacted]`, which leaves its verdict as it was. The gate as shipped, after the demotion, has no blind measurement.

| second corpus | blind, at d176786 | after the demotion |
|---|---|---|
| interrupted | 99 | 81 |
| precision of interruption, some interruption deserved | 73.7% (73 of 99) | 84.0% (68 of 81) |
| precision of interruption, same verdict as the label | 61.6% (61 of 99) | 74.1% (60 of 81) |
| false-cut rate | 3.1% (26 of 849) | 1.5% (13 of 849) |
| coverage | 38.5% | 38.5% |
| recall | 19.5% (73 of 374) | 18.2% (68 of 374) |
| with `--paths`: interrupted, precision, false-cut rate, recall | 103, 74.8%, 3.1%, 20.6% | 85, 84.7%, 1.5%, 19.3% |

Of the 18 rules that carry the note now, 13 were labelled keep, 3 cut, 1 rewrite and 1 fix. The 13 false interruptions left are the nine titles, two long procedures, the licence header and the flow description. Counting the nine titles as correct would give 95.1% (77 of 81), on fewer than the 100 interruptions the condition asks for and not blind, so the condition is not met either way.

### What the gate numbers do not cover

- **The labels have not been reviewed by the user.** The plan has a review step: a sample of 30 labels, plus every case where the gate interrupts and the label says keep. It has not been done for either corpus, so every number above is provisional until it is. The disagreement on bare titles has to be settled there.
- **One label per rule.** No rule was labelled twice, so the agreement between labellers is unknown; the tail-of-path cases of the first corpus and the titles of the second show it is not perfect.
- **The 1.x session evals c13 to c15 were not re-run with the gate.** One mismatch is known. The c14 grader (`evals/cases/c14-themis-audit/grade.ts`) requires "double-check" lines to be removed, while the gate keeps "Double-check your work" and "Be thorough", because no vendor guide for a model in the two-month window asks to remove them. c14 as graded today would fail on that line. The grader also requires the stale `npm run test:unit` to be gone: since the demotion the gate keeps that line with an `unresolved-reference` note, and the skill tells Claude to check the reference and repair it, as it did for `fix`. That path has not been run in a session.
- **The regression corpus is not a measurement.** `tests/gate/corpus.jsonl` has 794 cases on 68 small repositories, with 50 recorded gaps. It pins the gate's behaviour so a change is noticed, but its labels were written alongside the checks.
- **Root rule files of Node projects only.** No other language. The first corpus has only `CLAUDE.md` files and takes the first 60 rules of a file; the second takes 22 `AGENTS.md` and 18 `CLAUDE.md` files and the first 40 rules.
- **Small counts per code.** Most reason codes fired fewer than ten times on the second corpus, and several not at all, so their precision is not known.
- **No model-behaviour check.** The question "do recent models already do this by default?" is not active, so nothing here measures it.

## Re-running

```
node evals/run.ts --case "c1*,c20*" --arms base,themis --runs 3 --tag mytag   # billed sessions
node evals/report.ts base=mytag themis=mytag
node hooks/dist/gate.js report tests/gate/holdout.jsonl    # the gate, no billing
node hooks/dist/gate.js report tests/gate/holdout2.jsonl   # add --paths for the described-path detector
```

The held-out reports need the snapshots, which are not stored here: rebuild them as `tests/gate/holdout/SOURCES.md` and `tests/gate/holdout2/SOURCES.md` describe. Each case's fixture, prompt and grader are in `evals/cases/`. The cases and results for the parts removed in 2.0.0 are in the git history before that release.
