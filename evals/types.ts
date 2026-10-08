// Shapes shared by the runner (run.ts), the report (report.ts) and the graders (cases/*/grade.ts).
import type { SpawnSyncReturns } from 'node:child_process';

export interface Turn {
  prompt: string;
  basePrompt?: string;
}

// case.json
export interface CaseMeta extends Turn {
  turns?: Turn[];
  language?: string;
  setup?: string;
  effort?: string;
  allowedTools?: string;
  maxTurns?: number;
  timeoutSec?: number;
}

// The lines of a `claude -p --output-format stream-json` transcript the runner reads.
export interface StreamEvent {
  type?: string;
  subtype?: string;
  hook_name?: string;
  output?: string;
  parent_tool_use_id?: string | null;
  message?: { content?: { type?: string; name?: string; input?: unknown }[] };
  permission_denials?: unknown[];
  is_error?: boolean;
  result?: string;
  total_cost_usd?: number;
  num_turns?: number;
  usage?: { output_tokens?: number };
}

export interface ParsedRun {
  tools: { name: string; input: unknown; sub: boolean }[];
  denials: unknown[];
  hooks: { name: string; output: string | undefined }[];
  result: StreamEvent | null;
  init: StreamEvent | null;
}

export interface Grade {
  pass: boolean | null;
  notes: string;
  metric?: number;
}

export interface GradeContext {
  dir: string;
  run: ParsedRun;
  final: string;
  diff: string;
  sh: (cmd: string) => SpawnSyncReturns<string>;
  arm: string;
}

export type Grader = (context: GradeContext) => Grade | Promise<Grade>;

// One recorded run: <tag>/<case>/<arm>-<i>.json
export interface RunRecord extends Grade {
  case: string;
  arm: string;
  i: number;
  dir: string;
  invalid: string | null;
  cost: number | null;
  turns: number | null;
  outTokens: number | null;
  secs: number;
  tools: string;
  denials: number;
}
