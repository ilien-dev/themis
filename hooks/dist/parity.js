// Parity between CLAUDE.md and AGENTS.md in the same directory.
// PostToolUse on Edit/Write/MultiEdit: copy the edited file over its twin (pre-tool.ts only lets
// the edit through when the two matched before it, or the user approved replacing both).
// SessionStart, and PostToolUse on a shell command that names a rule file: report pairs that differ.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { run, emit, RULE_FILE, SHELL_RULE_FILE, twinOf, pairState, parityProblems, parityNotice } from "./lib.js";
await run((input) => {
    const event = input.hook_event_name;
    const ti = input.tool_input;
    const cwd = input.cwd;
    const say = (additionalContext) => { emit({ hookSpecificOutput: { hookEventName: event, additionalContext } }); };
    if (event === 'PostToolUse' && ti.file_path) {
        if (!RULE_FILE.test(basename(ti.file_path)))
            return;
        const file = resolve(cwd, ti.file_path);
        const twin = twinOf(file);
        if (!twin || !existsSync(file) || !['differ', 'missing'].includes(pairState(file, twin)))
            return;
        writeFileSync(twin, readFileSync(file));
        say(`themis copied ${basename(file)} to ${basename(twin)} in the same directory, so the two are identical. Do not edit ${basename(twin)} separately.`);
        return;
    }
    if (event === 'PostToolUse' && !SHELL_RULE_FILE.test(ti.command))
        return;
    if (event !== 'PostToolUse' && event !== 'SessionStart')
        return;
    const problems = parityProblems(cwd);
    if (problems.length)
        say(parityNotice(problems));
});
