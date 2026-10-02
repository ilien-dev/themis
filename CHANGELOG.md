# Changelog

## 1.1.1 — 2026-10-02

- Visual identity in `assets/`: the coin emblem (a blindfolded Themis in profile), horizontal lockups for light and dark, a companion mark and favicons, one icon per skill, and a social preview. All vector, text set as outlines.
- README animations, light and dark: `hero`, `flow`, `describe` (case h03) and `cap` (the CLAUDE.md cap and hestia).
- `assets/README.md` documents the palette, type, licences, the Codex prompts and how to rebuild every file.
- No change to the plugin's behavior.

## 1.1.0 — 2026-10-01

- Skill descriptions rewritten to lead with their role (PLAN, BUILD, DEBUG, REVIEW, SHIP, CLAUDE.md) and say exactly what each does.
- `hestia` is now model-invocable: Claude loads it before creating or editing a CLAUDE.md. New `edit` mode changes only what was asked instead of auditing the whole file.
- The cap hook's rejection now tells Claude to load `hestia`.
- Not re-measured: c13–c15 were run with `hestia` user-invoked only.
- Public release on GitHub (`ilien-dev/themis`): LICENSE (MIT), SECURITY.md, homepage and repository in the manifest, install instructions for the GitHub marketplace.
- Eval scripts no longer hard-code local paths; an optional extra root CA is read from `evals/deepswe/extra-ca.crt`.

## 1.0.0 — 2026-09-29

First release. Every component was kept only after it beat the no-plugin baseline in A/B sessions on Claude Opus 5.5 (see RESULTS.md).

- Resident rule (~80 tokens): describing a problem or asking a question gets an assessment, not an edit; changes reuse existing helpers and list other defects instead of fixing them.
- CLAUDE.md / CLAUDE.local.md size cap (~2,500 tokens including imports; shell writes blocked).
- Skills: `ariadne` (start and align), `daedalus` (implement a ticket), `apollo` (debug), `argus` (review against the request), `hermes` (commit/PR), `hestia` (create or audit CLAUDE.md).
- Evaluation harness (`evals/run.mjs`) with 40+ cases and the mining scripts used to study real sessions.
