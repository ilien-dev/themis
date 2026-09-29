# themis

A small Claude Code plugin for Claude Opus 5.5. Everything in it was kept only because it changed measured behavior in A/B sessions; everything that did not was removed. See [RESULTS.md](RESULTS.md) for the numbers and [research/](research/) for the sources behind each hypothesis.

## What it does

**One resident rule** (~80 tokens, injected at session start and again after `/clear` or compaction):

> Working convention in this environment (themis): when the user describes a problem or asks a question without asking for a change, the deliverable is an assessment; fixes wait until they are asked for. When changing code, reuse existing helpers in the repo, and list other defects you notice at the end instead of fixing them.

Its second sentence is not decoration. Without it, the first sentence measurably reduced helper reuse (21/27 vs 27/27); with only a reuse clause, it reduced reporting of adjacent bugs (3/9 vs 9/9). This wording held 27/27 across all three.

**A CLAUDE.md size cap.** Edits or writes that would push `CLAUDE.md` or `CLAUDE.local.md` (plus its `@imports`) past ~2,500 tokens are rejected with instructions to condense instead. Shell writes to those files are rejected so the cap can't be bypassed. 2,500 is the size Boris Cherny reports for his own CLAUDE.md; the official guidance is "under 200 lines". Configure with `claude_md_cap` (0 disables).

**Six on-demand skills.** They are user-invoked only, so they cost no context until you run them:

| Command | Use it to |
|---|---|
| `/themis:ariadne <request>` | Start work: size it (trivial / normal / large / foggy); for large work ask up to 4 pivot questions with recommendations, then write `.themis/spec.md` and vertical-slice tickets |
| `/themis:daedalus <ticket>` | Implement one ticket: branch, test-first where there is logic, real checks, tick acceptance criteria with evidence, one commit, no push |
| `/themis:apollo <symptom>` | Debug: failing reproduction first, ranked hypotheses, fix at the causal layer, regression test |
| `/themis:argus [request]` | One-pass review of the working changes against the request in a fresh read-only context: missing, unasked, overbuilt |
| `/themis:hermes [commit\|pr]` | Commit message or PR body with evidence and merge risk; asks before pushing |
| `/themis:hestia [init\|audit]` | Create or prune `CLAUDE.md` so it holds only what the model can't infer, under the cap |

Bugs and simplification stay with the built-in `/code-review` and `/simplify`.

## Install

```
/plugin marketplace add C:/Users/jesus/Documents/Projects/themis
/plugin install themis@themis
```

Or for one session: `claude --plugin-dir C:/Users/jesus/Documents/Projects/themis`. Requires `node` on PATH.

## Tests

```
node --test tests/hooks.test.mjs          # hook unit tests
claude plugin validate . --strict          # manifest and components
node evals/run.mjs --case "c0*" --arms base,themis --runs 3 --tag mytag   # A/B sessions (billed)
node evals/report.mjs base=mytag themis=mytag
```

`evals/run.mjs` copies each case fixture into a temp git repo and runs `claude -p` on `claude-opus-5-5` at `medium` effort, with user settings, hooks and plugins excluded in every arm. `--core <file>` swaps the resident rule for ablations.
