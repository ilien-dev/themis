---
name: daedalus
description: "BUILD one ticket or short task: new branch, tests first where there is logic, real checks, ticket criteria ticked with evidence, one commit. Never pushes."
argument-hint: "[ticket path or number, or a short task]"
disable-model-invocation: true
---

Target: $ARGUMENTS (if it is a number, the ticket is `.themis/tickets/<NN>-*.md`).

1. **Load the target.** Read the ticket and `.themis/spec.md` if they exist. If the ticket is blocked by an open ticket, say so and stop.
2. **Branch.** If on the default branch, create `themis/<NN-slug>` (or a short name for the task). Never commit to main/master.
3. **Build.**
   - Where the change has logic (branching, parsing, calculations, state), work test-first at the seam the ticket describes: one failing test, the minimal code to pass it, repeat. See [TDD.md](TDD.md).
   - Markup, copy, styling and config changes need no new tests.
4. **Check.** Run the project's own checks for what changed: the relevant tests, the type-checker or build, or the changed command itself. A syntax-only check or a command that failed to start does not count. If a check cannot run here, say which one and why.
5. **Close out.** Tick each acceptance criterion in the ticket that you saw pass, and note the command or step next to it. Leave unticked what you did not see pass, and say why.
6. **Commit.** One commit for the ticket: `<type>: <what changed>` plus a body with the ticket number and anything non-obvious. Do not push.

Report: what changed, which criteria passed (with evidence), what was not verified, follow-ups noticed but not done.
