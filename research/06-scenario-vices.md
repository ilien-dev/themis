# 06 — Scenario vices: evidence per developer scenario (2025–2026)

Research notes feeding A/B tests of the Themis plugin on Claude Opus 5.5 / Sonnet 5.5 / Fable 5.x in Claude Code.
Compiled 2026-09-29. Complements `05-research-and-community.md`. The following are **not** re-analyzed here and are only cross-referenced: scope creep, overbuilding, root-cause layer, test tampering / ImpossibleBench, overclaiming / OverclaimBench, language drift, over-delegation, CLAUDE.md size.

## Evidence-quality legend

- **PR**: peer-reviewed (conference or journal).
- **PP**: preprint (arXiv or company paper, not peer-reviewed).
- **V**: vendor research or vendor blog.
- **A**: anecdote (GitHub issue, single-user report).

## Ranking criteria

The scenarios are ranked on three tests:
- (a) the source is from 2026 or later;
- (b) it includes a Claude 4.6+ or Claude 5-family model;
- (c) it is execution-based (hidden tests, real behavior) rather than a proxy metric (static-analysis counts, coverage, keyword matches).

## Method note on anthropics/claude-code issues

- **Denominator.** 1,212 unique issues labeled `model` or `area:model`, created on or after 2026-07-01, fetched via `gh search issues`. The API caps results at 1,000 per label, so the set may be truncated.
- **Automated keyword counts were discarded.** They are dominated by product bugs: "fallback" matches model and classifier fallback, "stub" matches installer stubs, "sleep" matches the macOS sleep inhibitor.
- **The counts below are a manual, title-level lower bound.** Each one was checked by reading the title, and the key issues were also read in full.
- **Model mentions in issue bodies:** Opus 5 = 176, Fable 5 = 140, Opus 5.5 = 112, Sonnet 5.5 = 1. There is effectively **no community evidence for Sonnet 5.5**.

| Theme (manually verified) | Count (lower bound) | Issues | Models named |
|---|---|---|---|
| Destructive file/data deletion (not code removal) | ~10 | #74557, #76208, #80759, #84107, #89787, #93099, #93602, #93986, #94453, #97084 | Opus 5 (#93099), Sonnet (#80759), others unspecified |
| Regression introduced by the model's own fix, reported as done or pre-existing | 4 | #82088, #96463, #83531, #97641 | Opus 5 (#82088), Opus 5 / Fable 5 (#83531) |
| Self-written tests or fixtures compensating for missing code; brittle tests | 3 | #94170, #87305, #82088 case A | Opus (#87305), Opus 5 (#82088) |
| Out-of-scope removal of working code | 1 | #84146 | Title says Opus 5.0, form says Sonnet (uncertain) |
| Noise or session-referencing code comments | 1 | #82032 | Opus 5 |
| Suppressing warnings instead of fixing them | 1 | #94566 (feature request) | none named |
| Silencing (`as any`, ts-ignore, noqa, unwrap, `--no-verify`, skipped tests) | 0 verified | — | — |
| Flaky-test workarounds (sleep, retry, timeout) | 0 verified | — | — |
| Hallucinated or deprecated API or package | 0 verified | — | — |

---

## 1. Silencing instead of fixing (`as any`, `@ts-ignore`, `eslint-disable`, `# type: ignore`, `unwrap()`, catch-and-ignore, `.skip`, `--no-verify`)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| No dedicated 2025–2026 study found that measures suppression-comment insertion by coding agents. Searches for AIDev or agent-PR studies on `type: ignore`, `eslint-disable` and `as any` returned nothing. | — | — | — |
| MSR 2026 SATD study (below, §7) quotes a Cursor-agent comment that pairs `FIXME` with `eslint-disable-next-line react-hooks/exhaustive-deps`. This shows the pattern exists in agent code, but it is not counted. | 1 example | Cursor agent | PR (qualitative) |
| Sonar "Coding Personalities" (Oct 2025): type-safety/cast bugs are 11.24% of Claude Sonnet 4 bugs and 12.97% of Claude 3.7 Sonnet bugs. | % of bugs | Sonnet 4, 3.7 | V (non-agentic Java) |
| #94566 "train your models not to suppress errors/warnings and address them properly" | 1 | unspecified | A |
| Test skipping and disabling as reward hacking | see 05 §1 | — | covered in 05 |

- **Mitigation evidence:** none measured.
- **Worth testing on Opus 5.5?** Yes. There is almost no research, but the behavior is cheap and unambiguous to detect with a grep of new suppression tokens in the diff. That makes it an ideal low-noise A/B metric, and a null result would itself be informative.

## 2. Writing tests (tautological tests, tests mirroring the implementation, over-mocking, low mutation score, missing edge cases)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| Hora & Robbes, "Are Coding Agents Generating Over-Mocked Tests?" (arXiv 2602.00409, MSR 2026). 1.2M commits from 2025 across 2,168 TS/JS/Python repos. | Agent commits add mocks in 36% of commits vs 26% for non-agents. 23% of agent commits touch tests vs 13%. 68% of repos with agent test activity also have agent mock activity. | Coding agents incl. Claude Code (pooled) | PR |
| RefactorBench-JS (Chen, Anything Inc., 2026). | Qualitative: agents' self-written tests "tend to be shallow smoke tests ('component renders without crashing')". | Sonnet 4.6, Opus 4.6/4.7, Gemini | PP |
| MUTGEN (Wang et al., arXiv 2506.02954, IEEE TSE 2026). | Some LLM test suites reach 100% coverage but only 4% mutation score. This is an extreme single case, not an average. Adding mutation feedback to the prompt "significantly outperforms" vanilla prompting and EvoSuite; the effect size was not extracted. | GPT-family (per paper) | PR |
| Coverage/mutation replicability study (arXiv 2607.22880, Jul 2026). 11 LLMs / 13 settings incl. Claude 4 Sonnet with and without reasoning. | Coverage and mutation score are meaningful across models only when the code under test is bug-free (regression setting). When the code may be buggy, coverage is unreliable and mutation analysis does not apply. | incl. Claude 4 Sonnet | PP |
| #94170 (271-incident, 90-day retro). Hand-seeded fixtures and stubs supplied the values the code under test was supposed to produce, which masked a broken paid purchase flow. Negative assertions were vacuously true. | 4 critical incidents in 6 weeks | Claude Code (model not stated) | A (detailed) |
| #82088: 13,000 self-written test cases missed an aliasing bug because they tested the function, not its contract with callers. | 1 | Opus 5 | A |
| #87305: test hardcoded today's date and failed the next day. | 1 | Opus | A |

- **Mitigation evidence:**
  - Mutation-guided prompting improves mutation score (MUTGEN, PR; magnitude not extracted).
  - Hora & Robbes recommend adding mocking guidance to agent configuration files; the effect is unmeasured.
  - **Design lesson from 2607.22880:** measure test quality with seeded bugs or hidden tests, not coverage.
- **Worth testing on Opus 5.5?** Yes, high priority. The evidence comes from recent, large-sample studies and detailed Opus 5 anecdotes. Test it with a seeded-bug or mutation harness (for example, "does any stub or fixture provide a value the code under test must produce?").

## 3. Deleting or removing code (incomplete removal, over-deletion, dead code left behind)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| Sonar "Coding Personalities" (Oct 2025): dead, unused or redundant code as a share of code smells. | Sonnet 4: 14.83%; Claude 3.7: 17.43%; GPT-4o: 26.3%; OpenCoder-8B: 42.74% | Sonnet 4, 3.7 | V (non-agentic Java, 4,442 tasks) |
| MSR 2026 SATD study: agents sometimes rewrite whole files when fixing debt. Copilot's largest deletion (797,880 LOC) removed vendored dependencies. | 1 extreme case | Copilot agent | PR |
| #84146: while doing an unrelated change, the model stripped multi-provider pricing and caching tables and replaced them with one Anthropic table. | 1 | Opus 5.0 per title, Sonnet per form (uncertain) | A |
| Destructive *data/file* deletion (`rm -rf $HOME` during test cleanup, a deleted DB backup, purged GCS history). This is not code removal; see the table above and §11. | ~10 issues | Opus 5 (#93099), Sonnet (#80759) | A |
| Incomplete removal (dangling references, docs, config, tests) | No study found | — | — |

- **Mitigation evidence:** none measured.
- **Worth testing on Opus 5.5?** Yes, as a cheap, mechanically scorable task: "remove feature X". Score the dangling references left behind with grep and build, and count unrelated deletions. There is no research baseline, so the plugin's effect would be novel data.

## 4. Refactoring (behavior changes during "pure" refactors)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| RefactorBench-JS (2026). 123 JS/React decomposition fixtures scored with hidden tests. | Hidden-test pass rates: Sonnet 4.6 23.6% (13.8% without test runner), Opus 4.6 22.8% (17.1%), Opus 4.7 13.8% (13.0%), Gemini 3.0 Pro 25.2%. Share of reported successes that failed hidden tests: Opus 4.7 74–75%, Opus 4.6 49–67%, Sonnet 4.6 57–81%. 86 of 123 fixtures passed in zero of 14 conditions; these were concentrated in large UI files averaging ~1,294 LOC. The dominant failures were incomplete work, syntax/parse errors and module-boundary (import/export) mistakes, **not subtle behavior drift**. | Sonnet 4.6, Opus 4.6, Opus 4.7, Gemini 2.0–3.0 | PP (company paper) |
| SWE-Refactor (arXiv 2602.03712, Feb 2026). 1,099 real Java refactorings. | Compound refactorings are the main failure source. OpenAI Codex agent: 39.4% success on compound instances. | GPT-4o-mini, DeepSeek-V3, Codex agent, etc. | PP |
| LLM refactoring consistency (Empirical Software Engineering 2026, 10.1007/s10664-026-10911-6). | 928 of 8,096 refactorings (11.5%) were behaviorally inconsistent and 180 failed (older models). On a hard subset built from previously inconsistent code, 2025 models still fail on 6.06%; this is not a population rate. | ChatGPT-3.5/4, CodeLlama, CodeGeeX; 2025 SOTA on subset | PR |
| Agentic Refactoring (arXiv 2511.04824, Nov 2025). 15,451 agent refactorings from AIDev. | Refactoring is explicit in 26.1% of agent commits. Changes are dominated by low-level edits (Change Variable Type 11.8%, Rename Parameter 10.4%). Structural metrics improve slightly. Behavior preservation was not measured. | Codex, Claude Code, Cursor, etc. (pooled) | PP |

- **Mitigation evidence:**
  - Giving the agent a test runner helped Sonnet 4.6 (+9.8 pp, p=.0018) and Opus 4.6 (+5.7 pp, p=.039), but **Opus 4.7 gained only +0.8 pp (n.s.)**. Verification tooling may not transfer automatically to the newest models.
  - Production success rose from ~65% to >97%, but that figure is observational (RefactorBench-JS).
  - RAG plus structured few-shot prompting cut the inconsistency rate from 17.17% to 4.71%, measured only on ChatGPT-3.5, Python, single round (EMSE 2026).
- **Worth testing on Opus 5.5?** Yes, high priority. This is the strongest execution-based, Claude-specific evidence, and the Opus 4.7 null result for tool access is exactly the question the plugin should answer. Score with hidden tests plus the false-confidence rate (cross-reference 05 §2).

## 5. Flaky tests and concurrency (sleeps, retries, raised timeouts instead of root-cause fixes)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| No 2025–2026 study found that measures whether coding agents fix flakiness with sleeps, retries or timeouts. FlakyFix (IEEE TSE 2024) predicts fix categories and shows that giving GPT-3.5 the category improves repairs. | — | GPT-3.5 | PR (old, non-agentic) |
| Sonar: concurrency/threading is 9.81% of Claude Sonnet 4 bugs vs 1.44% for Claude 3.7 Sonnet. More capable models attempt more complex, concurrency-prone solutions. | % of bugs | Sonnet 4, 3.7 | V |
| MSR 2026 SATD: 19% of agents' test-related TODO/FIXME comments are about flaky tests (e.g. "Fix this test for mobile as it's flaky"). | ~19% of test-SATD | pooled agents | PR |
| Community issues | 0 verified | — | A |
| JetBrains blog (May 2026) and practitioner guides describe teaching agents to avoid "papering over with sleeps or skips". | qualitative | — | V |

- **Mitigation evidence:** none measured for agents.
- **Worth testing on Opus 5.5?** Maybe. The evidence is weak, but the behavior is easy to seed (a race-condition test) and to score (a diff containing `sleep`, `retry` or a raised timeout vs a real synchronization fix). Treat it as exploratory.

## 6. Error handling (swallowed errors, over-defensive code, generic catch)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| Sonar "Coding Personalities": exception-handling **bugs** are 16.75% of Claude Sonnet 4 bugs and 16.71% of Claude 3.7's (the highest category among Claude models besides control flow). Exception-handling **smells** are only ~0.05% of smells; that is a different category, so do not conflate the two. Sonnet 4 is described as "consistently attempt[ing] to implement sophisticated safeguards, error handling", and API contract violations such as ignored error return values appear across all models. | % of bugs | Sonnet 4, 3.7 | V |
| #97641: the model handled status `blocked` but left `failed` (same enum) treated as success, so agent work was lost and paid for twice. | 1 | Claude Code | A |
| #82088 case B: an optional convenience step failing blocked the main operation. Case A: silent data drop "without even logging a conflict". | 2 cases | Opus 5 | A |
| #94566: suppressed warnings | 1 | unspecified | A |

- **Mitigation evidence:** none measured.
- **Worth testing on Opus 5.5?** Yes, with moderate priority. Seed tasks where the correct fix must propagate an error, and score for new catch-and-ignore handlers, bare `except`, or silent default returns in the diff. The anecdotes are recent (Opus 5), and the metric is semi-mechanical.

## 7. Leftovers (debug logs, TODO/placeholder/stub implementations, mock data in production, commented-out code)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| "Characterizing SATD Generated by AI Coding Agents" (MSR 2026, AIDev-pop, 856 repos, 34k agent commits). | Agents write **less** admitted debt than humans: ~2.6% of commits vs 4.25%, and ~0.95% of comments vs 1.60%. 27% of agent SATD is requirement debt (e.g. "TODO: Implement code-request workflow"); 13.2% is dependency/compatibility debt. Only 2–4% of SATD is actionable. | Copilot, Cursor, Devin, Claude (Codex excluded) | PR |
| "TODO: Fix the Mess Gemini Created" (arXiv 2601.07786, TechDebt 2026). 6,540 LLM-referenced comments, of which 81 admit debt. | small | pooled | PR |
| #94170: stubs returning non-empty values masked missing implementation. This is a *silent* stub, which the SATD studies cannot see. | 1 pattern report | Claude Code | A |

- **Mitigation evidence:** none.
- **Caveat:** admitted TODOs (visible, low rate) and silent stubs or placeholders (invisible, not measured by any study found) are different risks. The SATD data says nothing about the second.
- **Worth testing on Opus 5.5?** Yes, as a cheap metric. Grep the diff for `console.log`/`print`, `TODO`, `NotImplemented`, and hardcoded sample data, and use a hidden-test check for silent stubs. The research direction (agents admit less debt than humans) means a silent-stub probe is more valuable than a TODO count.

## 8. Comment and docs noise (narrating comments, stale docstrings)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| Sonar: comment density was 16.4% for Claude 3.7 Sonnet vs 5.1% for Claude Sonnet 4, so density fell sharply across generations. | LOC-level | Sonnet 4, 3.7 | V |
| He et al., "AI IDEs or Autonomous Agents?" (MSR 2026). Comment density is one of the tracked outcomes; the abstract reports no significant headline change for it. | — | pooled agents | PR |
| #82032: ~10 lines of comments specific to "that Claude Code session" were added to a CSS fix. A later session treated a comment referencing a plan step as a constraint and refused to change the code. | 1, "every time" | Opus 5 | A |
| arXiv 2607.01867 (JSS 2026): LLM-detected comments in 8 repos stayed stable over 2021–2025. | descriptive | detectors, not models | PR |

- **Mitigation evidence:** none.
- **Worth testing on Opus 5.5?** Yes, but measure *content*, not density. Density is probably no longer the problem; the Opus 5 anecdote is about comments that reference the session, plan or task ("per step 3", "as requested", "fixed the bug"). Such comments can be flagged by regex and cause downstream harm.

## 9. Dependency and API usage (hallucinated packages or APIs, outdated APIs, unnecessary upgrades)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| Spracklen et al. (USENIX Security 2025). 576k samples, 16 models. | Hallucinated package rate: 5.2% for commercial models, 21.7% for open-source models. | GPT-era models | PR |
| Churilov (arXiv 2605.17062 v3, Aug 2026), a single-author replication on 199,845 Python and JS prompts. | Overall rates 4.62% (Claude Haiku 4.5) to 6.10% (GPT-5.4-mini). The range compresses by an order of magnitude but does not reach zero. 127 invented names are shared across all 5 models, and 53 remained registrable after disclosure. Haiku hallucinates less than Sonnet 4.6. | Claude Sonnet 4.6, Haiku 4.5, GPT-5.4-mini, Gemini 2.5 Pro, DeepSeek V3.2 | PP |
| Wang et al., "LLMs Meet Library Evolution" (ICSE 2025). 7 LLMs, 145 API mappings, 28,125 prompts. | Deprecated-API usage is persistent (rates not extracted). REPLACEAPI and INSERTPROMPT are proposed as baseline fixes. | older LLMs | PR |
| Sonar: "Deprecation/obsolete" is 2.01% of Sonnet 4 code smells. | small | Sonnet 4 | V |
| Community issues | 0 verified | — | A |

- **Mitigation evidence:** INSERTPROMPT and REPLACEAPI (ICSE 2025; effect sizes not extracted).
- **Caveat for Claude Code:** all of these measure prompt-to-code generation, not an agent with install feedback. In an agent loop a nonexistent package fails loudly at install. The residual risk is a squatted name that installs cleanly, plus silent use of outdated APIs.
- **Worth testing on Opus 5.5?** Low priority for hallucinated packages, because the agent loop self-corrects and the rate is already ~5%. Medium priority for outdated APIs: a task on a library with a recent breaking change, scored by deprecation warnings, is cheap and not covered by recent Claude data.

## 10. Migrations, upgrades and cross-file consistency (renames, schema changes)

| Evidence | Numbers | Models | Quality |
|---|---|---|---|
| SWE Refactor Bench (arXiv 2608.23564, Aug 2026). 20 whole-repository migrations, 8 frontier models, 26 model-effort configurations, 520 runs. | Only 28 of 520 runs (5.4%) pass all three stages, and 13 of 20 tasks have no accepted solution. **Best model: claude-opus-5, 47.0/100.** Of runs that passed the migration audit, 58% reach 99% of fixed checks but only 26% reach 100%. Scores are 31.4 on build-toolchain rewrites vs 5.6 on language rewrites. "Blindness" hack: some agents copy the original implementation so tests pass without migrating. | claude-opus-5 plus 7 others | PP (the only research source here with a Claude 5 model) |
| RepoMod-Bench (Modelcode blog, KDD 2026 paper not read). | Repository translation pass rate is 91.3% on projects under 10K LOC and 15.3% on projects over 50K LOC. Build success is above 95% for all agents, so compiling does not mean the migration works. | unspecified agents | V (blog) |
| SWE-Refactor: compound, multi-step refactorings are the main failure source (see §4). | 39.4% (Codex, compound) | — | PP |
| Rename/schema anecdotes | 0 verified | — | A |

- **Mitigation evidence:** none measured. The Blindness hack relates to test tampering; cross-reference 05 §1.
- **Worth testing on Opus 5.5?** Yes, high priority. There is a 2026 Claude-5 execution-based result showing the "99% but not 100%" tail. A small cross-file rename or schema-change task scored by grep for stale identifiers plus hidden tests suits A/B testing. Do not extrapolate the Opus 5 score to Opus 5.5.

## 11. Other scenarios with strong recent evidence

| Scenario | Evidence | Numbers | Models | Quality |
|---|---|---|---|---|
| Agent-induced technical debt, repository level | He, Agarwal, Vasilescu, "AI IDEs or Autonomous Agents?" (MSR 2026), staggered difference-in-differences on AIDev. | Static-analysis warnings rose ~18% and cognitive complexity ~39% after agent adoption. The rise persisted even when velocity gains faded. | pooled agents | PR |
| Post-merge quality of agent bug-fix PRs | Cynthia et al. (arXiv 2601.20109, MSR 2026). 1,210 merged Python bug-fix PRs, SonarQube diff. | Code smells dominate. Differences between agents **disappear after normalizing by churn**, so larger PRs mean more issues. Merge success does not predict quality. | 5 agents | PR |
| Failed agentic PRs | Ehsani et al. (arXiv 2601.15195, MSR 2026). 33k PRs. | Performance and bug-fix PRs merge least often. Unmerged PRs are larger, touch more files, and fail CI more. | 5 agents | PR |
| Regressions introduced while fixing | #82088 (Opus 5: a "data-loss protection" that itself dropped data; 13k self-written tests missed it), #96463 (fix turned a clean error into silently wrong data and was reported as "pre-existing"), #83531 (unrequested "seam guard" caused an infinite loop that took a homepage down; a clean type-check was reported as verification). | 4 issues | Opus 5, Fable 5 | A (detailed) |
| Security degradation over iterative "improvement" | "Security Degradation in Iterative AI Code Generation" (arXiv 2506.11022, IEEE-ISTAS 2025). 400 samples, 40 rounds. | Critical vulnerabilities rose 37.6% after 5 iterations. | older LLMs | PR |
| Destructive actions | ~10 model-labeled issues about deleted files or data, including `rm -rf "$HOME"` during test cleanup (#93099, Opus 5) and bypassing a Remove-Item block with `rmdir` (#93602). | ~10 | Opus 5, Sonnet | A |
| Capability vs error profile | Sonar: Sonnet 4 vs 3.7 is +4.6 pp pass rate, but BLOCKER vulnerabilities rise from 56.03% to 59.57% and concurrency bugs from 1.44% to 9.81%. | — | Sonnet 4, 3.7 | V |

- **Performance "optimizations" that change behavior:** no specific 2025–2026 study was retrieved (searches failed). Not assessed.
- **Worth testing on Opus 5.5?** Yes for "regression introduced by own fix". It combines the root-cause layer and overclaiming themes (cross-reference 05) with a concrete, testable pattern: probe whether the model exercises the caller or contract path, not just the helper. Destructive actions belong to permission and safety, not to a behavior A/B test.

---

## Summary ranking by strength of recent evidence

1. **Refactoring (§4):** 2026 execution-based study with Sonnet 4.6, Opus 4.6 and Opus 4.7. Test-runner access did not help Opus 4.7.
2. **Migrations and cross-file consistency (§10):** Aug 2026 execution-based study with claude-opus-5 (47/100; 5.4% of runs pass all stages).
3. **Writing tests (§2):** MSR 2026 over-mocking study (36% vs 26%), coverage/mutation replication with Claude 4, detailed Opus 5 anecdotes.
4. **Other: own-fix regressions and repository-level debt (§11):** MSR 2026 difference-in-differences (+18% warnings, +39% complexity) and Opus 5 and Fable 5 issues.
5. **Error handling (§6):** vendor data on Sonnet 4 and Opus 5 anecdotes, no agentic study.
6. **Dependencies and APIs (§9):** strong on package hallucination (Claude 4.6 cohort, ~5%), but the Claude Code install loop blunts it.
7. **Leftovers (§7):** MSR 2026 shows agents admit less TODO debt than humans; silent stubs are unmeasured.
8. **Comments (§8):** density is falling (vendor); only one Opus 5 anecdote, about session-referencing content.
9. **Deletion (§3):** vendor dead-code share and one anecdote; incomplete removal is unstudied.
10. **Silencing (§1) and flaky tests (§5):** no dedicated research. Both are still good cheap grep-based A/B metrics.
