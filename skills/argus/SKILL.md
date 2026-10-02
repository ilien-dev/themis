---
name: argus
description: "REVIEW the current diff against what was asked: lists missing, unasked and overbuilt items with file:line. Read-only, never edits."
argument-hint: "[the request or spec path; defaults to .themis/spec.md]"
disable-model-invocation: true
context: fork
agent: themis:argus-eye
background: false
---

Review the working changes of the repository in the current directory against what was asked.

**What was asked:** $ARGUMENTS
If that is empty or a path, read it from the path, else from `.themis/spec.md` and the open ticket in `.themis/tickets/`, else from the branch's commit messages. Quote the source you used.

**The change:** run `git diff $(git merge-base HEAD origin/HEAD 2>/dev/null || git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null || echo HEAD)` (this includes uncommitted work) and `git status --short` for new files. Read the changed files around each hunk as needed.

Report findings on three axes, one line each, citing `file:line` and the requirement line it relates to:

- **MISSING**: a requirement that is absent or only partly done.
- **UNASKED**: behavior, files, refactors or tests in the diff that nothing asked for.
- **OVERBUILT**: something the repo, standard library, platform or an installed dependency already provides, or an abstraction with a single use. Say what to use or delete instead.

Rules:
- Report every issue that affects the stated requirements; mark each `certain` or `check`. Style preferences are not findings.
- Every finding cites a line you read in this run. If you did not read a file, do not report on it.
- End with the list of files you read. Do not edit anything, spawn agents or invoke skills.
- If there are no findings on an axis, write `none`.
