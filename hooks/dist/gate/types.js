// Every reason code, by question.
export const REASON_CODES = [
    'inferable-title', 'inferable-tree', 'inferable-script', 'inferable-tech', 'inferable-overview', 'inferable-path', 'inferable-stack', 'stale-version', // 1
    'enforced-config', 'config-conflict', 'enforced-deny', // 2
    'vendor-declared', 'file-filler', 'generic-advice', // 3
    'absolute-command', // 5
    'duplicated-passage', 'long-procedure', // 6
    'dead-reference', 'emphasis', // 7
];
// Codes no check gives any more. They stay in REASON_CODES so the rules a user accepted under them still load.
// dead-reference: an unresolved reference is now the unresolved-reference note on a kept rule.
export const RETIRED_CODES = new Set(['dead-reference']);
