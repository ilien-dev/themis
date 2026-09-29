# 02 — Claude Code platform research (for a behavior-shaping plugin + A/B testing)

- Date of research: 2026-09-29. Local Claude Code: **2.1.285** (`claude --version`), Windows 11.
- Sources: official docs at `https://code.claude.com/docs/en/...` (fetched this day), `platform.claude.com` skill best practices, the official `CHANGELOG.md` (raw.githubusercontent.com/anthropics/claude-code/main), local `claude --help` output, and installed official plugins under `~/.claude/plugins` (read-only, as working examples).
- Convention: **[UNVERIFIED]** = not confirmed by an official page read in this session. **[LOCAL]** = observed from local CLI help / installed plugin files. Quotes in "..." are verbatim.
- This is a DESIGN input. No plugin files were created.

---

## 0. TL;DR for the design

1. **A plugin cannot ship a CLAUDE.md.** "A `CLAUDE.md` at the plugin root isn't loaded as context, and `claude plugin validate` warns when it finds one. To include instructions that load into Claude's context, put them in a skill." (manifest-reference). Rules injection must therefore use one of:
   - hooks returning `additionalContext` (SessionStart / UserPromptSubmit / etc. — see §3),
   - skills (model- or user-invoked, progressive disclosure),
   - the plugin `settings.json` **`agent`** key, which makes one of the plugin's agents the **main thread** ("Claude then answers in the main conversation with the `security-reviewer` agent's system prompt and model") — the strongest lever, and a clean A/B variable,
   - an output style shipped in `output-styles/` (user must select it; see §9).
2. **Test harness = `claude plugin eval`** (GA since ~2.1.269; requires git ≥ 2.31). It runs each case N=3 times *with* and *without* the plugin and reports `Δ`. Details in §6.
3. **Windows gotcha:** granting `Bash`/`PowerShell` to eval runs requires an OS sandbox backend; "Native Windows has no backend, so run shell-granting suites under WSL2". Read/Write/Edit-only cases work natively.
4. **Model context (changelog):** Opus 5.5 (`claude-opus-5-5`) added in 2.1.280, "now the default Opus model — 1M context". Todo tools (TodoWrite/Task*) are **not offered** on Opus 4.8+, Sonnet 5+, Fable 5+ unless `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. `/doctor prompt-audit` (2.1.284) audits CLAUDE.md/skills/agents/commands "for prompting patterns written for older models".

---

## 1. Plugin manifest, layout, variables, dev loop, validation

Sources: https://code.claude.com/docs/en/plugins/manifest-reference , /plugins/components , /plugins/create , /plugins/loading , /plugins/install , /plugins/create-marketplace , /plugins/overview

### 1.1 Manifest (`.claude-plugin/plugin.json`)

- Optional. "Without it, Claude Code loads the components it finds in the standard layout. The plugin name then comes from the marketplace entry, or from the directory name when you load the plugin with `--plugin-dir`."
- **Only `plugin.json` goes inside `.claude-plugin/`**; every component dir sits at plugin root. "Components saved there don't load."
- `name` is the only required key: kebab-case, no spaces, `@`, `:`, path separators. Every component is namespaced `<plugin>:<name>`.

Verbatim full example (manifest-reference):
```json
{
  "name": "deploy-tools",
  "displayName": "Deploy Tools",
  "version": "1.2.0",
  "description": "Deployment commands, a review agent, and a status monitor",
  "author": { "name": "Example Team", "email": "dev@example.com", "url": "https://example.com" },
  "homepage": "https://example.com/docs/deploy-tools",
  "repository": "https://github.com/example/deploy-tools",
  "license": "MIT",
  "keywords": ["deployment", "ci"],
  "defaultEnabled": true,
  "dependencies": ["secrets-vault"],
  "metadata": { "catalogId": "cat-123" },
  "skills": ["./extra-skills/"],
  "commands": {
    "status": { "source": "./commands/status.md", "description": "Show the current deployment status" },
    "about":  { "content": "Explain what the deploy-tools plugin provides.", "description": "Describe this plugin" }
  },
  "agents": ["./agents/reviewer.md"],
  "hooks": "./config/extra-hooks.json",
  "mcpServers": { "deploy-api": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"] } },
  "lspServers": "./.lsp.json",
  "outputStyles": "./styles/",
  "experimental": { "themes": "./themes/", "monitors": "./config/monitors.json" },
  "userConfig": {
    "api_token": { "type": "string", "title": "API token", "description": "Token for the deployment API", "sensitive": true }
  }
}
```

Field table (condensed, verbatim semantics):

| Field | Type | Notes |
|---|---|---|
| `$schema` | string | ignored at load |
| `name` | string | **required**, kebab-case |
| `displayName`, `description`, `author{name,email,url}`, `homepage` (must parse as URL or plugin fails), `repository`, `license`, `keywords` | | metadata |
| `version` | string | "Setting it keeps users on that version until you change it" (not semver-checked). Not pinning for `--plugin-dir` / local-dir marketplace (loaded in place). |
| `metadata` | object | free-form, not read (v2.1.222+) |
| `defaultEnabled` | bool | default `true` |
| `dependencies` | array | `"name"`, `"name@marketplace"`, or `{name, marketplace, version}` |
| `settings` | object | **only `agent` and `subagentStatusLine` take effect**; a root `settings.json` wins over this key |
| `userConfig` | object | prompted values; strict schema (see below) |
| `channels` | array | message channels bound to an MCP server |
| `skills` | path(s) | **adds to** default `skills/` scan; `"."`/`"./"` = plugin root |
| `commands` | path(s) or object map | **replaces** default `commands/` scan |
| `agents` | path(s) to `.md` files (no dirs) | **replaces** default `agents/` scan |
| `hooks` | path / inline object / array | **merges** with `hooks/hooks.json` |
| `mcpServers` | path / `.mcpb`/`.dxt` / URL / inline / array | merges with `.mcp.json`; later name wins |
| `lspServers` | path / inline / array | merges with `.lsp.json` |
| `outputStyles` | path(s) | **replaces** default `output-styles/` scan |
| `workflows` | path(s) | replaces `workflows/` scan |
| `experimental.themes` / `.monitors` / `.evals` | | `evals` = eval dir if not `evals/` |

Rules:
- Unknown **top-level** key → stripped, plugin loads (validator warning). Unknown key inside `userConfig` option / `channels` / `lspServers` / `monitors` entry → **error, plugin doesn't load**.
- Every component path must start with `./`, resolve inside the plugin root, and exist. `..` → "Path contains ".." which could be a path traversal attempt". On macOS/Linux a backslash anywhere in a path is rejected → **always write forward slashes** (important since we author on Windows).
- If default folder exists and manifest key that *replaces* it is set → warning `Default <folder>/ folder is ignored because the manifest sets "<key>"`.

`userConfig` option fields: `type` (string|number|boolean|directory|file, required), `title` (req), `description` (req), `required`, `default`, `options` (string enum; v2.1.271+), `multiple`, `sensitive`, `min`/`max`. Values → `pluginConfigs` in user settings (sensitive → OS credential store). Referenced as `${user_config.KEY}` (MCP/LSP config, exec-form hook `args`, skill & agent content — non-sensitive only) or env `CLAUDE_PLUGIN_OPTION_<KEY>` (all hook processes). **Shell-form hook commands reject `${user_config.*}`** (error). The config dialog only appears via interactive `/plugin` install/enable, never with `--plugin-dir` or `claude plugin install` (use `--config KEY=VALUE` or `/plugin configure`).

### 1.2 Standard layout (verbatim tree, manifest-reference)
```
deploy-tools/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── deploy/
│       └── SKILL.md
├── commands/
│   └── status.md
├── agents/
│   └── reviewer.md
├── hooks/
│   └── hooks.json
├── monitors/
│   └── monitors.json
├── output-styles/
│   └── terse.md
├── themes/
│   └── dracula.json
├── workflows/
│   └── release-audit.js
├── bin/
│   └── deploy-tool
├── scripts/
│   └── format.sh
├── settings.json
├── .mcp.json
└── .lsp.json
```
- `bin/`: on the Bash tool's `PATH` while enabled; appended *after* user PATH (can't shadow `git`). claude.ai/Cowork refuse plugins with top-level `bin/`.
- `settings.json` at root: only `agent`, `subagentStatusLine`. Precedence: root file > manifest `settings`; **user's own `agent` in `~/.claude/settings.json` overrides the plugin's** (plugin defaults are the lowest settings layer); two plugins → last loaded wins.
- Agents may be nested: `agents/review/security.md` → `my-plugin:review:security`.
- Plugin agent frontmatter supported: `name, description, model, effort, maxTurns, tools, disallowedTools, skills, memory, background, omitClaudeMd, isolation ("worktree" only), color, experimental.cacheTtl`. **Ignored in plugin agents: `permissionMode`, `hooks`, `mcpServers`, `initialPrompt`.** Unparseable frontmatter → agent loads with all fields ignored, description "Agent from my-plugin plugin".
- Hooks: `hooks/hooks.json` has a top-level `"hooks"` key, same shape as `settings.json` `hooks`. "A plugin's hooks don't wait for one of the plugin's skills or commands to be used. Claude Code registers them when a session loads the plugin." Plugin MCP tool names: `mcp__plugin_<plugin>_<server>__<tool>`.
- Monitors: background shell commands whose output reaches Claude as notifications. **"plugin monitors start in an interactive session and never in non-interactive mode with the `-p` flag."**

### 1.3 Path variables (verbatim table)

| Variable | Resolves to | Use it for |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path of the plugin's installed version | Scripts, binaries, and config files bundled with the plugin |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/<id>/`, created on first reference and kept across plugin updates | `node_modules`, generated code, caches |
| `${CLAUDE_PROJECT_DIR}` | The project root | Project-local scripts and config |

Where they resolve: hook `command`/`args` (and exported to hook env with `CLAUDE_PLUGIN_OPTION_<KEY>`), monitor `command` (not exported), MCP stdio `command/args/env`, LSP, and "Skill, command, and agent content — Anywhere in the Markdown body". **They are NOT in the environment of Bash-tool commands** — write `${CLAUDE_PLUGIN_ROOT}` literally in the SKILL.md body and Claude Code substitutes the path when loading. `${CLAUDE_PLUGIN_ROOT}` changes on every version (don't write state there). "On Windows, the substituted paths use forward slashes."

Quoting: shell-form hooks → `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/x.sh"`; validator warns on unquoted variable unless hook sets `"shell": "powershell"`. Exec form (`args` array) needs no quoting.

### 1.4 Dev loop (no marketplace)

- `claude --plugin-dir ./my-plugin` (dir or `.zip`; repeatable; a folder of plugins loads each child with a manifest — v2.1.265+). ID becomes `<name>@inline`.
- `claude --plugin-url https://…/x.zip`.
- `CLAUDE_CODE_PLUGIN_DIRS` env var (absolute paths; v2.1.280+; project/local settings can't set it).
- `claude plugin init <name> [--with skills agents hooks mcp lsp output-style channel]` scaffolds under `~/.claude/skills/<name>/` → auto-loads every session as `<name>@skills-dir` [LOCAL help]. A project-scope copy at `<project>/.claude/skills/<name>/` loads only after workspace trust and only from the primary cwd.
- Edit files mid-session → `/reload-plugins` (prints one `Reloaded:` line). If reload would invalidate the prompt cache it's held; `/reload-plugins --force`.
- Name conflicts: `--plugin-dir` copy **silently replaces** a same-named installed marketplace plugin (only visible with `--debug`: `Plugin "<name>" from --plugin-dir overrides installed version`). To disable an inline plugin: `"enabledPlugins": {"<name>@inline": false}`.
- `--plugin-dir` at a *marketplace root* loads nothing (no error) — point it at the plugin folder.

### 1.5 Local marketplace loop

`my-marketplace/.claude-plugin/marketplace.json` (verbatim):
```json
{
  "name": "my-marketplace",
  "description": "Plugins for my team",
  "owner": { "name": "Your Name" },
  "plugins": [
    { "name": "my-first-plugin", "source": "./plugins/my-first-plugin", "description": "A greeting plugin to learn the basics" }
  ]
}
```
```
claude plugin validate ./my-marketplace
claude plugin marketplace add ./my-marketplace
claude plugin install my-first-plugin@my-marketplace          # --scope user|project|local
```
- Relative-path plugins in a marketplace added from a local directory **load in place**: "Your edits to the source directory take effect at the next session start or `/reload-plugins`, and you don't need to increase the version." (No auto `npm ci` in that case.)
- Hosted/copied plugins go to `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`; a pinned `"version"` keeps users on the cached copy until the string changes; omit `version` to track commits (SHA-12).
- Scopes: user → `~/.claude/settings.json`; project → `.claude/settings.json` (still needs per-machine install); local → `.claude/settings.local.json`. local > project > user; managed wins over all.

### 1.6 Validation & inspection commands [LOCAL help + docs]

| Command | Purpose |
|---|---|
| `claude plugin validate <path> [--strict] [--json]` | manifest + frontmatter of every skill/agent/command, hooks, MCP entries (v2.1.281+), paths (outputStyles/lsp/monitors/themes v2.1.283+). Output ends `Validation passed` / `passed with warnings` / `failed`. `--strict` → warnings fail (CI). |
| `claude plugin details <name>` | component inventory + **projected token cost** (always-on vs on-invoke). Needs plugin loaded: `claude --plugin-dir ./x plugin details x`. |
| `claude plugin list [--json]` | load status; pass `--plugin-dir` before `plugin list` to include a dev plugin |
| `/plugin` → Installed / **Errors** tabs; `/reload-plugins`; `/mcp`; `claude --debug` (hook matches, exit codes, output); `/context` | runtime inspection |
| `claude plugin tag [path]` | creates `{name}--v{version}` git tag after checking plugin.json vs marketplace entry |
| `claude plugin configure <plugin>` | show/set userConfig (`--values-stdin`) |

---

## 2. Skills

Source: https://code.claude.com/docs/en/skills (fetched 2026-09-29).

### 2.1 Frontmatter (SKILL.md) — full field table, verbatim semantics

"All fields are optional. Only `description` is recommended." Field names are lowercase-hyphenated (except `when_to_use`); **an unrecognized field is silently ignored** (typo = no effect, no error). Frontmatter is read only if `---` is the file's first line. Unparseable YAML → skill loads with **no fields set** (so `/name` works but Claude can't match on the description; see with `--debug` or `claude plugin validate <dir>`). Booleans accept `true/false/yes/no/on/off/1/0` (v2.1.218+). A `.claude/commands/*.md` file accepts the same fields except `name` and `paths`.

| Field | Semantics |
|---|---|
| `name` | Command name. Defaults to directory name. In a plugin: sets the last segment, `/<plugin>:<name>`; bare `/<name>` also works unless taken. A `name` already prefixed with the plugin name isn't double-prefixed (v2.1.246+). |
| `description` | "What the skill does and when to use it. Claude uses this to decide when to apply the skill." If omitted → first non-empty body line. **Combined `description` + `when_to_use` truncated at 1,536 chars in the listing** ("Put the key use case first"). Cap configurable via `skillListingMaxDescChars`. |
| `when_to_use` | Extra trigger phrases / example requests; appended to `description`, counts toward the 1,536 cap. |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]`. |
| `arguments` | Named positional args (space-separated string or YAML list) → `$name` substitution. |
| `disable-model-invocation` | `true` = only the user can invoke (`/name`). **Description is removed from Claude's context entirely.** Also blocks preloading into subagents and scheduled-task firing. If Claude tries anyway, Claude Code blocks the call and tells it not to reproduce the steps another way. Default `false`. |
| `user-invocable` | `false` = hidden from `/` menu, user can't run it; Claude still can (description stays in context). Default `true`. |
| `allowed-tools` | Tools usable **without a permission prompt during the turn that invokes the skill**; "The grant clears when you send your next message." Does **not** restrict tools. Space/comma string or YAML list. Not gated by workspace trust (applies even in `-p` in untrusted folder). Deny/ask rules still override. |
| `disallowed-tools` | Tools removed from the pool while the skill is active; clears on next user message. |
| `model` | Model for the rest of the current turn (not saved); session model resumes at next prompt. Accepts `/model` values or `inherit`. With `context: fork` it sets the forked subagent's model. |
| `effort` | `low/medium/high/xhigh/max`; overrides session effort while active. (Changelog: was ignored on pinned-effort models, fixed.) |
| `context` | `fork` → run in a new subagent (see 2.4). |
| `agent` | Subagent type to use with `context: fork` (e.g. `Explore`, `Plan`, `general-purpose`, custom). |
| `background` | Only with `context: fork`; `false` = wait for result in the invoking turn. Default `true` (v2.1.218+). |
| `hooks` | Hooks registered when invoked, **kept for the rest of the session**; `once: true` supported only here. |
| `paths` | Globs (list or comma string); "Claude loads the skill automatically only when working with files matching the patterns." Same format as rule `paths`. |
| `shell` | `bash` (default) or `powershell` for `` !`cmd` `` / ```` ```! ```` injection blocks. `shell: bash` on Windows without Git Bash → invocation fails. |
| `metadata`, `license`, `compatibility` | Accepted, not acted on (Agent Skills spec fields). |

Portability: claude.ai uploads / Skills API accept only `name, description, license, compatibility, metadata, allowed-tools` (others = hard error "Unexpected key(s) in SKILL.md frontmatter"). Plugin skills in Claude Code accept all.

### 2.2 Invocation matrix and context cost (verbatim table)

| Frontmatter | You can invoke | Claude can invoke | When loaded into context |
|---|---|---|---|
| (default) | Yes | Yes | Description always in context, full skill loads when invoked |
| `disable-model-invocation: true` | Yes | No | Description not in context, full skill loads when you invoke |
| `user-invocable: false` | No | Yes | Description always in context, full skill loads when invoked |

- **Listing budget:** names always listed; descriptions dropped (least-invoked first) when the listing exceeds "1% of the model's context window" (env `SLASH_COMMAND_TOOL_CHAR_BUDGET` fallback 8,000 chars; setting `skillListingBudgetFraction`). With Opus 5.5 at 1M context the budget is ~10k tokens-equivalent chars [inference]. `/doctor`, `/skill-doctor`, `/context` Skills row show real cost.
- `skillOverrides` setting (`on` / `name-only` / `user-invocable-only` / `off`) — **does not affect plugin skills** (managed via `/plugin`).
- Permission rules: `Skill(name)`, `Skill(name *)`; deny `Skill` disables all.

### 2.3 Lifecycle (important for "always-on" behavior)

- "When you or Claude invoke a skill, the rendered `SKILL.md` content enters the conversation as a single message and stays there across later turns… Claude Code does not re-read the skill file on later turns, so write guidance that should apply throughout a task as standing instructions rather than one-time steps."
- Re-invocation with identical content → short "already loaded" note, not a second copy.
- **Compaction:** re-attaches the most recent invocation of each skill, "keeping the first 5,000 tokens of each", combined budget **25,000 tokens**, filled from most recently invoked; older skills can be dropped entirely.
- "If a skill seems to stop influencing behavior after the first response, the content is usually still present and the model is choosing other tools or approaches. Strengthen the skill's `description` and instructions… or use hooks to enforce behavior deterministically."
- "Keep the body itself concise. Once a skill loads… every line is a recurring token cost. State what to do rather than narrating how or why."

### 2.4 Substitutions & arguments

`$ARGUMENTS` (full string; if no placeholder receives args, Claude Code appends `ARGUMENTS: <value>`), `$ARGUMENTS[N]` / `$N` (0-based, shell-style quoting), `$name` (from `arguments`), `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}` (skill subdir, not plugin root), `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` (plugin skills only). Substituted in body and in `allowed-tools` Bash rules → pattern `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/x.sh *)` runs a bundled script without prompt. Escape `\$1`. Stacking: `/a /b 123` loads both (up to 1+5).

Dynamic injection: `` !`cmd` `` / ```` ```! ```` blocks run at render time (Bash tool semantics, 2-min timeout, cwd = session cwd); **a failed command aborts the whole invocation** (exit 1 tolerated only for grep/diff-type commands; append `|| true`). Permission check: anything not "allow" aborts (outside auto mode) → pre-approve with `allowed-tools`.

### 2.5 `context: fork`

- New subagent of type `agent`; SKILL.md content is its prompt; **no conversation history**. System prompt from the agent type; CLAUDE.md loads per agent startup rules (Explore/Plan skip CLAUDE.md and git status).
- Runs in **background** by default (v2.1.218+), but **blocks in `-p`/SDK**, with `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, re-entrant invocation, scheduled task. Background forks get the narrower background tool set and bypass checkpoints.
- "`context: fork` only makes sense for skills with explicit instructions" — guidelines-only skills return nothing useful.

### 2.6 Troubleshooting (official)
Not triggering → put natural keywords in description; check "What skills are available?"; measure with `claude plugin eval` + `tool_used: Skill`. Triggers too often → make description more specific or `disable-model-invocation: true`.

### 2.x Platform skill-authoring best practices (platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

- "Default assumption: Claude is already very smart. Only add context Claude doesn't already have." Challenge each paragraph: "Does this paragraph justify its token cost?"
- "Set appropriate degrees of freedom": high freedom (text heuristics) when many approaches valid; low freedom ("Run exactly this script… Do not modify the command") when fragile.
- "Test with all models you plan to use… What works perfectly for Opus might need more detail for Haiku." For Opus: "Does the Skill avoid over-explaining?"
- `name`: max 64 chars, lowercase letters/numbers/hyphens, no XML tags, no reserved words ("anthropic", "claude"). Gerund form recommended (`processing-pdfs`).
- `description`: max 1,024 chars, non-empty, no XML tags; must say **what it does and when to use it**; "Claude uses it to choose the right Skill from potentially 100+ available Skills." Write in third person [the page's examples all are].
- "Keep SKILL.md body under 500 lines for optimal performance". Split into files; **keep references one level deep** from SKILL.md (Claude may `head -100` nested files). Reference files >100 lines get a table of contents.
- Workflows: numbered steps + copyable checklist; **feedback loops** ("Run validator → fix errors → repeat"); "plan-validate-execute" with an intermediate machine-verifiable plan file.
- Scripts: "Solve, don't defer" (handle errors in the script), no "voodoo constants", make intent explicit ("Run X" vs "See X for the algorithm"); only script *output* costs tokens.
- Avoid time-sensitive info (use an "Old patterns" `<details>` section), inconsistent terminology, too many options (give a default + escape hatch), Windows-style paths.
- "Build evaluations BEFORE writing extensive documentation": identify gaps without the skill → 3 scenarios → baseline → minimal instructions → iterate. "Claude A writes / Claude B tests" loop. Checklist: "At least three evaluations created; Tested with Haiku, Sonnet, and Opus".
- MCP tool references must be fully qualified (`ServerName:tool_name` on the platform; in Claude Code the tool name is `mcp__plugin_<plugin>_<server>__<tool>`).

---

## 3. Hooks

Source: https://code.claude.com/docs/en/hooks (fetched 2026-09-29). hooks-guide not fetched (reference page covered everything needed).

### 3.1 Config shape
Event → matcher group → handlers:
```json
{ "hooks": { "PostToolUse": [ { "matcher": "Edit|Write",
    "hooks": [ { "type": "command", "command": "/path/to/lint-check.sh", "timeout": 30 } ] } ] } }
```
Plugin `hooks/hooks.json` = same object (top-level `"hooks"` key). "All matching hooks run in parallel." Identical handler in several **settings files** runs once; "A plugin's or skill's copy of the same handler stays separate."

### 3.2 Events (33) and when they fire
Per session: `SessionStart`, `SessionEnd`. Per turn: `UserPromptSubmit`, `Stop`, `StopFailure`. Per tool call: `PreToolUse`, `PostToolUse` (+ `PostToolUseFailure`, `PostToolBatch`, `PermissionRequest`, `PermissionDenied`). Others: `Setup` (`--init-only`, `--init`/`--maintenance` in `-p`), `UserPromptExpansion` (slash command expands), `MessageDisplay` (display-only rewrite), `Notification`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `TeammateIdle`, `InstructionsLoaded` (CLAUDE.md / rules loaded; reasons `session_start|nested_traversal|path_glob_match|include|compact`), `ConfigChange`, `CwdChanged`, `DirectoryAdded`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `PreModelSwitch`, `PostModelSwitch`, `Elicitation`, `ElicitationResult`.

### 3.3 Matcher syntax
- `"*"`, `""`, omitted → all. Only `[A-Za-z0-9_- ,|]` → exact name or list (`Edit|Write`, `Edit, Write`). Any other char → **unanchored JS regex** (`Edit.*` also matches `NotebookEdit`; use `^Edit$`). `FileChanged`/`StopFailure` exact set excludes `-`, space, `,`.
- Matcher field per event: tools → `tool_name`; SessionStart → `startup|resume|clear|compact|fork`; Pre/PostCompact → `manual|auto`; SubagentStart/Stop → agent type (plugin agents: `^my-plugin:reviewer$`); SessionEnd → reason; UserPromptExpansion → command name; Pre/PostModelSwitch → canonical model. **No matcher support (silently ignored):** `UserPromptSubmit, PostToolBatch, Stop, TeammateIdle, TaskCreated, TaskCompleted, WorktreeCreate, WorktreeRemove, MessageDisplay, CwdChanged`.
- Handler-level `if` (one permission rule, e.g. `"Bash(git *)"`, `"Edit(*.ts)"`) — only on tool events; on others a hook with `if` **never runs**. Best-effort (runs anyway when it can't parse the command).

### 3.4 Handler types & fields
Types: `command`, `http` (POST JSON body), `mcp_tool`, `prompt` (single LLM call, returns `{ok, reason}`), `agent` (experimental; subagent w/ Read/Grep/Glob, up to 50 turns, `{ "ok": true }` / `{ "ok": false, "reason": "..." }`).
Common fields: `type`, `if`, `timeout` (s), `statusMessage`, `once` (skill frontmatter only).
**Default timeouts:** command/http/mcp_tool **600 s**, lowered to **30 s on UserPromptSubmit / Pre- & PostModelSwitch**, **10 s on MessageDisplay**; prompt 30 s; agent 60 s; SessionEnd shares a 1.5 s budget (raisable to 60 s). Timed-out command hook output is discarded; a timed-out PreToolUse hook **does not block** ("don't count on a stalled hook to act as a gate").
Command fields: `command`, `args` (exec form, no shell), `async`, `asyncRewake` (background; exit 2 wakes Claude with stderr as system reminder), `shell` (`bash` default; `powershell` default on Windows without Git Bash).
Prompt/agent fields: `prompt` (`$ARGUMENTS` = hook input JSON), `model` (default = background/Haiku-class model).

Type support: all five types on `PermissionDenied, PostToolBatch, PostToolUse, PostToolUseFailure, PreToolUse, Stop, SubagentStop, TaskCompleted, TaskCreated, TeammateIdle, UserPromptExpansion, UserPromptSubmit`. `PermissionRequest`: no `agent`. **`SessionStart` and `Setup`: only `command` and `mcp_tool`.** Remaining events: command/http/mcp_tool only.

### 3.5 Input (stdin JSON)
Common: `session_id`, `prompt_id`, `transcript_path` (written async; may lag), `cwd`, `scratchpad_dir`, `permission_mode` (`default|plan|acceptEdits|auto|dontAsk|bypassPermissions`), `effort: {level}` (tool-context events), `hook_event_name`; `agent_id`/`agent_type` inside subagents or with `--agent`. Only SessionStart may get `model` (not always). No `$CLAUDE_MODEL` env; `$CLAUDE_EFFORT` is available.
Event-specific highlights:
- SessionStart: `source` (`startup|resume|clear|compact|fork`), `model?`, `agent_type?`, `session_title?`; on resume/fork also `seconds_since_last_response`, `context_tokens`, `prompt_cache_likely_expired`, `estimated_cache_write_usd`.
- UserPromptSubmit: `prompt` (pasted text expanded).
- PreToolUse/PostToolUse: `tool_name`, `tool_input`, `tool_use_id` (+ `tool_response` on Post).
- Stop/SubagentStop: `stop_hook_active`, `last_assistant_message`, `background_tasks[]`, `session_crons[]`.
- SubagentStart: `agent_id`, `agent_type`.
- PreCompact: `trigger`, `custom_instructions`; PostCompact: `trigger`, `compact_summary`.

### 3.6 Output: exit codes
- **Exit 0**: stdout parsed as JSON if it starts with `{` and ends with `}`; else plain text. Plain stdout **becomes model context only for `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, `PostModelSwitch`**; for other events it goes to the debug log.
- **Exit 2**: blocking error (can't be overridden by JSON). Per event: PreToolUse blocks call (stderr → Claude as denial reason); UserPromptSubmit blocks & erases prompt; Stop/SubagentStop prevent stopping (stderr → Claude); PostToolUse/Failure show stderr to Claude; PostToolBatch stops the loop; PreCompact blocks compaction; SessionStart/SubagentStart/etc. stderr to user only; PermissionRequest ignores exit 2.
- **Other codes (incl. 1) = non-blocking error**; action proceeds. "If your hook is meant to enforce a policy, use `exit 2`." A missing script (127) silently disables the gate.

### 3.7 Output: JSON fields
Universal: `continue` (false = stop entirely; wins over everything), `stopReason`, `suppressOutput` (**no effect**), `systemMessage` (warning **shown to the user**, not the model; arrives as SDKInformationalMessage in stream-json), `terminalSequence`.
**10,000-char cap** per `additionalContext` / `systemMessage` / `initialUserMessage` / plain stdout; overflow → saved to file, Claude gets path + 2,000-char preview and is not asked to read it. Not configurable.

Decision patterns (verbatim table, condensed):
| Events | Pattern | Fields |
|---|---|---|
| UserPromptSubmit, UserPromptExpansion, PostToolUse, PostToolUseFailure, PostToolBatch, Stop, SubagentStop, ConfigChange, PreCompact | top-level `decision` | `decision: "block"`, `reason` (Stop/SubagentStop also `hookSpecificOutput.additionalContext`) |
| PreToolUse | `hookSpecificOutput` | `permissionDecision` allow/deny/ask/defer, `permissionDecisionReason`, `updatedInput`, `additionalContext` |
| PermissionRequest | `hookSpecificOutput` | `decision.behavior` allow/deny (+ `updatedInput`) |
| SessionStart, SubagentStart, PostModelSwitch | context only | `additionalContext`; SessionStart also `initialUserMessage`, `watchPaths`, `sessionTitle`, `reloadSkills` |
| TeammateIdle, TaskCompleted, TaskCreated, PreModelSwitch, PermissionDenied (`retry`), Worktree*, Elicitation*, MessageDisplay (`displayContent`) | various | — |
| Setup, Notification, SessionEnd, PostCompact, InstructionsLoaded, StopFailure, CwdChanged, DirectoryAdded, FileChanged | none | side effects only |

- PreToolUse precedence across hooks: `deny > defer > ask > allow`. `permissionDecisionReason` for deny is shown to Claude; for ask shown to user only. Deprecated top-level `approve`/`block` still mapped.
- PostToolUse: `decision:"block"` adds `reason` next to the tool result (Claude still sees output); `updatedToolOutput` replaces output.
- UserPromptSubmit: `decision:"block"` erases prompt; `reason` shown to user, **not** added to context; cannot rewrite the prompt.
- Stop: `decision:"block"` + required `reason` keeps Claude going; `hookSpecificOutput.additionalContext` = "non-error feedback" (labelled "Stop hook feedback", no error notice). Loop guard: `stop_hook_active` + **8 consecutive continuations cap** (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`, `0` disables).

### 3.8 Which events inject context into the model (the key question)
`additionalContext` is wrapped in a **system reminder** inserted where the hook fired:
- `SessionStart`, `SubagentStart` → "at the start of the conversation, before the first prompt"
- `UserPromptSubmit`, `UserPromptExpansion` → "alongside the submitted prompt" (plain stdout works too; "injected as a system reminder that starts with the hook's name")
- `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch` → next to the tool result
- `Stop`, `SubagentStop` → at the end of the turn; conversation continues
- `PostModelSwitch` → with the next request
- Several hooks' values are all delivered.
Official phrasing advice (important for rule injection): "Write the text as factual statements rather than imperative system instructions… Text framed as out-of-band system commands can trigger Claude's prompt-injection defenses, which causes Claude to surface the text to you instead of treating it as context." And: "For instructions that never change, prefer CLAUDE.md."
Persistence: injected text is saved in the transcript; on `--resume`/`--continue` mid-session hook text is **replayed, not re-run**; SessionStart re-runs with `source: "resume"`/`"fork"`. SessionStart also re-runs with `source: "compact"` after compaction [per matcher list] → a SessionStart hook with no matcher re-injects rules after /compact.

### 3.9 Skill/agent frontmatter hooks, trust, async
- Subagent-frontmatter hooks run only while that subagent runs (`Stop` → converted to `SubagentStop`). **Ignored for plugin subagents** (see §1.2).
- Skill-frontmatter hooks: registered on invocation, persist for the session; `once: true` honoured only here.
- Workspace trust: interactive sessions hold back all settings-file hooks until trust accepted; **`-p`/SDK treats the folder as trusted** (project hooks run). `--settings '{"disableAllHooks": true}'` turns hooks off for a run.
- `async: true` (command only): cannot block/decide; output delivered next turn.
- Debug: `claude --debug`, `/hooks` menu.

### 3.10 Observed working examples [LOCAL, official marketplace plugins]

`explanatory-output-style` (rules injection at session start — the canonical pattern):
```json
{ "hooks": { "SessionStart": [ { "hooks": [ { "type": "command",
  "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks-handlers/session-start.sh\"" } ] } ] } }
```
script prints:
```json
{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "You are in 'explanatory' output style mode, ..." } }
```
`security-guidance` uses SessionStart (timeout 180), UserPromptSubmit, PostToolUse with `matcher: "Edit|Write|MultiEdit|NotebookEdit"`, and PostToolUse `matcher: "Bash"` with per-hook `"if": "Bash(git commit:*)"`, `"asyncRewake": true`, `"rewakeMessage"`, `"rewakeSummary"`; Stop and SubagentStop with `asyncRewake`. `ralph-loop` uses a `Stop` hook to re-feed a prompt (loop). `svipall` uses `PreToolUse` matcher `WebFetch|WebSearch` with `"timeout": 5`.
---

## 4. Memory (CLAUDE.md, rules, auto memory)

Source: https://code.claude.com/docs/en/memory (fetched 2026-09-29).

### 4.1 Locations & load order (broadest → most specific; later = read later)
1. Managed policy: Windows `C:\Program Files\ClaudeCode\CLAUDE.md` (Linux `/etc/claude-code/CLAUDE.md`, macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`).
2. User: `~/.claude/CLAUDE.md` (+ `~/.claude/rules/*.md`, loaded **before** project rules).
3. Project: `./CLAUDE.md` or `./.claude/CLAUDE.md` (+ `.claude/rules/`). `AGENTS.md` is read instead only when no CLAUDE.md/CLAUDE.local.md exists on the path (v2.1.277+), unless "Project instructions" = `claude-md-and-agents-md`.
4. Local: `./CLAUDE.local.md` (appended after CLAUDE.md in the same directory).
- Ancestors of cwd load at launch, ordered filesystem root → cwd. Subdirectory CLAUDE.md files load **on demand** when Claude reads files there. "All discovered files are concatenated into context rather than overriding each other."
- **Delivery:** "CLAUDE.md content is delivered as a user message after the system prompt, not as part of the system prompt itself… there's no guarantee of strict compliance." For system-prompt-level instructions use `--append-system-prompt`.
- Block-level HTML comments `<!-- -->` are stripped before injection (free maintainer notes).
- `--setting-sources` without `project` skips project rules (v2.1.211+). `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` disables all CLAUDE.md incl. auto memory. `claudeMdExcludes` skips specific files.

### 4.2 `@imports`
`@path/to/file` anywhere (not in code spans/fences); relative to the importing file; absolute and `~` allowed; **max depth 4 hops**; spaces escaped `\ `; quoted paths not imported. Imports load at launch (no context saving — "helps organization but doesn't reduce context"). External imports in project files trigger a one-time approval dialog; user-scope files import without dialog. Our global setup uses exactly this (`~/.claude/CLAUDE.md` → `@svipall/SVIPALL.md`).

### 4.3 `.claude/rules/`
- All `.md` recursively; one topic per file. Without `paths` → loaded at launch "with the same priority as `.claude/CLAUDE.md`".
- `paths` frontmatter (YAML list or comma string of globs, brace expansion ok, budget 1,000 expanded patterns) → rule loads **when Claude reads a matching file** ("not on every tool use"). `paths` is the **only** field read; others ignored; bad YAML → treated as no `paths`.
- User rules `~/.claude/rules/` apply to every project; conflicts user vs project → "Claude may follow either one".
- Plugins cannot ship rules or CLAUDE.md [inferred from §1 + no rules component in manifest-reference].

### 4.4 Size guidance (verbatim-ish)
- "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence." Files >4 MiB are skipped. Startup warning for over-length files and for combined size (each CLAUDE.md, rule, and import counted separately).
- "Specificity: write instructions that are concrete enough to verify" ("Use 2-space indentation" vs "Format code properly"). "Consistency: if two rules contradict each other, Claude may pick one arbitrarily."
- `/doctor prompt-audit` (v2.1.283+) audits CLAUDE.md/AGENTS.md/rules/skills/commands/subagents/output styles for "instructions written for older models", dead references, contradictions; proposes edits only.

### 4.5 After `/compact`
"Project-root CLAUDE.md survives compaction: after `/compact`, Claude re-reads it from disk and re-injects it into the session. Nested CLAUDE.md files in subdirectories and rules with `paths:` frontmatter reload as Claude reads files they apply to." Instructions given only in conversation are lost. (Unverified whether user-level `~/.claude/CLAUDE.md` / unscoped rules are also re-injected — page only says "project-root"; see context-window page "What survives compaction", not fetched.) [UNVERIFIED]

### 4.6 Auto memory
On by default; `~/.claude/projects/<project>/memory/MEMORY.md` index + topic files; **first 200 lines or 25 KB of MEMORY.md** loaded each session; topic files read on demand. Types: `user`, `feedback`, `project`, `reference`. Disable: `autoMemoryEnabled: false` or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` (`=0` forces on even in `--bare`). **Not loaded into non-fork subagents.** A/B confound: auto memory accumulates across runs in the same project dir → disable it or use fresh config dirs for A/B arms.

## 5. Subagents

Source: https://code.claude.com/docs/en/sub-agents (fetched 2026-09-29). `/docs/en/agents` not fetched.

### 5.1 Frontmatter (camelCase; unknown field silently ignored; only `name` + `description` required)
| Field | Notes |
|---|---|
| `name` | unique; no `:` (reserved for `plugin:agent`); hooks see it as `agent_type` |
| `description` | "When Claude should delegate"; "use proactively" phrasing encourages delegation. Combined descriptions >15,000 tokens → startup warning |
| `tools` | allowlist (comma string or list); omitted = inherit all subagent tools. Don't list `Skill` to preload — use `skills` |
| `disallowedTools` | denylist; `Bash(git push *)` still removes whole tool |
| `model` | `sonnet/opus/haiku/fable`, full ID (`claude-opus-5-5`), or `inherit`. Resolution: per-invocation param > frontmatter > `CLAUDE_CODE_SUBAGENT_MODEL` > main model. Family alias of main's family → main's exact model (incl. `[1m]`). `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` forces one model |
| `permissionMode` | ignored for plugin subagents |
| `maxTurns` | output marked partial at limit; resumable |
| `skills` | **full content injected at startup** (not just description); can't preload `disable-model-invocation` skills |
| `mcpServers`, `hooks` | ignored for plugin subagents |
| `memory` | `user` (`~/.claude/agent-memory/<name>/`), `project` (`.claude/agent-memory/<name>/`), `local` (`.claude/agent-memory-local/<name>/`); injects first 200 lines/25 KB of its MEMORY.md + auto-enables Read/Write/Edit; no effect if auto memory off |
| `background` | always background |
| `omitClaudeMd` | skip user/project/local CLAUDE.md (managed still loads); ignored when used as main agent (v2.1.271+) |
| `effort` | `low…max`, overrides session effort |
| `isolation` | `worktree` |
| `color`, `initialPrompt` (main-agent only; ignored in plugins), `experimental.cacheTtl` (`5m`/`1h`) | |

### 5.2 What a (non-fork) subagent sees
- System prompt = **its own markdown body + environment details, "not the Claude Code system prompt"**. Task message = Claude's delegation prompt. CLAUDE.md hierarchy (all levels, incl. `~/.claude/CLAUDE.md` + rules) unless Explore/Plan or `omitClaudeMd`. Git status snapshot. Preloaded skills. Sibling roster (if SendMessage).
- **Not inherited:** conversation history, invoked skills, **output style**, main auto memory, hook-injected SessionStart context [inference: SessionStart additionalContext lives in main conversation; subagents get SubagentStart context instead]. Context window sized by the subagent's own model.
- Extended thinking config inherited (v2.1.198+).
- `--append-subagent-system-prompt[-file]` (headless, v2.1.205+) appends to every subagent's system prompt (not forks) — useful A/B lever.
- Forks inherit full history + system prompt + tools + output style + prompt cache.

### 5.3 Limits / env vars
- **Nesting depth:** default 3 layers below main; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (`1` = no nesting). At limit the Agent tool is withheld.
- **Concurrency:** default **20** running subagents → `Concurrent subagent limit reached` (told not to retry); `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (positive int; can't disable). Ultracode sessions exempt. No total-count limit.
- In `-p`/SDK, a launching subagent doesn't wait for nested background subagents.
- Auto-compaction applies to subagents too (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`).
- Plugin agent main-thread lever: plugin `settings.json` `{"agent": "<name>"}` (see §1.2) — the agent body *replaces* the system prompt for the main thread [inference from "not the Claude Code system prompt"; UNVERIFIED whether main-thread `--agent` keeps the Claude Code base prompt — cli-reference only says "Specify an agent for the current session"].

---

## 6. `claude plugin eval` — the A/B harness (VERY DETAILED)

Source: https://code.claude.com/docs/en/plugin-evals (+ `claude plugin eval --help` [LOCAL])

### 6.1 Requirements
- Claude Code **v2.1.269+** (we have 2.1.285). Git **≥ 2.31** if git is installed (older git → refuses, exit 1; the run disables repo git hooks/credential helpers via `GIT_CONFIG_COUNT`). No git → runs normally.
- Plugin dir with `plugin.json` or `.claude-plugin/plugin.json`, or a skills-directory plugin.
- Same auth as normal sessions; every run + every judge call is billed to plan usage / API. Costs shown are list-price estimates.

### 6.2 What a run is
- "For each run of a case, Claude Code starts a fresh, isolated non-interactive session with only your plugin loaded, sends the prompt, and lets Claude work until it finishes or hits the case's turn or time limit. Each grader then checks the final reply, the transcript, or a file Claude created, and passes or fails."
- Isolation: temp HOME, temp cwd, temp Claude config; child is `claude -p`. **Nothing personal/project loads** (user settings, hooks, CLAUDE.md, MCP, other plugins, memory, skills). Env: only an allowlist (PATH, locale, proxy/certs, provider auth, most `ANTHROPIC_*`/`CLAUDE_CODE_*`) + `EVAL_*`. Managed policy still applies. **Artifact tool off.** Eval dir is hidden from the agent. Each run starts in an **empty working directory**.
- Plugin hooks and real MCP servers run **outside** the sandbox → "treat its scores as advisory unless you ran it in an isolated environment".

### 6.3 Scoring
- Default **3 runs per case per arm**. Run score = weighted fraction of graders passed; case score = mean over runs; case passes if score ≥ `--threshold` (**default 1.0**).
- **Two arms by default** (`--ablation with-without`): `WITH` (plugin) and `W/OUT` (no plugin); `Δ = WITH − W/OUT`. Cost ≈ cases × runs × 2 agent runs + 3 judge calls per `llm`/`baseline` grader per run.
- **Graders excluded from score in two-arm mode** (reported as `scored: false`, "plugin-fired indicator"): every `tool_used` with `tool: Skill`; `regex target: mock_calls` / `llm focus: mock_calls` when the mocked servers are the plugin's; any grader with `arm: with-only`. Exceptions: if *all* graders are excluded they're scored normally; `arm: both` forces scoring in both arms (use for "must NOT invoke" with `min: 0, max: 0`); under `--ablation none` nothing is excluded (so absolute scores differ between modes).
- `Δ` never affects exit code.

### 6.4 Suite layout (verbatim)
```
evals/
├── <case>/                        # one directory per case; nest under a non-case directory to group
│   ├── prompt.md                  # frontmatter: case and run fields; body: the prompt
│   ├── case.yaml                  # optional: context.* fields, or the whole case in one file
│   ├── graders/
│   │   └── <name>.md              # one grader per file; frontmatter: type and options; body: rubric
│   ├── mocks/                     # optional: mocks for this case only, same layout as below
│   └── <fixtures, scripts, transcripts referenced by case.yaml>
├── mocks/                         # optional: suite-wide MCP mocks
│   ├── <server>/
│   │   ├── <tool>.md              # one mocked tool; body: the tool result
│   │   ├── _server.md             # optional: one agent that answers several tools
│   │   ├── _tools.json            # optional: saved tools/list response for real descriptions and schemas
│   │   └── fixtures/              # files inserted with {{file:fixtures/...}}
│   └── .replay/<server>/          # adopted agent-mock recordings, answered without a model call
└── results/<timestamp>/           # written by each run; add results/ to .gitignore
    ├── aggregate-result.json
    ├── report.html
    └── mock-recordings/           # agent-mock answers from clean runs, with ADOPT.txt
```
Alternative eval dir: manifest `"experimental": { "evals": "quality/evals" }` or `--eval-dir quality/evals` (relative, no `..`).

### 6.5 `prompt.md` frontmatter (unknown key = error)

| Field | Default | Purpose |
|---|---|---|
| `schema_version` | `"1.1"` (auto) | |
| `name` | dir name | `--case` globs match it |
| `description` | | humans only |
| `tags` | `[]` | `--tag` filter (any match) |
| `plugins` | nearest enclosing plugin | e.g. `["../.."]` if auto-detect fails |
| `runs` | `3` | 1–50 per arm; `--runs` overrides |
| `expected_outcome` | | humans only |
| `model` | child default | `--model` overrides |
| `max_turns` | `10` | up to 200; hitting it = run error |
| `timeout_seconds` | `300` | up to 3600 |
| `allowed_tools` | `[]` | read-only ones granted if listed |
| `append_system_prompt` | | appended to child system prompt |
| `env` | `{}` | keys must match `EVAL_[A-Z0-9_]*` |

Body = the prompt, sent verbatim; `@path` mentions are **not** expanded.

Example (verbatim):
```markdown
---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Write me a commit message for this change: I renamed getUser to fetchUser and updated the three call sites.
```

### 6.6 `case.yaml`
Requires `schema_version: "1.1"` and `name`. Top level: `description, tags, plugins, runs, expected_outcome`; under `execution:`: `model, max_turns, timeout_seconds, allowed_tools, append_system_prompt, env, prompt`. Only-in-yaml: `context.scaffold_script` (bash, runs as you, outside sandbox, **only with `--scaffold`**), `context.history_file` (`.jsonl` transcript to resume; prompt = next user turn), `context.add_dirs` (read-only fixture dirs), `graders` (list; llm rubric in `criteria`). prompt.md frontmatter overrides case.yaml; `graders/*.md` appended after yaml graders.
```yaml
schema_version: "1.1"
name: changelog-from-diff
tags: [smoke]
context:
  scaffold_script: fixture.sh
  add_dirs: [resources]
```

### 6.7 Graders
Common frontmatter: `type` (required), `weight` (default 1), `arm` (`with-only` | `both`). Name = filename.

| Type | Options | Passes when |
|---|---|---|
| `regex` | `pattern`, `flags`, `match`, `target` | JS regex found in target. `match: not_contains` or `"count:N"`. Case-insens via `flags: i` (no `(?i)`) |
| `tool_used` | `tool`, `input_match`, `min` (1), `max` (∞) | count of calls to `tool` whose JSON input matches `input_match` is in range; never-called = `min: 0, max: 0` |
| `tool_order` | `before`, `after` | both called and first `before` precedes first `after` (each a tool name or `{tool, input_match}`) |
| `file_exists` | `path`, `exists` | a file **created during the run** matches glob (scaffold-created or merely edited files don't count) |
| `llm` | `criteria`, `focus` | judge votes PASS in ≥2 of 3 votes; `.md` body = criteria |
| `baseline` | `baseline_file`, `criteria` | judge finds run ≥ reference `.jsonl` transcript |

`target`/`focus` values: `last_message` (default), `trace` (JSON per line; regex sees all, llm judge sees first 12 + last 12 messages; quotes appear as `\"`), `files` (list of created paths, not contents), `{ source: file, path: <path> }` (file contents; images shown to judge; other binaries refused), `mock_calls`.

"There are no custom-code graders." Default judge = small fast model ("haiku" per `--help`); use `--judge-model sonnet` for nuanced rubrics.

Skill-fired grader (verbatim):
```markdown
---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?your-skill-name"'
---
```
LLM rubric template:
```markdown
---
type: llm
---

PASS if <what a correct response contains>.
FAIL if <what a wrong or missing response looks like>.
```
Official stability advice: regex over long outputs/files instead of llm; one grader on the **result** + one on the **process** (`tool_used`/`tool_order`); if Skill fired but Δ negative "suspect the judge before the plugin"; to check a build/test inside a run, have the prompt write the outcome to a file, grade the file, and `tool_used` with `input_match` on the command.

### 6.8 Tools in runs
- Runs never prompt. Default allowed only if listed in `allowed_tools`: `Read, Glob, Grep, NotebookRead, Skill, AskUserQuestion, Agent, TodoWrite, TaskCreate, TaskGet, TaskList, TaskUpdate, TaskStop`. Everything else (`Bash`, `Write`, `Edit`, `WebFetch`, `WebSearch`, MCP) is **removed** unless `--allow-tools` (applies to all cases): `claude plugin eval . --allow-tools Write Edit "Bash(npm test *)"`.
- Granting Bash/PowerShell → OS sandbox (writes confined to workspace, home unreadable, network only via `WebFetch(domain:…)` grants). **No sandbox backend → each run refused (score ~0). "Native Windows has no backend, so run shell-granting suites under WSL2"**; Linux needs `bubblewrap` + `socat`.
- A case's `allowed_tools` and a skill's `allowed-tools` **cannot widen** the grant.
- MCP: mocks under `evals/mocks/<server>/<tool>.md` (substitutions `{{input.x}}`, `{{file:fixtures/…}}`, `expect:` guard aborts with score 0, `error: true`, `type: agent`). Real servers only with `--allow-real-servers` or `--mocks off` + `--allow-tools "mcp__plugin_<p>_<s>__*"`.

### 6.9 CLI options (docs + `--help`)
`--runs <n>`, `-j/--concurrency <1-8>` (default 1), `--model`, `--judge-model` (default haiku), `--ablation none|with-without`, `--threshold <0..1>` (default 1.0), `--max-cost-usd`, `--allow-tools`, `--scaffold`/`--no-scaffold`, `--trust-plugin`, `--mocks record|off`, `--allow-real-servers`, `--json [path]` (quiet), `--output-dir`, `--report <path>`, `--no-publish`, `--publish-report`, `--keep-temp`, `--case <glob>`, `--tag <tag...>`, `--eval-dir`, `--verbose`. **Put the target before `--tag`, `--allow-tools`, `--json`.**
Targets: `.` (plugin root), a single `prompt.md`/`case.yaml`, installed `name`/`name@marketplace`, `name@skills-dir`.
`claude plugin eval init` = interactive interview that proposes cases/graders, trial-runs them, writes files. `claude plugin eval init --bare <name>` = blank template (CI-safe).

Cheap iteration: `claude plugin eval . --case <case-name> --runs 1 --ablation none` (table shows `SCORE`, `PASS%`).

CI recipe (verbatim):
```
claude plugin eval . \
  --trust-plugin \
  --json results.json \
  --threshold 0.8 \
  --model claude-sonnet-5 \
  --judge-model claude-haiku-4-5 \
  --no-publish \
  --max-cost-usd 20
```
Exit codes: 0 all ≥ threshold; 1 below threshold / load failure / no cases / untrusted without `--trust-plugin` / invalid option; 2 partial (cost ceiling or auth); 130 interrupted; 143 terminated.

### 6.10 Outputs
- Summary table: `CASE  WITH  W/OUT  Δ  RUNS  COST  NOTES` then `N case(s) · mean Δ … · time · $`, `Report:` path, and `Published:` claude.ai artifact URL (subscription accounts; not API-key; runs started from inside a Claude session stay local unless `--publish-report`).
- `report.html`: self-contained; verdict line ("Plugin effect: +33.3 pts vs baseline, improved 2, flat 1, regressed 0 of 3 cases"), tiles (suite score, ablation Δ, baseline score, cases passing, perfect runs), per-case cards (red edge when Δ<0), per-run grader chips with judge votes & evidence.
- `aggregate-result.json` (`schemaVersion: 1`, camelCase, additive): `partial`, `partialReason` (`cost_ceiling`|`interrupted`|`auth_failed`), `aggregates.overallScore`, `aggregates.casesPassed/casesTotal`, `aggregates.meanDelta`, `cases[].name`, `cases[].aggregates.score`, `cases[].aggregates.delta`, `cases[].arms.with[].error`, `.aborted`, `.skippedPaidGraders`, `cases[].arms.without`, `costUsd`, `durationSeconds`, `claudeVersion`.

### 6.11 Troubleshooting highlights
- Δ≈0 with `tool_used: Skill` failing → the skill description doesn't trigger on natural phrasing (most common first finding).
- "Agent type '<plugin>:<agent>' not found" in the baseline arm is expected.
- Usage/rate-limit mid-suite → later runs score 0 but suite is **not** marked partial → check `NOTES`/`error`.
- Default limits (10 turns / 300 s) are tight for real coding tasks → raise per case.
- skill-creator plugin has its own `evals/evals.json` format; "neither tool reads the other's case files".

---

## 7. Headless / A/B flags

Sources: https://code.claude.com/docs/en/headless , /cli-reference (fetched 2026-09-29) + local `--help`.

### 7.1 Confirmed from official docs
| Flag | Official semantics (condensed) |
|---|---|
| `-p, --print` | non-interactive; "The run still creates a resumable session unless you pass `--no-session-persistence`". Without `--bare`, loads the same context as interactive (CLAUDE.md, `~/.claude`, project hooks/MCP) **and treats the folder as trusted**. |
| `--output-format text\|json\|stream-json` | `json` → one object with `result`, session id, usage/cost metadata; with `--json-schema` → `structured_output`. `stream-json` (docs pair it with `--verbose`) → NDJSON starting with `system/init` (model, tools, MCP servers, `plugins[]`, `plugin_errors[]`, `mcp_server_errors[]`). `--include-hook-events` adds hook lifecycle events (SessionStart/Setup always included). |
| `--plugin-dir <path>` | repeatable; dir, `.zip`, or folder of plugins. Env alt `CLAUDE_CODE_PLUGIN_DIRS` (`;` separator on Windows, absolute paths). Check `plugin_errors` in `system/init` to fail CI on load errors. |
| `--settings <file-or-json>` | overrides same keys for the session (≤2 MiB file). E.g. `'{"disableAllHooks": true}'`. |
| `--setting-sources user,project,local` | which settings files load; excluding `project` also skips project rules. |
| `--bare` | skips auto-discovery of hooks, skills, commands, subagents, installed plugins, MCP, auto memory, CLAUDE.md; only Bash/read/edit tools; **auth only via `ANTHROPIC_API_KEY` or `apiKeyHelper`** (no OAuth/keychain → won't work on a subscription login); load context explicitly via `--append-system-prompt[-file]`, `--settings`, `--mcp-config`, `--agents`, `--plugin-dir`. "recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release." Sets `CLAUDE_CODE_SIMPLE=1` (minimal system prompt!). |
| `--safe-mode` | disables all customizations but keeps normal auth, model, built-in tools, permissions (alternative to `--bare` for subscription users; unverified whether `--plugin-dir` still loads under it [UNVERIFIED]). |
| `--model` | alias or full ID; overrides `model` setting and `ANTHROPIC_MODEL`. |
| `--effort` | `low\|medium\|high\|xhigh\|max\|ultracode`; `CLAUDE_CODE_EFFORT_LEVEL` env **beats** `--effort`. |
| `--max-turns N` | **confirmed** in cli-reference: "Limit the number of agentic turns (print mode only). Exits with an error when the limit is reached. No limit by default." (absent from `--help` output). |
| `--max-budget-usd` | print only; subagent spend counts. |
| `--permission-mode` | `default\|acceptEdits\|plan\|auto\|dontAsk\|bypassPermissions\|manual`. `--permission-prompts none` (v2.1.259+) denies anything that would prompt and removes AskUserQuestion. |
| `--allowedTools` / `--tools` / `--disallowedTools` | pre-approve / restrict built-in set (`--tools ""` none, `"default"`). |
| `--append-system-prompt[-file]` | appends to default system prompt (keeps Claude Code's coding guidance). `--system-prompt[-file]` replaces it. `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` line splits cached/dynamic parts (v2.1.275+). System prompt is **recorded on the first request**; on `--resume` new flag text applies only after compaction unless `--system-prompt-snapshot off`. |
| `--append-subagent-system-prompt[-file]` | headless only; appended to every non-fork subagent. |
| `--no-session-persistence` | print only; not saved/resumable. `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` same in any mode. |
| `--agent <name>` / `--agents <json\|file>` | main-thread agent (overrides `agent` setting) / define subagents inline. |
| `--exclude-dynamic-system-prompt-sections` | moves per-user bits to first user message for cache reuse. |

### 7.2 Recommended A/B skeleton [design proposal, not official]
```
# arm A (baseline) vs arm B (plugin), same model/effort, isolated config
CLAUDE_CONFIG_DIR=<tmp-A> CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 \
claude -p "<task>" --model claude-opus-5-5 --effort medium \
  --output-format stream-json --verbose --include-hook-events \
  --no-session-persistence --max-turns 30 --permission-mode acceptEdits \
  [--plugin-dir ./my-plugin]            # arm B only
```
Notes: `CLAUDE_CONFIG_DIR` isolation needs re-auth per dir [UNVERIFIED for subscription OAuth]; alternatively keep user config and pass `--setting-sources project,local` + `--settings` to neutralize user hooks. Pin effort explicitly (Opus 5.5 default `medium`; user-saved levels leak otherwise).

From local `claude --help` (2.1.285) [LOCAL]:
- `-p, --print`; `--output-format text|json|stream-json`; `--input-format text|stream-json`; `--include-hook-events` (stream-json); `--include-partial-messages`; `--forward-subagent-text`; `--json-schema <schema>`; `--max-budget-usd <amount>` (print only); `--no-session-persistence`; `--session-id <uuid>`.
- `--model <alias|id>`, `--fallback-model`, `--effort low|medium|high|xhigh|max`, `--agent <agent>` ("Overrides the 'agent' setting"), `--agents <json-or-file>`.
- `--plugin-dir`, `--plugin-url`, `--settings <file-or-json>`, `--setting-sources user,project,local`, `--mcp-config`, `--strict-mcp-config`, `--add-dir`.
- `--system-prompt`, `--append-system-prompt` (and `-file` variants per changelog), `--system-prompt-snapshot on|off`, `--exclude-dynamic-system-prompt-sections`.
- `--permission-mode acceptEdits|auto|bypassPermissions|manual|dontAsk|plan`, `--permission-prompts host|none`, `--allowedTools`, `--disallowedTools`, `--tools`, `--dangerously-skip-permissions`.
- `--bare`: "Minimal mode: skip hooks (those defined in settings and by installed plugins; features built into Claude Code are unaffected), LSP, plugin sync, attribution, auto-memory, background prefetches, keychain reads, and CLAUDE.md auto-discovery. Sets CLAUDE_CODE_SIMPLE=1. Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings (OAuth and keychain are never read)… Explicitly provide context via: --system-prompt[-file], --append-system-prompt[-file], --add-dir (CLAUDE.md dirs), --mcp-config, --settings, --agents, --plugin-dir."
- `--safe-mode`: "Start with all customizations (CLAUDE.md, skills, installed plugins, hooks, MCP servers, custom commands and agents, output styles, workflows, custom themes, keybindings, and more) disabled… Sets CLAUDE_CODE_SAFE_MODE=1."
- `--restricted`: removes code-running tools and WebFetch unless `--tools` names them; ignores user/project/local settings files.
- `--disable-slash-commands` ("Disable all skills").
- **`--max-turns` is NOT listed in `--help` 2.1.285**, but the changelog references it ("ignoring `--max-turns`", ~2.1.281) → exists as a (hidden?) flag. **Resolved:** documented in cli-reference (print mode only; see §7.1).

## 8. Official workflow advice

Source: https://code.claude.com/docs/en/best-practices (fetched 2026-09-29). common-workflows / context-window / goal / advisor pages **not fetched** (tool budget) [gap].

- **Core constraint:** "Most best practices are based on one constraint: Claude's context window fills up fast, and performance degrades as it fills."
- **Verification first** ("Give Claude a way to verify its work"): "Claude stops when the work looks done. Without a check it can run, 'looks done' is the only signal available, and you become the verification loop." Gate strengths: in-prompt → `/goal` condition (separate evaluator re-checks after every turn) → **Stop hook** as deterministic gate → second-opinion verification subagent. "Have Claude show evidence rather than asserting success: the test output, the command it ran and what it returned, or a screenshot."
- **Explore → Plan → Implement → Commit**: plan mode (`Shift+Tab` / `--permission-mode plan`) to read and plan; `Ctrl+G` to edit plan; implement "verifying against its plan"; commit + PR. "Plan mode is useful, but also adds overhead… If you could describe the diff in one sentence, skip the plan."
- **Specific prompts:** scope the task, point to sources, reference existing patterns, describe the symptom + what "fixed" looks like; "write a failing test that reproduces the issue, then fix it"; "address the root cause, don't suppress the error".
- **CLAUDE.md:** "For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" Include/exclude table (include non-guessable commands, non-default style, test runners, repo etiquette, gotchas; exclude what code reveals, standard conventions, long tutorials, "write clean code"). "If Claude keeps skipping one instruction, add emphasis such as 'IMPORTANT' to that line alone. If you emphasize many lines, none of them stands out." "If Claude already does something correctly without the instruction, delete it or convert it to a hook."
- **Hooks vs CLAUDE.md:** "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens."
- **Interview → spec → fresh session**: use AskUserQuestion to interview, write SPEC.md, execute in a new session; good specs name files/interfaces, out-of-scope, end-to-end verification step.
- **Course correction:** `Esc` stop; `Esc Esc`/`/rewind`; "If you've corrected Claude more than twice on the same issue in one session, the context is cluttered with failed approaches. Run `/clear` and start fresh." "A clean session with a better prompt almost always outperforms a long session with accumulated corrections."
- **Context management:** `/clear` between unrelated tasks; `/compact <instructions>`; partial summarize via rewind; CLAUDE.md compaction instructions ("When compacting, always preserve the full list of modified files and any test commands"); `/btw` for side questions; **subagents for investigation** ("use subagents to investigate X").
- **Adversarial review:** subagent reviews diff vs plan in fresh context; caution: "A reviewer prompted to find gaps will usually report some, even when the work is sound… Chasing every finding leads to over-engineering: extra abstraction layers, defensive code, and tests for cases that can't happen. Tell the reviewer to flag only gaps that affect correctness or the stated requirements."
- **Failure patterns:** kitchen-sink session; correcting over and over; over-specified CLAUDE.md; trust-then-verify gap ("plausible-looking implementation that doesn't handle edge cases"); infinite exploration.
- **Stated model tendencies (model-config page):** "In tests on Opus 5.5 and Fable 5.1, Claude at a higher level tested more edge cases and verified more of its work before answering. It also made more choices on its own. At a lower level, Claude returned a starting point sooner." "Opus 5.5 at `medium` matches or exceeds Opus 5 at `high`… At a given level, Opus 5.5 tends to think more per turn than Opus 5." → effort is itself a behavior knob; a plugin's rules must be A/B'd at a fixed effort.
- Auto mode is the built-in starting permission mode for interactive sessions from v2.1.283.

## 9. Output styles, settings, env vars, model config

Sources: /output-styles, /settings, /env-vars, /model-config (fetched 2026-09-29).

### 9.1 Output styles
- Built-ins: Default (no style), **Proactive** (start work, assume routine decisions, no plan mode unless asked; still check before destructive/shared actions), **Concise** (lead with the result, no preamble/narration/recap; full length for requested detail and safety info; v2.1.237+), **Explanatory** (`★ Insight` blocks), **Learning** (`TODO(human)`). "Each of the four other built-in styles keeps [Default's] instructions and adds its own."
- Custom style file: `~/.claude/output-styles/`, `.claude/output-styles/`, managed, or **plugin `output-styles/`**. Frontmatter (hyphenated, unknown ignored): `name`, `description`, **`keep-coding-instructions`** ("Set to `true` to keep Claude Code's built-in software engineering instructions alongside your style. Default: `false`" — i.e. a custom style **drops** scoping/comment/verification guidance unless set), **`force-for-plugin`** ("Plugin output styles only… apply this style automatically whenever the plugin is enabled, without requiring users to select it. Overrides the user's `outputStyle` setting. If multiple enabled plugins set this, Claude Code uses the first one loaded.").
- Mechanics: "Claude Code sends the active style's instructions with every request" (system-prompt level, unlike CLAUDE.md which is a user message). Applies to main conversation + forks, **not** to other subagents. Switch mid-session applies from next message (v2.1.251+). `outputStyle` setting is case-sensitive (`explanatory` → Default). Style files read at startup (restart after editing).
- **Design implication:** `force-for-plugin: true` + `keep-coding-instructions: true` is a zero-click, system-prompt-level always-on channel for our plugin — correction to §0 item 1 ("user must select it" is wrong for plugin styles with `force-for-plugin`). It's also a clean A/B variable.

### 9.2 Settings precedence
Managed > command line (`--settings`, flags) > local (`.claude/settings.local.json`) > project (`.claude/settings.json`) > user (`~/.claude/settings.json`) > plugin defaults (§1.2). Array settings (e.g. permissions) merge across scopes rather than override. Relevant keys: `outputStyle`, `agent`, `disableAllHooks`, `includeGitInstructions` (turn off built-in commit/PR guidance when rules conflict), `attribution`, `autoMemoryEnabled`, `autoMemoryDirectory`, `claudeMdExcludes`, `skillOverrides`, `skillListingBudgetFraction`, `skillListingMaxDescChars`, `effortLevel`/`modelSettings`, `autoCompactWindow`, `env`.

### 9.3 Model config (Opus 5.5)
- `opus` alias → Opus 5.5 on Anthropic API/Bedrock/Vertex; `default` model = Opus 5.5 on Pro/Max/Team/Enterprise/API. 1M native context; compacts at ~967K by default (auto-compact window configurable 100K–1M: `/autocompact`, `--autocompact`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`).
- **Effort:** levels `low/medium/high/xhigh/max` (+ `ultracode` toggle). Resolution: explicit (`CLAUDE_CODE_EFFORT_LEVEL` env > `--effort` > `/effort`) → settings (per-model saved level / `effortLevel`) → model default. **Opus 5.5 & Sonnet 5.5 default `medium`**; others `high`; Opus 4.7 `xhigh`. Legacy top-level `effortLevel` does **not** apply to Opus 5.5.
- `ultrathink` keyword in a prompt adds an in-context instruction for deeper reasoning that turn (API effort unchanged); "think hard" etc. are plain text.
- **Thinking can't be turned off on Opus 5.5** (adaptive; `MAX_THINKING_TOKENS=0` ignored).
- Safety-classifier fallback: Opus 5.5 cyber-flagged requests re-run on Opus 4.8, bio on Opus 5 (A/B confound for security-themed tasks).

### 9.4 Env vars relevant to the plugin / A/B
`CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_CODE_SUBAGENT_MODEL` (+`_FORCE`), `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (20), `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (3), `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (8; 0 = off), `CLAUDE_CODE_ENABLE_TODO_TOOLS`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY`, `CLAUDE_CODE_DISABLE_CLAUDE_MDS`, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`, `CLAUDE_CODE_SIMPLE`, `CLAUDE_CODE_SKIP_PROMPT_HISTORY`, `CLAUDE_CODE_PLUGIN_DIRS`, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (can only lower), `SLASH_COMMAND_TOOL_CHAR_BUDGET`, `BASH_DEFAULT_TIMEOUT_MS` (120000), `MAX_THINKING_TOKENS`, `DISABLE_TELEMETRY`.

---

## 10. Measure & relevance (cost/usage + suggestions)

Source: https://code.claude.com/docs/en/plugins/measure , /plugins/relevance
- "Every session where a plugin is enabled includes the names and descriptions of its skills, agents, and commands in Claude's context… whether or not the plugin gets used."
- `claude plugin details <name>` → Component inventory, **Always-on** tokens (names + `description` + `when_to_use` of skills/agents/commands), per-component always-on vs on-invoke. Hooks: "(harness-only — no model context cost)" — but note: hook `additionalContext` output *does* enter context at runtime; `details` just doesn't count it. MCP tool schemas not counted (use `/context`).
- Official marketplace highlights "Every turn" cost ≥ 2,000 tokens.
- To lower always-on: shorten descriptions, split plugin; then re-check triggering with a `tool_used: Skill` grader.
- Usage signals: `/plugin` "Not used recently" (≥14 days and 10 sessions; never for `--plugin-dir`, skills-dir, or plugins with output style/theme/monitor/workflow), `/skill-doctor` (never-invoked skills, cost), `/doctor`, `/usage`. Fleet: OTel `claude_code.plugin_loaded`, `skill_activated`, `hook_plugin_metrics` (official marketplace only); names redacted as `third-party` unless `OTEL_LOG_TOOL_DETAILS=1`.
- Relevance (`marketplace.json` entry `relevance: {topic, signals: {cwd, cli, hosts, filesRead, manifestDeps}}`) only drives **install suggestions** for org marketplaces allowlisted via managed `pluginSuggestionMarketplaces`. Not relevant to model behavior; skip for our design.

---

## 11. Changelog (≈2.1.236 → 2.1.285) — behavior/model-relevant items

Source: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md (versions are undated in the file; ordering only).

Models
- **2.1.280: "Added Claude Opus 5.5 (`claude-opus-5-5`), now the default Opus model — 1M context, $4/$20 per Mtok with $0.20/Mtok cache reads".**
- 2.1.280: "Changed the default model on Pro and Team Standard plans from Sonnet to Opus".
- 2.1.280: "Changed an effort level saved before `/effort` became per-model to no longer apply to newly released models such as Opus 5.5; they start at their default until you pick a level".
- 2.1.284: Added Claude Sonnet 5.5 (`claude-sonnet-5-5`), default Sonnet on the Anthropic API.
- Earlier: Fable 5.1 (`claude-fable-5-1`) default Fable; Opus 5; Sonnet 5 (1M native).
- Todo/task tools: "Todo/task-tracking tools (TaskCreate/Get/Update/List, TodoWrite) are no longer available on Opus 4.8, Sonnet 5, Fable 5, Mythos 5, and newer models; set `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` to bring them back" (later restated: offered only on Claude 3.x, Opus 4.0–4.7, Sonnet 4.0–4.6, Haiku 4.5).
- Auto-compact: "Opus and Fable sessions now compact shortly before the 1M-token limit".
- 2.1.284: `/effort` Ultracode is its own toggle, "no longer forces xhigh effort".

Prompting / instructions
- **2.1.284: "Added `/doctor prompt-audit` (also `/checkup prompt-audit`) to audit your CLAUDE.md files, skills, agents and commands for prompting patterns written for older models".**
- 2.1.278: "Added AGENTS.md support: in a project with no CLAUDE.md, Claude Code reads AGENTS.md instead".
- 2.1.281: "Improved the large CLAUDE.md startup notice to also count instruction files together, so many mid-sized files and @-imports are caught".
- 2.1.273-ish: "Added `omitClaudeMd` to agent frontmatter and `--agents` JSON, letting custom and plugin subagents run without user, project and local CLAUDE.md files".
- "Fixed the attribution reminder overriding a CLAUDE.md or memory rule against commit and pull request attribution".
- "Fixed CLAUDE.md and rules files from an `--add-dir` directory inside the working directory being sent to the model twice in headless and SDK sessions" (2.1.281).
- "Fixed `effort:` frontmatter on custom commands, skills, and subagents being ignored on models whose default effort is still pinned"; "Fixed frontmatter `model:` on custom commands and skills being ignored in interactive sessions".

Plugins / skills / hooks
- 2.1.269: "Added `claude plugin eval`"; "Added `/output-style [name]` to list and switch output styles, including… headless sessions".
- 2.1.283: `claude plugin eval` requires git ≥ 2.31.
- 2.1.261: "Added `/skill-doctor` to show which loaded skills go unused and what they cost in context".
- 2.1.281: validator warns when shell-form hook leaves `${CLAUDE_PLUGIN_ROOT}` unquoted.
- 2.1.280: "Changed `PermissionRequest` hooks: an agent-type hook no longer runs there".
- 2.1.278: "Fixed sessions continued after `/clear`… missing part of their first message when a SessionStart hook printed output, causing a full prompt-cache miss".
- "Fixed `SubagentStop` hooks with a specific `matcher` firing for every stopping subagent whose agent type was empty".
- "Fixed Stop prompt hooks re-sending their whole prompt on every block… repeat blocks now name the condition with a 500-character label".
- "Fixed hook-driven sessions (such as an active `/goal`) ending with 'Prompt is too long' instead of compacting".
- "Fixed agent teammates and resumed subagents moving SubagentStart hook context and preloaded skills out of the prompt prefix on later turns, which broke prompt-cache reuse" → SubagentStart context + subagent `skills` preload are part of the prompt prefix (cache-relevant).
- "Changed auto mode so that a skill's or slash command's inline `!` shell commands follow default-mode permission rules instead of the classifier".
- "Fixed PermissionRequest hooks not firing in `--print` mode".

---

## 12. Gotchas (draft — extended below as sections are filled)

1. **Plugin-root CLAUDE.md is ignored.** Use SessionStart/UserPromptSubmit `additionalContext`, skills, or the `agent` setting.
2. **The `agent` setting is overridable** by the user's own `agent` in `~/.claude/settings.json`, by `--agent`, and by another plugin loaded later. In A/B, make sure neither arm has a user-level `agent`.
3. **Windows + evals:** any Bash/PowerShell grant → runs refused (no sandbox backend). Use WSL2 for shell cases, or design cases that need only Read/Write/Edit + graders on files.
4. **Todo tools absent on Opus 5.5** (and Sonnet 5+, Fable 5+). Don't design skills/rules around TodoWrite; eval `allowed_tools` listing TodoWrite silently gets nothing on those models. [inference from changelog]
5. **Monitors never run in `-p`** → invisible to `claude plugin eval` and headless A/B.
6. **Eval scores are advisory with plugin hooks** (hooks run outside the sandbox). Default judge is Haiku → use `--judge-model sonnet` for nuanced rubrics. `tool_used: Skill` never counts toward Δ in two-arm mode.
7. **Default `--threshold` is 1.0** → exit 1 on any imperfect case; set explicitly.
8. **Rate limits don't mark partial** → failed runs score 0 and look like regressions.
9. `file_exists` sees only files **created** during the run; `files` target = paths not contents.
10. `@path` in eval prompts is not expanded; each run starts with an **empty cwd** → seed with `scaffold_script` + `--scaffold` (bash; on native Windows this needs bash available — [UNVERIFIED] whether scaffold runs under Git Bash).
11. Eval isolation drops the user's CLAUDE.md/hooks/plugins → evals measure the plugin **in a vacuum**, not on top of the user's real setup (svipall hooks, global CLAUDE.md). A manual headless A/B is needed to measure "on top of my setup".
12. `--plugin-dir` silently overrides an installed plugin of the same name.
13. Unknown key inside a strict object (`userConfig` option, `lspServers`, `monitors`, `channels`) → whole plugin fails to load.
14. Hooks from a plugin + identical hooks in settings run twice (no dedupe across sources).
15. `${CLAUDE_PLUGIN_ROOT}` is not in the Bash tool's env — write it literally in SKILL.md bodies (substituted at load).
16. Changing plugin `defaultEnabled` in a new release doesn't flip existing users.
17. **Hook-injected rules must read as facts, not commands.** Imperative "system instruction"-style `additionalContext` can trip prompt-injection defenses and be surfaced to the user instead of followed (hooks doc). Phrase rules as project facts/conventions.
18. **Plain stdout reaches the model only on SessionStart, UserPromptSubmit, UserPromptExpansion, PostModelSwitch.** Elsewhere use JSON `hookSpecificOutput.additionalContext`. `systemMessage` goes to the **user**, not the model. `suppressOutput` does nothing.
19. **10,000-char cap** on each `additionalContext`/stdout; overflow becomes a file path + 2,000-char preview Claude isn't told to read → keep injected rules well under 10k chars.
20. **Exit 1 doesn't block.** Only exit 2 (or JSON decision) blocks; a missing script (127) silently disables a gate. A timed-out PreToolUse hook does not block.
21. **UserPromptSubmit default timeout is 30 s** (not 600) — keep per-prompt hooks fast; SessionStart supports only `command`/`mcp_tool` types (no `prompt`/`agent`).
22. **Matchers on events without matcher support are silently ignored** (UserPromptSubmit, Stop, PostToolBatch…); handler `if` on a non-tool event makes the hook **never run**.
23. **Stop-hook loops are capped at 8 consecutive continuations** (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`). Check `stop_hook_active`.
24. **Plugin subagents ignore `hooks`, `mcpServers`, `permissionMode`, `initialPrompt`** — a plugin can't scope hooks to its own agent via frontmatter; use plugin-level hooks with `agent_type`/`agent_id` checks instead.
25. **Subagents don't get the output style, main auto memory, or conversation history**; they do get CLAUDE.md (unless Explore/Plan/`omitClaudeMd`) — but a plugin can't ship CLAUDE.md, so plugin rules reach subagents only via SubagentStart `additionalContext`, preloaded `skills`, or the agent body.
26. **Skill descriptions: 1,536-char cap** (description + when_to_use) and a listing budget of 1% of context; unknown frontmatter fields and malformed YAML fail silently (skill loads with no metadata → never auto-triggers). Run `claude plugin validate`.
27. **`allowed-tools` is a one-turn grant, not a restriction**; `disable-model-invocation: true` removes the description from context entirely (Claude can't know the skill exists).
28. **Skill content after compaction:** only the first 5,000 tokens of each, 25,000 total, most-recent first. Long or many skills get truncated/dropped; SessionStart hooks re-fire with `source: "compact"` and can re-inject rules.
29. **CLAUDE.md is a user message, output style is system-prompt-level.** Custom styles drop Claude Code's coding instructions unless `keep-coding-instructions: true`. Plugin styles with `force-for-plugin: true` apply without user selection and override the user's `outputStyle` (first-loaded plugin wins) — corrects §0 item 1.
30. **Effort confound:** Opus 5.5 defaults to `medium`; `CLAUDE_CODE_EFFORT_LEVEL` beats `--effort`; per-model saved levels leak into runs. Pin effort explicitly in every A/B arm.
31. **`--bare` needs `ANTHROPIC_API_KEY`** (no OAuth/keychain) and sets a minimal system prompt (`CLAUDE_CODE_SIMPLE`) → a `--bare` baseline is not "stock Claude Code". For subscription-auth A/B use normal `-p` with controlled `--setting-sources`/`--settings`/`CLAUDE_CONFIG_DIR`.
32. **`-p` treats the folder as trusted** → project `.claude/settings.json` hooks and skill `allowed-tools` apply unattended.
33. **System prompt is snapshotted on the first request**; `--append-system-prompt` changes on `--resume` apply only after compaction unless `--system-prompt-snapshot off`.
34. **Auto memory persists across A/B runs** in the same project dir → set `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` or separate config dirs.
35. Opus 5.5 safety-classifier fallback silently reruns cyber/bio-flagged requests on Opus 4.8 / Opus 5 → avoid security-themed eval tasks or check the transcript model.
