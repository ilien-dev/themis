# Changelog

## 1.0.0 — 2026-09-29

First release. Every component was kept only after it beat the no-plugin baseline in A/B sessions on Claude Opus 5.5 (see RESULTS.md).

- Resident rule (~80 tokens): describing a problem or asking a question gets an assessment, not an edit; changes reuse existing helpers and list other defects instead of fixing them.
- CLAUDE.md / CLAUDE.local.md size cap (~2,500 tokens including imports; shell writes blocked).
- Skills: `ariadne` (start and align), `daedalus` (implement a ticket), `apollo` (debug), `argus` (review against the request), `hermes` (commit/PR), `hestia` (create or audit CLAUDE.md).
- Evaluation harness (`evals/run.mjs`) with 40+ cases and the mining scripts used to study real sessions.
