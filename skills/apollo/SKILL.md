---
name: apollo
description: "DEBUG and FIX a bug (edits code): failing reproduction first, ranked hypotheses tested one by one, fix where the cause lives, regression test."
argument-hint: "[symptom, error or failing command]"
disable-model-invocation: true
---

Symptom: $ARGUMENTS

Invoking this skill is the user's request to diagnose **and fix**: carry the work through step 7.

1. **Reproduce.** Build the tightest loop that shows the failure: a failing test, a script, or a command with its output. Run it and see it fail. No theories before this command exists; if it cannot be built, say what is missing and stop.
2. **Minimize.** Shrink the input or steps until removing anything makes the failure disappear.
3. **Hypothesize.** List 3–5 ranked, falsifiable hypotheses, each with the observation that would rule it out. Show them.
4. **Test one variable at a time.** Instrument with temporary logs tagged `[apollo]`, run the loop, and cross out hypotheses with evidence.
5. **Locate the layer.** Find every caller of the faulty function. Fix where the cause lives, not where the symptom shows, so every caller is covered.
6. **Lock it.** Turn the reproduction into a regression test at the right seam, run it and the related suite.
7. **Clean up.** Remove every `[apollo]` log and scratch file.

Report: root cause (with the evidence that confirmed it), the fix, the regression test, and hypotheses ruled out.
