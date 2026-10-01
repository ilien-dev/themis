---
name: hermes
description: "Prepare the change for delivery: tidy commits, write the commit message and PR body with evidence and merge risk. Asks before any push."
argument-hint: "[commit | pr]"
disable-model-invocation: true
---

Mode: $ARGUMENTS (default: `pr` if the branch has commits ahead of its base, else `commit`).

1. Look at `git status`, `git diff` and `git log <base>..HEAD`. If there is uncommitted work, show it and ask whether it belongs in this delivery.
2. **Commit message:** `<type>: <what changed>` in the imperative, under 72 characters; the body says why, and references the ticket if one exists. One logical change per commit.
3. **PR body** (mode `pr`):
   - **Summary**: the smallest thing that shows the change: a short diff excerpt, a call tree, a before/after, or a Mermaid diagram.
   - **Evidence**: commands run and their result, screenshots if UI. Only what was run in this session or recorded in the ticket; unverified parts are listed as unverified.
   - **Merge risk**: reversible or not, what it can break, and how to roll back.
4. Show the message or body. Push or open the PR only after the user says so.
