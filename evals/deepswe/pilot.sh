#!/usr/bin/env bash
# Sequential A/B pilot on DeepSWE: for each task, run without and with themis.
# Resumable: a task/arm with a finished trial directory is skipped.
cd "$(dirname "$0")"
TASKS="pest-character-class-coalescing fd-deterministic-multi-key-sorting true-myth-iterable-collection-combinators
eicrud-keyset-pagination-cursor ts-pattern-match-each ofetch-per-origin-circuit-breaker superjson-error-stack-serialization
awilix-async-container-initialization"
export PYTHONUTF8=1
ENV=${DEEPSWE_ENV:-$HOME/.config/themis/deepswe.env}
# Optional extra root CA for TLS-intercepting proxies or antivirus (PEM file).
[ -f extra-ca.crt ] && export THEMIS_EXTRA_CA="$PWD/extra-ca.crt"
PLUGIN="$PWD/plugin"
for t in $TASKS; do
  for arm in base themis; do
    out="pilot-$arm"
    if ls $out/*/${t}__*/verifier/reward.json >/dev/null 2>&1; then echo "skip $t $arm"; continue; fi
    echo "=== $(date +%H:%M) $t $arm"
    if [ "$arm" = themis ]; then export THEMIS_PLUGIN_DIR="$PLUGIN"; else unset THEMIS_PLUGIN_DIR; fi
    PYTHONIOENCODING=utf-8 ./.venv/Scripts/pier run -p "repo/tasks/$t" --agent claude-code --model claude-opus-5-5 \
      --ak reasoning_effort=medium --ak "disallowed_tools=EnterPlanMode WebFetch WebSearch" \
      --env docker -n 1 -o "$out" --env-file "$ENV" 2>&1 | grep -E "Total runtime|Exception|Error" | tail -3
  done
done
echo "=== done $(date +%H:%M)"
