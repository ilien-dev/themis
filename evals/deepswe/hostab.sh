#!/usr/bin/env bash
# Resumable host A/B driver: ROUNDS rounds over the given tasks, alternating variants.
#   bash hostab.sh "<task> <task> ..."
cd "$(dirname "$0")"
ROUNDS=${ROUNDS:-2}
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
done_count() { ls -d host-runs/$1/$2-* 2>/dev/null | while read d; do [ -f "$d/reward.json" ] && echo x; done | wc -l; }
for r in $(seq 1 $ROUNDS); do
  for t in $1; do
    for arm in ${ARMS:-v10 spec}; do
      [ "$(done_count $arm $t)" -ge "$r" ] && continue
      # drop an unfinished attempt so numbering stays aligned
      for d in host-runs/$arm/$t-*; do [ -d "$d" ] && [ ! -f "$d/reward.json" ] && rm -rf "$d"; done
      dir=plugin; [ "$arm" = spec ] && dir=plugin-spec; [ "$arm" = noext ] && dir=plugin-noext
      ./.venv/Scripts/python hostrun.py "$dir" "$arm" "$t" 2>&1 | tail -1
    done
  done
done
