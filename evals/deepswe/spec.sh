#!/usr/bin/env bash
# A/B on DeepSWE: themis 1.0 core vs 1.0 + spec-checklist rule, on tasks lost to spec details.
# Sequential and resumable: runs R rounds; a finished trial for (task, arm, round) is skipped.
cd "$(dirname "$0")"
TASKS="ink-grid-box-layout pest-character-class-coalescing awilix-async-container-initialization
superjson-error-stack-serialization fd-deterministic-multi-key-sorting ts-pattern-match-each"
ROUNDS=${ROUNDS:-2}
export PYTHONUTF8=1
export THEMIS_EXTRA_CA="$PWD/kaspersky-root.crt"
ENV=/c/Users/jesus/.config/themis/deepswe.env
for r in $(seq 1 $ROUNDS); do
  for t in $TASKS; do
    for arm in v10 spec; do
      out="spec-$arm-r$r"
      if ls $out/*/${t}__*/verifier/reward.json >/dev/null 2>&1; then echo "skip $t $arm r$r"; continue; fi
      echo "=== $(date +%H:%M) $t $arm r$r"
      if [ "$arm" = spec ]; then export THEMIS_PLUGIN_DIR="$PWD/plugin-spec"; else export THEMIS_PLUGIN_DIR="$PWD/plugin"; fi
      PYTHONIOENCODING=utf-8 ./.venv/Scripts/pier run -p "repo/tasks/$t" --agent claude-code --model claude-opus-5-5 \
        --ak reasoning_effort=medium --ak "disallowed_tools=EnterPlanMode WebFetch WebSearch" \
        --env docker -n 1 -o "$out" --env-file "$ENV" 2>&1 | grep -E "Total runtime|Exception|Error" | tail -2
    done
  done
done
echo "=== done $(date +%H:%M)"
