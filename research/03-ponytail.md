# 03: Ponytail deep-dive (DietrichGebert/ponytail)

Research notes to inform the design of a new Claude Code plugin tuned for Claude Opus 5.5. Nothing here is built.

- **Source:** shallow clone of `main` @ `e3ba2aa` (v4.10.0, released 2026-09-14). The repo has about 148k stars and about 8k forks.
- **Issues and PRs:** 328 issues and 610 PRs, read via `gh` on 2026-09-29.
- **Evidence labels:** **[code]** means I verified it by reading or running the code. **[reported]** means it comes from an issue or PR and I did not reproduce it.

---

## 0. Corrections to the brief's premises (read first)

1. **"Hooks inject the ruleset every turn" is wrong for Claude Code.** [code] What actually happens:
   - **SessionStart** (matcher `startup|resume|clear|compact`) writes the mode-filtered ruleset **once**, as raw stdout.
   - **SubagentStart** injects the ruleset into **every spawned subagent**, as `hookSpecificOutput.additionalContext` JSON.
   - **UserPromptSubmit** emits text **only** when the prompt is a `/ponytail…` command or exactly "stop ponytail" / "normal mode". Ordinary prompts inject nothing.
   - Full per-turn injection exists **only on Qoder** [code] (no SessionStart event there), and on OpenCode/pi via their own plugin shims [reported, #736].
   - The maintainer himself says "re-injects its full ruleset every turn" (#121) and helpers repeat it (#111, #120). The code contradicts this.
   - The real cost is **resident size × API calls per turn × turns**. Issue #685 measured this (see §5).
2. **Payload size, measured.** [code] I ran `node -e` against `hooks/ponytail-instructions.js`:

   | Payload | Chars | Approx. tokens |
   |---|--:|--:|
   | `getPonytailInstructions('lite')` | 5,202 | ~1.3k |
   | `getPonytailInstructions('full')` | 5,229 | ~1.3k |
   | `getPonytailInstructions('ultra')` | 5,267 | ~1.3k |
   | `getFallbackInstructions('full')`, the condensed copy that only ships as an error fallback | 2,680 | ~670 |

   - The 5,229-character `full` body is what gets injected. #597 and #767 also report about 1.3k tokens for it.
   - **The figure that matters for cost is #685's API-measured delta, plugin on vs off:** +2,752, +2,942 and +2,465 tokens of first-turn cache write on Sonnet 5.
   - The gap between that and 1.3k is unexplained. It plausibly includes the ~340 tokens of resident skill descriptions (#219) and the one-time statusline nudge of about 100 tokens.
3. **Mode does not survive compaction, and the flag is machine-global.** [code]
   - `ponytail-activate.js` calls `getDefaultMode()` on *every* SessionStart (startup, resume, clear, compact) and then runs `setMode` or `clearMode`. It never reads the existing flag.
   - So a mid-session `/ponytail ultra` or `/ponytail off` is undone at the next compaction or `/clear`. #113 is closed, but HEAD still behaves this way; PR #893 ("per-session mode that survives compaction") was closed unmerged.
4. **"−54% LOC" is weaker than the headline suggests.** [reported, #900; the arithmetic checks out against the per-task table]
   - −54% is the cut in **total** lines (a ratio of sums). The **mean of the 12 per-task cuts is −35.4%**.
   - The summary rows for caveman and yagni do not reproduce from the per-task table.
   - The "yagni-oneliner" arm **also** cuts every metric, and cuts cost and time slightly more (−21% / −30% vs −20% / −27%).
   - The run was **Haiku 4.5 only, n=4**.
   - **No agentic benchmark exists on Opus or on any 5.x model.** PR #844 (Opus 5 / Fable 5.1) is single-shot, has 55 of 60 cells returned, and is still open.

---

## 1. Skills (`skills/*/SKILL.md`)

Six skills. None of them declares tools or a model. Claude Code auto-discovers them from `skills/`; `plugin.json` has no `skills` field.

| Skill | Size | Kind | Purpose |
|---|--:|---|---|
| `ponytail` | 6.8 KB | Persistent mode, with `argument-hint: "[lite\|full\|ultra]"` | The ruleset itself. Also the source text the hooks inject. |
| `ponytail-review` | 2.4 KB | One-shot | Review a diff for over-engineering only. |
| `ponytail-audit` | 1.7 KB | One-shot | The same review, repo-wide, ranked. |
| `ponytail-debt` | 1.7 KB | One-shot | Collect `ponytail:` comments into a ledger. |
| `ponytail-gain` | 2.0 KB | One-shot | Print an ASCII scoreboard of benchmark figures. |
| `ponytail-help` | 2.9 KB | One-shot | Reference card. |

### 1.1 `ponytail` (the core)

**Frontmatter description.** It triggers on "ANY coding task: writing, adding, refactoring, fixing, reviewing, or designing code, and choosing libraries", plus trigger words ("be lazy", "yagni", "simplest solution", …). It ends with *"Do NOT use for non-coding requests (general knowledge, prose, translation, summaries, recipes)."* That exclusion is stripped before hook injection (see §2.3).

**Persona.** "You are a lazy senior developer. Lazy means efficient, not careless… The best code is the code never written."

**Persistence (verbatim).** "ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if unsure. Off only: "stop ponytail" / "normal mode"."

**The ladder (verbatim).** "Stop at the first rung that holds":
1. **Does this need to exist at all?** Speculative need = skip it, say so in one line. (YAGNI)
2. **Already in this codebase?** … reuse it. Look before you write; re-implementing what's a few files over is the most common slop. *(Added for #217.)*
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** `<input type="date">` over a picker lib, CSS over JS, DB constraint over app code.
5. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines can do.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

**Guards against misreading the ladder (verbatim).**
- "The ladder is a reflex, not a research project — but it runs *after* you understand the problem, not instead of it… Two rungs work → take the higher one and move on. The first lazy solution that works is the right one."
- "**Bug fix = root cause, not symptom.** … grep every caller of the function you're about to touch. The lazy fix IS the root-cause fix: one guard in the shared function is a smaller diff than a guard in every caller." *(This is the operational fix for #245. It is the rule with the best measured effect; see §4.4.)*

**Rules (verbatim, abridged).**
- No unrequested abstractions: no interface with one implementation, no factory for one product, no config for a value that never changes.
- No boilerplate, no scaffolding "for later".
- Deletion over addition. Boring over clever.
- Fewest files possible. Shortest working diff wins, "but only once you understand the problem."
- "Complex request? Ship the lazy version and question it in the same response… Never stall on an answer you can default."
- "Two stdlib options, same size? Take the one that's correct on edge cases."
- Mark deliberate corner-cuts with `# ponytail: <ceiling>, <upgrade path>`.

**Output rules.**
- "Code first. Then at most three short lines: what was skipped, when to add it. No essays… If the explanation is longer than the code, delete the explanation."
- Carve-out: "Explanation the user explicitly asked for… is not debt."
- Pattern: `[code] → skipped: [X], add when [Y].`

**When NOT to be lazy (the safety rail).**
- "Never simplify away: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, anything explicitly requested. User insists on the full version → build it, no re-arguing."
- "Never lazy about understanding the problem… Trace the whole thing first — every file the change touches… Read fully, then be lazy."
- There is a hardware calibration clause.
- "Lazy code without its check is unfinished. Non-trivial logic… leaves ONE runnable check behind… an `assert`-based `demo()`/`__main__` self-check or one small `test_*.py`. No frameworks… Trivial one-liners need no test."

**Boundaries.** "Ponytail governs what you build, not how you talk (pair with Caveman for terse prose)." This line contradicts the Output section (#332).

### 1.2 lite / full / ultra: the differences are cosmetic

[code; also #664] `filterSkillBodyForMode()` keeps everything except two kinds of line:
- Intensity-table rows whose bold label is a mode name.
- Worked-example bullets of the form `- lite: "..."`.

So the three levels differ by **three lines**: the banner, one table row and one example. Every rule is byte-identical.

| Level | The only line that differs | Example |
|---|---|---|
| lite | "Build what's asked, but name the lazier alternative in one line. User picks." | "Done, cache added. FYI: `functools.lru_cache` covers this in one line…" |
| full | "The ladder enforced. Stdlib and native first. Shortest diff, shortest explanation. Default." | "`@lru_cache(maxsize=1000)`… Skipped custom cache class, add when…" |
| ultra | "YAGNI extremist. Deletion before addition. Ship the one-liner and challenge the rest of the requirement in the same breath." | "No cache until a profiler says so…" |

- PR #668 (open) would add real mode-gated blocks, using `<!-- mode: x -->` markers.
- An independent Opus 4.8 run found robustness got **worse** at higher levels (see §4.3).

### 1.3 `ponytail-review` and `ponytail-audit`

**Output format.** One line per finding: `L<line>: <tag> <what>. <replacement>.`

**Tags:**
- `delete:` dead code or speculative feature; replacement is "nothing".
- `stdlib:` name the function.
- `native:` name the platform feature.
- `yagni:` one implementation, config nobody sets, or a layer with one caller.
- `shrink:` show the shorter form.

**Endings.** Each report ends with `net: -<N> lines possible.` (audit adds `-<M> deps`) or `Lean already. Ship.`

**Scope.** Explicitly excludes correctness, security and performance: "Route them to a normal review pass". A single smoke test or `assert` self-check is "the ponytail minimum, not bloat, never flag it."

**Examples.** Contrasting ❌ and ✅ examples, for instance ✅ `L4: native: moment.js imported for one format call. Intl.DateTimeFormat, 0 deps.`

**Audit hunt list.** Deps the stdlib or platform already ships, single-implementation interfaces, factories with one product, pure-delegation wrappers, single-export files, dead flags and config.

**Known gaps:**
- #679 (reported): no whole-tree caller check before `delete:`. It wrongly called a function uncalled when about 35 test assertions used it. 8 of 31 findings were invalid, partly because the audit was stale; nothing records the base commit.
- #866: "Replacement: nothing" hides obligations: comments pointing at the deleted region, and tests pinned to a dead variant.
- #682: no pass for over-defensive control flow or blanket try/except.
- #868: no `reuse` tag for in-repo duplication.

### 1.4 `ponytail-debt`, `ponytail-gain`, `ponytail-help`

- **debt:** runs `grep -rnE '(#|//) ?ponytail:' .`. Output rows are `<file>:<line>, <what>. ceiling: … upgrade: …`. Rows with no trigger get a `no-trigger` tag. It is read-only and writes `PONYTAIL-DEBT.md` only on request. It misses `/* */` comments (#810).
- **gain:** a hard-coded ASCII scoreboard of benchmark figures, with a good **honesty boundary**: "NEVER print a per-repo savings number… the unbuilt version was never written."
  - The figures are stale: it still shows the retracted single-shot 80–94% and 47–77% numbers (#900, #804).
- **help:** a reference card. It documents config resolution as env `PONYTAIL_DEFAULT_MODE` > `~/.config/ponytail/config.json` (`%APPDATA%\ponytail\config.json` on Windows) > `full`.
  - `/ponytail default <mode>` (which persists) appears nowhere in help (#648).

---

## 2. Hooks and scripts

### 2.1 Files

| File | Role |
|---|---|
| `hooks/claude-codex-hooks.json` | Hook registration for Claude Code and Codex (verbatim in §3). |
| `hooks/ponytail-activate.js` | **SessionStart**. |
| `hooks/ponytail-subagent.js` | **SubagentStart**. |
| `hooks/ponytail-mode-tracker.js` | **UserPromptSubmit**. |
| `hooks/ponytail-instructions.js` | Builds the injected text: reads `skills/ponytail/SKILL.md`, strips frontmatter, filters by mode, prefixes `PONYTAIL MODE ACTIVE — level: <mode>`. Falls back to a hard-coded condensed string (~670 tokens) only if the file read throws. |
| `hooks/ponytail-runtime.js` | Host detection from env vars (`COPILOT_PLUGIN_DATA`, `PLUGIN_DATA` for Codex, `QODER_SESSION_ID`, `CURSOR_VERSION`). State path. Per-host output shaping in `writeHookOutput`. |
| `hooks/ponytail-config.js` | Mode resolution, `isDeactivationCommand` (whole message must equal "stop ponytail" or "normal mode", fixing #161), and `isShellSafe` (path allowlist). |
| `hooks/ponytail-statusline.sh` / `.ps1` | Statusline badge. |
| `hooks/{copilot,cursor,qoder}-hooks.json` | Other hosts' registrations. |
| `scripts/uninstall.js` | Removes the flag file, config and the statusLine entry. [reported, #374, #502] It deleted a combined statusLine on a substring match; I read only the first 40 lines, so I have not verified whether this is fixed. |
| `scripts/check-rule-copies.js` | CI drift guard: 7 compact rule copies must equal `AGENTS.md`. `SKILL.md` gets only "canary" substring checks. |
| `scripts/build-openclaw-skills.js` | Regenerates `.openclaw/skills` with descriptions under 160 characters. |
| `scripts/cursor-hooks.js` | Merge-installs Cursor hooks. |

### 2.2 Per event (Claude Code path) [code]

**SessionStart → `ponytail-activate.js`** (startup, resume, clear and compact; timeout 5s; `statusMessage: "Loading ponytail mode..."`).
1. `getDefaultMode()`. If the mode is `off`, it runs `clearMode()` (deletes the flag), prints `OK` and exits.
2. `setMode(mode)` writes the flag file `$CLAUDE_CONFIG_DIR/.ponytail-active` (default `~/.claude/.ponytail-active`). The file contents are just the mode string.
3. It outputs `getPonytailInstructions(mode)` as **plain stdout**, which Claude Code adds as context.
4. On first run, if `settings.json` has no `statusLine`, it appends a nudge once and touches `~/.claude/.ponytail-statusline-nudged`. The nudge text:
   > "STATUSLINE SETUP NEEDED: The ponytail plugin includes a statusline badge… To enable, add this to <settings>: "statusLine": {…} Proactively offer to set this up for the user on first interaction."

   This is an instruction to the model to push a settings change. Treat that pattern as questionable.
5. Because the matcher includes `compact`, **the default mode's** ruleset is re-injected after compaction. **The user's chosen mode is not:** step 1 resets the flag to `getDefaultMode()`, so a mid-session switch (for example to `ultra` or `off`) is lost at compaction, `/clear` or resume. #685 found that `--resume` did not re-inject in practice.

**UserPromptSubmit → `ponytail-mode-tracker.js`**
- It parses the stdin JSON `prompt`. If it matches `^[/@$]ponytail`:
  - `/ponytail lite|full|ultra|off` sets or clears the flag and emits `PONYTAIL MODE CHANGED — level: X` (or `PONYTAIL MODE OFF`).
  - Bare `/ponytail` reports the level only.
  - `/ponytail default <m>` writes the config file.
  - `/ponytail-review` writes `review` to the flag.
- On Claude Code **the ruleset itself is not re-sent** on a mode switch. The `isQoder` branch is the only one that re-sends it. [code, confirms #663] So switching from `off` to `full` mid-session confirms the switch but delivers **no rules** to the main thread. The next SessionStart (`/clear` or compact) re-injects the *default* mode, which matches the chosen level only when the two coincide.
- Every message goes to **the model, not the user**, because stdout on UserPromptSubmit becomes context (#648).
- Windows safeguard: a 1s `setTimeout(...).unref()` fallback, because the PowerShell wrapper can swallow stdin and the hook would hang forever (#443).
  - Still reported: 6–39s hangs (#763, #790, #647) and console-window flashes (#791).
- [reported, #584] When invoked through the skill menu, `data.prompt` carries `<command-name>` tags plus the SKILL.md body rather than `/ponytail`, so the anchored regex never matches and the mode is never set. I did not verify this live.

**SubagentStart → `ponytail-subagent.js`**
- Reads the flag. If it is missing or `off`, it injects nothing.
- Otherwise it emits `{"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"<full ruleset>"}}`. The code comment says a raw-stdout form is dropped for SubagentStart.
- **Injection is unscoped by default.** Reviewers, auditors and Explore agents all get "three short lines, no essays" (#502).
- Opt-in scoping: the `PONYTAIL_SUBAGENT_MATCHER` regex against `agent_type`, **fail-open** (a missing type, parse error or timeout still injects). It has no ReDoS guard (#658).
- A community-tested negative regex (#664): `^(?!(explore|claude-code-guide|statusline-setup)$)`.

**Statusline** (`ponytail-statusline.sh` / `.ps1`)
- Reads the flag. Prints `[PONYTAIL]` (colour 108, green) or `[PONYTAIL:ULTRA]` (colour 173, amber), with the mode uppercased.
- It is the **only user-visible state channel**. It disappears as soon as the user has any other statusline, and the nudge only fires when `statusLine` is absent (#648).

### 2.3 Mode state and its defects

State is **one machine-global file**, `~/.claude/.ponytail-active`. [code]
- Concurrent sessions overwrite each other (#662, #809, both [reported], and consistent with the code).
- `/ponytail-review` in one pane sets `review`, and from then on **every other pane's subagents** receive `PONYTAIL MODE ACTIVE — level: review. Behavior defined by /ponytail-review skill.` instead of the ladder (#736, #809).
- A session started with `PONYTAIL_DEFAULT_MODE=off` **deletes** the flag for all sessions.
- Hook payloads already carry `session_id`. PR #884 (closed, no reason stated) and #918 (open) key the file as `.ponytail-active.<session_id>` with a 7-day sweep. That is the right design.

**Scope bypass (the key design lesson).** Frontmatter such as "Do NOT use for non-coding requests" governs **skill triggering only**. The hook strips the frontmatter and injects the body unconditionally, so the Output rules (three lines, "explanation is debt") apply to prose, summaries and translations too (#332). #332 includes an observational Opus 4.8 transcript study: median message length went from 286 to 240 words after install.

### 2.4 Other host adapters (context only)

- The repo ships adapters for about 16 hosts: Codex, Copilot, Cursor, Gemini (`commands/*.toml` and `gemini-extension.json`), OpenCode, pi, Qoder, Kiro, Windsurf, Cline, Hermes, OpenClaw, an MCP server that serves the ruleset, and others.
- About half the open issues are adapter breakage.
- #808 argues the repo now violates its own YAGNI thesis.

---

## 3. `.claude-plugin/` manifests (verbatim, working example)

`.claude-plugin/plugin.json`:
```json
{
  "name": "ponytail",
  "version": "4.10.0",
  "description": "Lazy senior dev mode. Forces the simplest, shortest solution that actually works: YAGNI, stdlib first, no unrequested abstractions.",
  "author": {
    "name": "Dietrich Gebert",
    "url": "https://github.com/DietrichGebert"
  },
  "hooks": "./hooks/claude-codex-hooks.json"
}
```

`.claude-plugin/marketplace.json`:
```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "ponytail",
  "description": "Lazy senior dev mode for AI agents. The best code is the code you never wrote.",
  "owner": {
    "name": "Dietrich Gebert",
    "url": "https://github.com/DietrichGebert"
  },
  "plugins": [
    {
      "name": "ponytail",
      "description": "Forces the laziest solution that works. YAGNI, stdlib first, one line over fifty.",
      "source": "./",
      "category": "productivity"
    }
  ]
}
```

`hooks/claude-codex-hooks.json`:
```json
{
  "hooks": {
    "SessionStart": [
      { "matcher": "startup|resume|clear|compact",
        "hooks": [ { "type": "command",
                     "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/ponytail-activate.js\"",
                     "timeout": 5, "statusMessage": "Loading ponytail mode..." } ] }
    ],
    "SubagentStart": [
      { "hooks": [ { "type": "command",
                     "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/ponytail-subagent.js\"",
                     "timeout": 5, "statusMessage": "Loading ponytail mode..." } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command",
                     "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/ponytail-mode-tracker.js\"",
                     "timeout": 5, "statusMessage": "Tracking ponytail mode..." } ] }
    ]
  }
}
```

**Gotchas learned from the issues:**
- Skills are auto-discovered from `skills/<name>/SKILL.md`; the manifest has no skills field. The same holds for `commands/`, but ponytail's `commands/*.toml` are **Gemini CLI** format and are ignored by Claude Code.
- Use `${CLAUDE_PLUGIN_ROOT}`, not `${PLUGIN_ROOT}` (#11, #86 caused MODULE_NOT_FOUND and double registration).
- An unknown `commandWindows` field in hooks.json **fails marketplace validation** (#593, #857).
- The `$schema` URL in marketplace.json broke marketplace sync in Claude Desktop (Cowork) (#582).
- A hard dependency on `node` on PATH breaks the native macOS install (#708) and POSIX without Node (#645). WSL2 backslash paths break too (#646).
- On Windows, hooks run through a PowerShell wrapper. Never block on stdin; always use a time-boxed read.
- Strip the UTF-8 BOM before `JSON.parse` of `settings.json` or `config.json` on Windows (#148, #375).
- SessionStart takes raw stdout. SubagentStart needs `hookSpecificOutput` JSON or the context is dropped. UserPromptSubmit stdout reaches the **model**. A user-visible message needs `systemMessage`.

---

## 4. Benchmarks

### 4.1 Single-shot (promptfoo): `benchmarks/promptfooconfig*.yaml`, `loc.js`, `correctness.js`

- **Design:**
  - Arms: baseline (bare model, **no system prompt**), caveman and ponytail.
  - Five tasks: email validator, JS debounce, CSV sum, React countdown, FastAPI rate limit.
  - 10 reps (30 for cost). Median reported.
- **Metrics:**
  - LOC counted from fenced code blocks.
  - Cost and latency from the API.
  - A correctness gate: execution for email, debounce and CSV; **regex-only** for React and FastAPI (#909).
- **Claude medians (LOC):**

  | Arm | Haiku | Sonnet | Opus |
  |---|--:|--:|--:|
  | baseline | 518 | 693 | **256** |
  | ponytail | 39 | 44 | 51 |

- **Cost (30 reps):** ponytail is 63% cheaper on Haiku, 75% on Sonnet and **42% on Opus**, the smallest win because Opus has the leanest baseline.
- **Cross-provider** (`2026-06-17-cost-verification.md`):
  - gpt-5.4-mini: **+26% cost**.
  - **gpt-5.5: +39% cost and 0.9× speed (slower).** The explanation given: "the ruleset is re-sent as input every call and the baseline output is already terse, so the input and reasoning-token overhead outweighs the lines saved."
- **Critique #126 (Colin Eberhardt), which the maintainer accepted:**
  - The bare baseline answers like a chatbot with options and commentary.
  - With a one-sentence system prompt ("Provide just one example… no commentary"), the Haiku baseline fell from 108 to 16 LOC, against ponytail's 8.25.
  - Follow-up (RespectMathias): the rebuilt benchmark tests a strawman seven-word prompt, not a concise instruction set that includes the ladder, the safety rail and root-cause guidance.

### 4.2 Agentic: `benchmarks/agentic/` (`run.py`, `tasks.py`, `judge.py`, `complete.py`)

**Harness.**
- Real headless `claude -p` sessions with `--output-format json --permission-mode bypassPermissions`.
- **Isolation:** `--setting-sources project,local` plus `--plugin-dir <one plugin>` per arm, plus `--strict-mcp-config`. Without it the user's global ponytail SessionStart hook leaked into the baseline. An earlier run showing a ~4% gap was **retracted** for exactly that reason.
- `--disallowedTools Bash`.
- Every arm gets the same `--append-system-prompt` `NO_RUN` text: "Write the implementation (include tests if you normally would…). Do not run a dev server, install dependencies, run a database, or open a browser… just write the code and stop."
- Each cell runs in its own fresh workspace copy with a git snapshot. Workspaces are kept, so any metric can be recomputed offline with `--rescore`.

**Arms.** baseline, ponytail (plugin), caveman (plugin) and `yagni-oneliner` ("Follow YAGNI principles, and prefer one-liner solutions.").

**Tasks.** Task counts differ by source: the README lists 7 safety tasks, the writeup says "6 surgical", and 5 of them are scored for safety at 20 runs per arm (`cache` is a correctness axis).
- **LOC tier:** 12 one-line tickets against `fastapi/full-stack-fastapi-template@cd83fc1`.
  - Frontend: date picker, color picker, command palette, dropzone, wizard, star rating.
  - Backend: duplicate, search, count, archive, bulk-delete, CSV export.
  - Scored by **`git diff` added lines**.
- **Safety tier:** 7 "implement this function" stubs with the safety requirement left **implicit**:
  - `safe-path` (traversal), `rate-limit` (per-key vs global DoS), `sql-user` (parameterization), `auth-token` (HMAC verify), `csv-sum` (malformed row), `cache` (correctness), `critic-email` (newline injection).
  - Each is scored by **executing the produced function against adversarial input**.
- Later additions: `trace-transfer` (#245 root-cause probe), `reuse-slug` / `reuse-money` (#217) and a 27-task "runnable suite".

**Instrument hygiene (worth copying).** Every scorer ships a `good` and a `bad` reference. `run.py --selftest` must pass good and catch bad **before any API spend**. `bad` is always the plausible lazy version: correct on the happy path, unsafe on the adversarial input.

**LLM judges.**
- `judge.py` scores over-engineering 0–3 with `claude-sonnet-4-6` at temperature 0. It must name the offending construct.
- `complete.py` scores completeness 0–3 (stub → full), so a low-LOC arm that simply builds less gets caught.
- Both self-validate by ranking a bad reference above a good one before they are trusted.

**Results: `results/2026-06-18-agentic.md`** (Haiku 4.5, n=4, Claude Code 2.1.177)

LOC per task (baseline → ponytail → yagni-oneliner):

| Task | baseline | ponytail | yagni-oneliner |
|---|--:|--:|--:|
| date picker | 404 | 23 | 162 |
| color picker | 287 | 23 | 25 |
| dropzone | 251 | 95 | 175 |
| wizard | 571 | 312 | 406 |
| star rating | 103 | 70 | 101 |
| command palette | 268 | 233 | 285 |
| archive | 175 | 116 | 147 |
| search | 44 | 44 | 43 |
| CSV export | 36 | 33 | 32 |
| bulk-delete | 33 | 26 | 24 |
| duplicate | 24 | 23 | 20 |
| count | 21 | 17 | 18 |

- The wins come almost entirely from the **native-element rung** (`<input type="date|color|file">`).
- Summary against baseline, feature tier:

  | Arm | LOC | Tokens | Cost | Time |
  |---|--:|--:|--:|--:|
  | ponytail | −54% | −22% | −20% | −27% |
  | yagni-oneliner | −33% | −14% | −21% | −30% |
  | caveman | −20% | +7% | +3% | +2% |

  As noted in §0, −54% is a ratio of sums; the per-task mean is −35%.
- Safety tier:
  - baseline, caveman and ponytail are 20/20 safe. yagni-oneliner is 19/20; it dropped the traversal guard once on `safe-path`.
  - The authors themselves call the gap small: "one slip in twenty… a floor, not a dramatic result."
  - On the safety tier ponytail's LOC is only −5%.

**Limitations they admit:**
- One model (Haiku).
- Safety checks are a floor, not proof.
- n=4 with high frontend variance.
- yagni-oneliner is their own paraphrase of the critic's prompt.
- 4 of 192 cells were killed by a Windows timeout.

**Limitations they don't state:**
- `NO_RUN` plus no Bash means **the harness cannot observe verification loops, test-running behaviour, tool-call inflation or turn count** under realistic use. Those are the axes that matter most for an Opus-class agent.
- Tickets are one-liners with no hidden requirements, so "silently skipped a requested part" (#660) is only covered by the LLM completeness judge, and completeness numbers are not in the published table.
- There is no probe for edits outside the requested scope (#640).
- There is no multi-turn or long-session cost measurement.

### 4.3 Other results files (short)

Not read: `2026-06-12-caveman-vs-ponytail.md`, `2026-06-12-v4-hardening-vs-caveman.md`, `2026-06-16-correctness-gate-fix.md` and `2026-06-17-agentic-safety.md` (superseded).

- `2026-06-16-robustness-audit.md`:
  - 12 edge-case traps; baseline and ponytail both 20/20 on gpt-4.1-mini and gpt-5.4-mini.
  - One soft spot, **email on OpenAI**: `email.utils.parseaddr` used as a "validator" under stdlib-first pressure, for example 79% on gpt-4.1. Claude scored 100%.
  - They tried **8 skill-text edits to fix it and every one was ≤ the current text**: "Counter-instructions make small models overthink and fail *more*."
- `2026-06-22-issue-245-217-comprehension.md`: see §4.4.
- `2026-06-15-llama3.2-local.md`: the ladder isn't followed by small local models.
- **Independent run, KuldeepB19 (#236):**
  - Plugin installed, **Opus 4.8**, 24 tasks × {none, lite, full, ultra} × 5 = 480 builds, graded by execution.
  - Results: **~44% less code, no correctness or security regression, but it drops everyday bad-input handling on 5 of 24 tasks** (junk number in an invoice total, bad row in an average). **Worse at higher levels.**
- **Independent run, RicardoCostaGit (#121):**
  - Cursor SDK, multi-turn, completion-forced tasks.
  - Ponytail ON meant **more tool calls and tokens but leaner output** on most models. Opus 4.8 was roughly neutral (−2% cost).

### 4.4 Most relevant evidence for Opus-class models

| Finding | Model | Source |
|---|---|---|
| Root-cause bug fix: baseline 1/6, ponytail **6/6**, using the *operational* "grep every caller, fix the shared function" directive. A prose "trace the flow end to end" version scored **0/3**. | Opus 4.8, Sonnet 4.6 (Haiku: baseline 0/6, ponytail ~0–2/6, noise) | `2026-06-22…md` |
| Reuse rung (#217): no effect, because the baseline already reuses helpers 100% of the time. | Sonnet, Opus, Haiku | same |
| Leanest baseline (256 LOC) and smallest cost win (−42%). | Opus (single-shot) | README |
| −44% code; robustness regression on 5 of 24 tasks, worse at ultra. | Opus 4.8 | #236 |
| **+6.9% cost [CI +3.9, +10.0], p<1e-4 vs a one-sentence "leave a runnable check" prompt.** The per-turn marginal cost stays +8–13% with no break-even point. Ponytail still delivered −20% LOC and was the only arm whose safety pass rate never dropped. | Sonnet 5, CC 2.1.220 | #685 |
| +39% cost and slower. | GPT-5.5 | cost-verification |
| Echoed the banner as a fake `_ctx_hook` line plus a fabricated plan-mode `<system-reminder>`, and stalled the turn. | Opus 4.8 xhigh + caveman | #595 |
| Ignores ponytail and over-builds (manual DNS resolution for an image fetch). | "5.6 Sol" (OpenAI) | #666 |
| "Lazy" read as human-effort avoidance: broke out of the harness to download a local model for a translation job. | GPT 5.6 | #633 |

### 4.5 How to reuse their harness for our plugin

**Keep:**
- The isolation flags `--setting-sources project,local --plugin-dir <ours> --strict-mcp-config`. This is mandatory, or our own installed plugin contaminates the baseline.
- Fresh workspace per cell, preserved runs and `--rescore`.
- The `good`/`bad` reference `--selftest` gate.
- Git-diff LOC, excluding tests.
- The 7 adversarial safety tasks and `trace-transfer`. They are cheap, deterministic and stdlib-only.
- Both LLM judges, with self-validation.

**Add:**
1. **A Bash-enabled variant.** Drop `NO_RUN` and allow Bash. Log `num_turns`, tool calls by type, test and verification runs, and `total_cost_usd` from the `--output-format json` result. This is the only way to see over-verification and loops.
2. **A fair opponent arm.** A compact ruleset of about 150–300 tokens with the ladder, the safety rail and the root-cause directive (RespectMathias's point in #126), plus a bare "match existing scope" one-liner.
3. **A scope-creep probe.** Count changed lines **outside** the files and functions the ticket names: reformatting, comment rewrites, deleted unrelated dead code (#640, #945).
4. **Hidden-requirement tickets** with 3–4 stated sub-requirements and a deterministic check per requirement, to catch "silently didn't implement a requested part" (#660, sebthom).
5. **Everyday bad-input probes** (#236): junk numeric input, a malformed row. These are not trust-boundary attacks, which is where ponytail regresses.
6. **Multi-turn cost.** 5-turn sessions through stream-json or `--resume` chains. Price cache writes and cache reads separately (#685's method: cluster bootstrap and a stratified permutation test).
7. **Subagent-heavy sessions,** measuring injected bytes × spawns (#597: 37–240 spawns per session).
8. **Opus 5.5 plus one cheaper model,** n≥5, reporting both the ratio-of-sums and the per-task mean.

---

## 5. Issues and PRs digest (criticisms, failures, conflicts)

**Benchmark and claims**
- **#126:** single-shot baseline inflation (accepted), which led to the agentic rebuild.
- **#65 / #100:** "does it degrade performance?"
  - #100's framing is the most important one: rules like "first lazy solution that works is the right one", "reflex, not a research project" and "two rungs work, take the higher" **constrain reasoning, not just output**.
  - Proposal: let the model solve fully, then simplify in a separate critique pass. The maintainer left it open.
- **#900, #804:** headline math (ratio of sums vs mean, medians vs means).
- **#909:** the correctness gate is structural-only for 2 of 5 tasks.

**Cost**
- **#685:** the per-turn cost slope from resident bytes.
- **#597 / #767 / #908:** replace the injected body with the condensed fallback (~49% smaller) or a 21-token skill pointer. None of these is merged.
- **#111:** a free-tier Codex quota burned on the first prompt.
- **#219:** skill descriptions cost about 340 tokens resident; closed as wontfix.
- **#709:** Codex truncated the long description.

**Behaviour regressions**
- **#660:** "shortest diff" leads to *distributed* complexity: policy pushed into callers, custom Mapping subclasses. Proposal: "Minimize the number of concepts, contracts, and places a maintainer must inspect." sebthom removed the plugin after two weeks because "the agent silently decided not to implement functional parts of features I had explicitly requested."
- **#640 / #945:** no rule against unrequested adjacent edits. "Deletion over addition" arguably encourages deleting pre-existing dead code.
- **#745:** "Read fully, then be lazy" stalls agents on 10k-line markdown files, and every level keeps the rule.
- **#757:** "Code first" and "never stall" beat the host's plan-mode gate. The agent writes a spec `.md` instead of calling `submit_plan`, and re-runs timed-out checks endlessly.
- **#823:** "ONE runnable check" caps security paths that need several checks.
- **#602:** "Agent follows ponytail while writing tests": it wrote 4 tests where 50+ were needed.
- **#887 / #120:** the mandatory `ponytail:` marker. Many users uninstalled over the branding; it conflicts with no-comment codebases; the model rewrote existing comments to add the brand. The maintainer kept the marker because `/ponytail-debt` greps for it. A suggested neutral name is `techdebt:`.
- **#737:** the model picks up a contrastive-prose tic ("X, not Y"). The skill text itself is full of it.
- **#633:** "lazy" wording is misinterpreted by newer models. Advice given: "give it the rules as a checklist and drop the 'lazy'".
- **#595:** no "no self-reference" rule, so the model echoed the banner.

**Plugin mechanics**
- #663, #584, #648: mode switching is invisible to the user and non-functional on Claude Code.
- #662, #809, #736: global flag and review-mode latch.
- #502: subagent injection pollutes reviewers.
- #658: matcher ReDoS.
- #443, #763, #790, #791: Windows hangs and console flashes.
- #645, #646, #708: node, WSL and macOS.
- #821: SessionStart on compact makes Codex greet like a new session.

**Conflicts with other plugins**
- **#332:** caveman and ponytail inject contradictory style rules. Caveman added detection that reduces its own injection when ponytail is present; ponytail does not reciprocate. Ponytail's own Output and Boundaries sections also contradict each other.
- **#18, #68, #193:** "they stack"; the maintainer says ponytail cuts code and caveman cuts prose.

**Maintenance signal**
- Most substantive fix PRs remain **open and unmerged** as of 2026-09-29: #668 levels, #667 and #853 mid-session inject, #908 overhead, #918 session scope, #753 read-scope, #945 scoped diffs, #634 and #797 condensed subagent payload.
- The last merges (2026-09-14) were a release plus Cursor hooks.
- Treat the repo as a source of ideas and data, not as a maintained dependency.

---

## 6. Critical assessment for an Opus 5.5 plugin

The brief frames Anthropic guidance as warning against over-verification and scope expansion. I have not cited Anthropic documents here; everything below is grounded in ponytail's own issues and measurements. Check it against the current Anthropic prompting docs separately.

### What works (keep or adapt)

1. **The ladder's reuse, native and stdlib rungs.** Measured wins come almost entirely from "native platform feature" (−92% to −94% on date and color pickers). Keep these as *ordering hints*, not as a mandatory reflex.
2. **The operational root-cause directive:** "grep every caller of the function you touch; fix the shared function once." This is the single rule with a clean Opus-class effect (1/6 → 6/6), and **operational wording beat prose** (0/3). Lesson: write imperative, checkable procedures, not virtues.
3. **An explicit never-simplify list** (trust-boundary validation, data-loss error handling, security, accessibility, explicit requests), plus "user insists → build it, no re-arguing." Held 100% on the adversarial tier.
4. **Separating critique from generation.** `-review` and `-audit` as one-shot, report-only passes with a strict one-line-per-finding format and tags. Add the missing pieces:
   - Whole-tree caller check before `delete:`.
   - Base commit in the header.
   - Per-finding confidence.
   - Deletion obligations (#679, #866).
5. **The honesty boundary in `-gain`:** never invent per-repo savings.
6. **Benchmark hygiene:** isolation flags, good/bad self-test, adversarial execution, completeness judge, published limitations and retractions.
7. **Compaction survival:** SessionStart matcher `compact` (and `clear`). Fix ponytail's bug: re-inject the *session's current* mode, not the default.
8. **Defensive hook engineering:** time-boxed stdin reads, BOM stripping, `isShellSafe` path allowlist, silent-fail, `CLAUDE_CONFIG_DIR` awareness, never blocking the session.

### What is weak or outdated for Opus 5.5

1. **It is a correction for a failure mode strong models largely don't have.**
   - Opus already has the leanest baseline and the smallest win (−42% single-shot, about neutral agentic cost in #121).
   - On terse, reasoning-heavy models the overhead dominates (GPT-5.5 +39%; Sonnet 5 +6.9% vs a one-sentence prompt).
   - Hypothesis to test with the §4.5 harness: Opus 5.5 sits on the "overhead dominates" side unless the payload is tiny.
2. **It constrains thinking, not only the artifact** (#100).
   - "First lazy solution… is the right one", "reflex, not a research project" and "take the higher rung and move on" push a highly capable planner toward premature commitment.
   - The documented results: hidden-requirement drops (#660), trimmed everyday input handling (#236), distributed complexity (#660).
3. **Its objective is misaligned.** The target is "shortest diff / fewest lines", not "fewest concepts and contracts for a maintainer" (#660) or "every changed line traces to the request" (#640). Line count is a proxy that goes wrong on refactors and interface design.
4. **Some rules push toward *more* scope or verification, others toward less.** For a model that follows instructions literally, the net effect is incoherent:
   - "Read fully / trace the whole thing" causes stalls on large files (#745).
   - "Leave ONE runnable check" is too little for security (#823) and too much for trivial edits in plan mode (#757).
   - "Deletion over addition" invites deleting code nobody asked to touch (#640).
   - A skill for an Opus 5.5 plugin should state scope once: **do what was asked, touch only what the request requires, verify proportionately to risk**.
5. **The payload is heavy and not tiered.**
   - About 1.3k tokens are resident in the main thread and **re-sent to every subagent** (#597), with no default scoping.
   - The payload includes a comparison table, examples, persona prose and "ACTIVE EVERY RESPONSE" shouting.
   - The condensed version (~670 tokens) already exists and ships only as an error fallback.
6. **Hook injection bypasses skill scoping.** The "not for prose" description is stripped, so the Output rules hit every turn, including reviewers, summaries and plan mode (#332, #502, #757). A skill-first design lets the model load rules only when coding.
7. **The levels are fake** (3 lines differ). "Ultra" makes robustness worse (#236). One ruleset of one size is served to every agent type, task type and model.
8. **The state model is broken for multi-session use.** It uses a machine-global flag, mode switches don't deliver rules (#663), confirmations are invisible to the user (#648), and the statusline is the only UI.
9. **Branding in user code** (`ponytail:` markers) and persona language ("lazy") cause adoption and interpretation problems (#120, #887, #633). The prose style leaks into output (#737, #595).
10. **The evidence base is thin for Opus 5.5.** There is no agentic Opus run, the harness is blind to verification and turn behaviour, and the headline numbers are overstated (§0).

### Recommendations for our design

| Ponytail element | Verdict | Adaptation |
|---|---|---|
| Ladder (reuse → stdlib → native → installed dep → minimal) | **Adapt** | Present it as a short ordered *preference list*, applied after understanding. Drop "one line" as a rung and drop "first lazy solution wins". |
| Root-cause "grep callers, fix shared function" | **Keep** | Keep the operational wording. |
| Never-simplify list | **Keep and extend** | Add everyday input handling (#236) and "every explicitly requested behaviour is implemented, or you say which part you didn't do" (#660). |
| "Shortest diff wins" | **Replace** | "Smallest set of concepts and contracts; every changed line traces to the request; no edits to adjacent code, comments or formatting" (#640, #660). |
| "Read fully, then be lazy" | **Replace** | "Read what the change touches; for large docs or data, read structure and the relevant sections" (#745). |
| "ONE runnable check" | **Replace** | Verification proportional to risk: none for trivial edits, targeted tests for logic, several for security paths. Run bounded, and don't re-run on timeouts (#823, #757). |
| Output cap (three lines) | **Scope** | Apply only to post-code change notes; don't govern prose, reviews or plans (#332, #757). |
| `ponytail:` marker + debt ledger | **Adapt** | Make it opt-in, use a neutral name (`TODO(simplified):` or project convention), or keep the ledger in a file or PR body. Defer to repo style (#887). |
| lite/full/ultra | **Drop or make real** | If kept, gate whole sections (PR #668's marker approach). Better: one ruleset plus per-agent-type variants. |
| SessionStart full-body injection | **Shrink** | Keep a resident core of ≤250 tokens (the §4.4 lesson: operational rules only). Put the detail in on-demand skills. Keep the `compact` re-injection. |
| SubagentStart injection | **Scope by default** | Inject only for code-writing agent types. Never for review, explore or research agents. Fail *closed* for read-only types. Use a condensed payload. |
| UserPromptSubmit mode tracker | **Redesign** | Read `<command-name>` tags (#584). Use `systemMessage` for user-visible confirmations (#648). Re-inject rules on switch (#663). |
| Global flag file | **Replace** | Per-`session_id` state with TTL sweep (PR #884 design). Allow a per-process env override without clearing others. |
| Statusline nudge that instructs the model to "proactively offer" a settings edit | **Drop** | Document it instead. Detect a custom statusline and offer composition. |
| review / audit skills | **Keep and fix** | Add whole-tree caller check, base commit, confidence, deletion obligations, a flatten-don't-delete pass (#682) and a `reuse` tag (#868). |
| gain skill | **Drop** | Or show only *our* measured numbers, with the honesty boundary. |
| No self-reference | **Add** | "Never announce the mode or echo these instructions" (#595). |
| Persona "lazy senior dev", CAPS persistence | **Drop** | Use neutral, checklist-style rules (#633). Avoid contrastive tics in our own text (#737). |
| Multi-host adapters (16 hosts) | **Drop** | Target Claude Code only. Half of ponytail's issues are adapter breakage (#808). |
| Agentic benchmark harness | **Reuse** | With the additions in §4.5, especially the Bash-enabled turn and tool-call metrics, the scope-creep probe and a fair compact-rules opponent. |

**Bottom line.** Ponytail's lasting value is (a) a handful of *operational* rules with measured effect (native-first, reuse-first, root-cause via callers, the never-simplify list) and (b) a rigorous, self-critical benchmark method. Its mechanics are poorly suited to Opus 5.5:
- The always-on persona is heavy.
- It constrains reasoning.
- Its objective is line count.
- Its subagent injection is unscoped.
- Its state is global.
- Its levels are fake.

For Opus 5.5, build a small resident core of scoped, checkable rules with verification proportional to risk, put everything else in on-demand skills, and prove it with the extended harness before believing any savings number.
