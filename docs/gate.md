# The rule gate

How themis judges each new rule written to `CLAUDE.md` or `AGENTS.md`: the checks, the modes, the command line and the limits. The [README](../README.md) has the summary.

The skill used to decide by judgment what belongs in a rule file, so the same rule could be accepted one day and cut the next. The gate decides with fixed checks instead: no model, the same answer every time. It reads the repository's `package.json`, lint and TypeScript configuration, CI and hook files, README and docs, and judges each new rule against them.

A rule is a list item with its continuation lines, a paragraph, a numbered list or a code block with the paragraph that introduces it. Six questions are asked:

| Question | Verdict |
|---|---|
| Does the repo already show it? A project title, a folder tree, "use X" for a dependency that is the only one of its kind, with `gate_paths` on, an existing path whose short description uses only words of the path and of the file (or the file names under the folder), a list of two or more of the manifest's dependencies with nothing but names and versions, a script described only by its own name and command, a summary made of the manifest's description and the README. A stack list whose version differs from `package.json` is a `conflict`. | `cut` or `conflict` |
| Does a tool already enforce it? A lint or compiler setting that is configured, run by a script, a pre-commit hook or CI, with the same value; or a `permissions.deny` rule that covers the command. If the setting says the opposite, `conflict`. | `cut` or `conflict` |
| Is it generic or filler? "Write clean code", "this file provides guidance", the heading and sentence `/init` writes (`# CLAUDE.md`, "This file provides guidance to Claude Code … when working with code in this repository"), or a phrase a vendor guide for a current model asks to remove. English and Spanish. | `cut` |
| Is it an absolute ban on a command or path? "Never run `x`" is better as a hook or a `permissions.deny` rule. | `move` |
| Is it a long procedure, or a passage copied from the README or `docs/`? | `move`, to a doc or a skill with a pointer |
| Is it shouted? Capitalised emphasis such as IMPORTANT or NEVER. | `rewrite` |

The reason codes of question 1 are `inferable-title`, `inferable-tree`, `inferable-tech`, `inferable-script`, `inferable-overview`, `inferable-stack`, `inferable-path` (only with `gate_paths` on) and, for a stack list with a version that disagrees with the manifest, `conflict` · `stale-version`.

Everything else is `keep`. A `keep` can carry a note (no evidence found, no anchor in the repo, an absolute without a reason, or `unresolved-reference`); a note informs and never interrupts. `unresolved-reference` means the rule names a path or a `run` script that the repository does not have, and says which; the skill checks it and repairs the reference if it moved. Earlier builds of the gate gave such a rule the verdict `fix` · `dead-reference`; on two held-out corpora most of those rules were labelled keep, so it no longer interrupts. Rules accepted under the old verdict still load. A rule is kept when in doubt: a negation, a condition, a number or a word the tables do not know all count as information.

The path, stack, script and summary checks use the repository as their dictionary: a described path may only use words of its own path, of the first 32 KB of the file it names (or of the file names under a folder), and a closed list of neutral words and role nouns such as helpers or handlers; a script, words of its name and command; a summary, words of the manifest's description and the README's first paragraphs, every one of them. A "**dependency**: description" line is not judged, since nothing in the repository checks the description. On top of that each abstains on a closed list: a status word such as generated, legacy or internal; an effect verb such as applied, loaded, required, shared or used by; a pronoun, a quantifier, a second sentence or clause, a code span, and for scripts any word of deployment or data loss. In a repository with more than one `package.json` a described script is kept, since a sub-package may own it. Described paths are judged only with the `gate_paths` option (or `--paths`), because a description built from words of the file is not proof the file says it; a set of rules citing more than 40 distinct paths is not judged for paths at all. A stack list is kept when it names two tools of one kind or adds any word to a name ("Jest for unit tests, Vitest for integration").

Negative rules ("don't use X") are never cut by question 1, and "use pnpm, not npm" is kept even with a `pnpm-lock.yaml`, because naming a tool that is not the default changes what the model does.

## Modes

The `gate` option sets what happens when a rule written to `CLAUDE.md` or `AGENTS.md` gets a verdict other than `keep`.

| `gate` | What happens |
|---|---|
| `report` (default) | The edit goes through. Claude is shown the verdicts and told to tell you which rules were flagged and why. It may apply a `rewrite` itself, but removes or moves a rule only after telling you. |
| `ask` | The edit stops and you are asked. The prompt lists each rule with its verdict, reason and evidence; approving writes the rule as given. |
| `off` | The gate does nothing. |

The default is `report` because the gate has not earned the right to interrupt you: see [RESULTS.md](../RESULTS.md) for its measured precision.

The gate never denies an edit. In sessions where nobody can answer a prompt (permission mode `dontAsk` or `bypassPermissions`, subagents), `ask` falls back to `report`. A headless `claude -p` session cannot be recognized from the hook input, so there `ask` is denied by Claude Code and Claude reads the reason.

## Accepted rules

When you approve a rule that the gate had flagged, themis records it in `.claude/themis-accepted.json`, which belongs in version control: the hash of the normalized text, the original verdict and the date. From then on that rule is `keep` with an `accepted` note, in the hook and in `audit`. If its text changes, the hash changes and it is judged again. `gate audit --prune` removes entries that no longer match any rule. Nothing is recorded in `report` mode, because nobody approved anything, nor outside a git repository, where there is no project to record it in.

## Command line

The skill calls these; you can too.

```
node hooks/dist/gate.js check  [--rules <file>] [--file CLAUDE.md] [--json] [--paths]   # Markdown from --rules (read as UTF-8) or stdin; --file says which repository
node hooks/dist/gate.js audit  <file> [--json] [--prune] [--paths]     # a verdict for every rule, the coverage, the rules not judged and the token estimate
node hooks/dist/gate.js report <corpus.jsonl> [--json] [--paths]       # precision, false-cut rate and coverage of a labelled corpus
```

Prefer `--rules` to a pipe: Windows PowerShell 5.1 re-encodes piped text, so accented letters arrive changed and can change a verdict. `--paths` turns on the described-path check, as `gate_paths` does for the hook. `check` ends with the tokens the target file holds now and the size of the text checked. Under its table `audit` prints a `Not judged:` line when rules matched nothing, since a rule kept for lack of a check is not a rule approved, and says so when the repository has no `package.json`. The exit code is 0 for any valid input and 2 for wrong usage or an unreadable file.

## Limits

- **Node, JavaScript and TypeScript repositories only.** The checks read `package.json`; elsewhere they find no evidence and keep the rule.
- **English and Spanish.** The phrase tables cover those two languages.
- **Monorepos.** A script or path that lives in a sub-package can look missing from the root. The gate does not report a missing script when the repository has more than one `package.json`, and counts a path as present when a tracked path ends with it, so in a monorepo a reference that really is dead can go without a note.
- **Node versions.** The compiled hooks run on Node.js 18. Contributors need Node.js 22.18 or later to run the tests, which execute the TypeScript sources.
- **It finds about one redundant rule in five.** Measured blind on a second corpus of 1,223 rules from 40 public repositories, with the detectors frozen first: 99 interruptions, of which 73.7% deserved one; 3.1% of the rules labelled keep were interrupted; 19.5% of the rules labelled anything other than keep were flagged. The new detectors had been estimated to reach about 50%. After that run one change was made, so the next figures are not blind and the gate as shipped has no blind measurement: unresolved references became a note (a rule with one is still checked for emphasis), and the gate now interrupts 81 rules, 84.0% of them deserving it, with 1.5% of keeps interrupted and 18.2% recall. Nine of the 13 wrong interruptions left are bare titles that these labellers kept and the first corpus's labellers cut. Its verdicts are a floor for what can go, not a full audit.
- **Described paths are off by default.** The largest family of redundant rules, a path with a short description, could not be made safe by script: a description built from words that are in the file is not proof the file says it. `gate_paths` turns the check on. It fired 4 times on the second corpus, all correctly, which is too few to measure.
- **The first corpus is development data.** The first blind run (1,502 rules) gave 62.0% precision, 6.3% false cuts and 16% recall. The detectors were then built on that corpus, so its current numbers are an upper bound. The labels of neither corpus are reviewed yet, so all these numbers are provisional. See [RESULTS.md](../RESULTS.md).
- **The held-out snapshots are not in the repository.** The rules, labels, commits and licences are stored here; `tests/gate/holdout/collect.mjs` and `fetch-cited.mjs` rebuild the third-party snapshots from GitHub.
