export type VerdictKind = 'keep' | 'cut' | 'move' | 'rewrite' | 'fix' | 'conflict';
export type Note = 'no-evidence' | 'no-anchor' | 'absolute-no-reason' | 'accepted';
export type RuleKind = 'heading' | 'item' | 'paragraph' | 'steps' | 'code';

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
  readonly evidence: string;
  readonly notes: readonly Note[];
  readonly original?: Answer; // present with the accepted note
}
