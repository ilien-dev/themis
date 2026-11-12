// No check gives `fix` any more (see RETIRED_CODES); rules accepted under it still load.
export type VerdictKind = 'keep' | 'cut' | 'move' | 'rewrite' | 'fix' | 'conflict';
export type Note = 'no-evidence' | 'no-anchor' | 'absolute-no-reason' | 'unresolved-reference' | 'accepted';
export type RuleKind = 'heading' | 'item' | 'paragraph' | 'steps' | 'code';

// Every reason code, by question.
export const REASON_CODES = [
  'inferable-title', 'inferable-tree', 'inferable-script', 'inferable-tech', 'inferable-overview', 'inferable-path', 'inferable-stack', 'stale-version', // 1
  'enforced-config', 'config-conflict', 'enforced-deny', // 2
  'vendor-declared', 'file-filler', 'generic-advice', // 3
  'absolute-command', // 5
  'duplicated-passage', 'long-procedure', // 6
  'dead-reference', 'emphasis', // 7
] as const;

// Codes no check gives any more. They stay in REASON_CODES so the rules a user accepted under them still load.
// dead-reference: an unresolved reference is now the unresolved-reference note on a kept rule.
export const RETIRED_CODES: ReadonlySet<string> = new Set(['dead-reference']);

export interface Rule {
  readonly text: string;
  readonly kind: RuleKind;
  readonly line: number; // 1-based
  readonly lines: number;
}

export interface Answer {
  readonly verdict: Exclude<VerdictKind, 'keep'>;
  readonly code: string; // one of the reason codes
  readonly question: 1 | 2 | 3 | 5 | 6 | 7;
  readonly evidence: string; // e.g. "package.json: dependencies.express"
  readonly target?: string; // suggested destination on a move
}

export interface Verdict {
  readonly rule: Rule;
  readonly verdict: VerdictKind;
  readonly code: string | null;
  readonly question: number | null;
  readonly evidence: string; // on a kept rule, what the unresolved-reference note found
  readonly target?: string; // where a move should go, copied from the answer
  readonly notes: readonly Note[];
  readonly original?: Answer; // present with the accepted note
}
