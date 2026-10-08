# Results

What was measured about the parts that themis 2.0.0 keeps. The numbers come from the 1.x evaluation rounds: headless sessions on `claude-opus-5-5` at `medium` effort, each in a fresh temp git repo, with user settings, hooks and plugins excluded in every arm (`--setting-sources project,local`).

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
- **Parity has no session-level measurement.** Copying an edit to the other file, refusing an edit while the two differ and the session-start report are covered by the hook tests in `tests/hooks.test.mjs`, which are deterministic. How reliably a model asks the user instead of choosing a version was not measured.
- n is 3 per cell, so small effects are invisible.
- The fixtures are small Node repos.
- Graders are deterministic regexes and file checks. In the themis arm they now also require `AGENTS.md` to be an exact copy of `CLAUDE.md`; that check has not been run in a session.
- The token estimate for the cap is characters ÷ 3.6. It is not calibrated against the real tokenizer.

## Re-running

```
node evals/run.mjs --case "c1*,c20*" --arms base,themis --runs 3 --tag mytag   # billed sessions
node evals/report.mjs base=mytag themis=mytag
```

Each case's fixture, prompt and grader are in `evals/cases/`. The cases and results for the parts removed in 2.0.0 are in the git history before that release.
