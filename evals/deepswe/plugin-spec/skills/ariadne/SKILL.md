---
name: ariadne
description: "Start a piece of work: size it, align on the decisions that matter, and for large work write a spec and tickets under .themis/."
argument-hint: "[what you want to build or change]"
disable-model-invocation: true
---

Request: $ARGUMENTS

## 1. Size the work

Read enough of the repo to judge it (entry points, the files the request names, existing patterns). Then pick one size and say which in one line:

- **Trivial**: the diff fits in one sentence. Do it now; no plan, no questions.
- **Normal**: one session, one area. State a plan of at most 3 lines, then do it.
- **Large**: several sessions or areas, or real design choices. Continue with steps 2–4.
- **Foggy**: the goal or feasibility is unclear. Propose the smallest research or throwaway prototype that would answer the open question, and stop.

## 2. Align (large only)

Facts are yours to find in the code; decisions are the user's. Ask only **pivot questions**: ones where a wrong guess forces rework. Decide routine choices yourself and list them as assumptions.

- One round, at most 4 questions, via AskUserQuestion, each with your recommended answer first.
- Nothing gets built until the user confirms the resulting understanding in their own words. "Go with your recommendations" confirms the answers, not permission to build.

## 3. Spec (large only)

Write `.themis/spec.md` using [SPEC.md](SPEC.md). Create `.themis/` if needed and add `.themis/` to the project's `.gitignore` when it is not already ignored.

## 4. Tickets (large only)

Split the spec into vertical slices in `.themis/tickets/NN-slug.md`: each slice is a narrow path through every layer that can be demonstrated on its own and fits one fresh session. Order them by dependency; do refactors that make the change easy first. Each ticket:

```
# NN Title
Blocked by: NN | none
## Build
<behavior, not file paths>
## Acceptance criteria
- [ ] <observable check that fails today and passes when done, with the command or step that shows it>
## Out of scope
```

Show the ticket list and stop. Each ticket is implemented later with /themis:daedalus in a fresh session.
