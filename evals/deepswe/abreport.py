"""Aggregate host A/B runs: per task and arm, binary reward, hidden-test pass rate and cost.
usage: python abreport.py host-runs/v10 host-runs/spec"""
import json, sys
from pathlib import Path

rows = {}
for root in map(Path, sys.argv[1:]):
    for d in sorted(root.glob('*-*')):
        r = json.loads((d / 'reward.json').read_text())
        if r.get('f2p_total') is None:
            continue
        cost = None
        for line in open(d / 'stream.jsonl', encoding='utf-8', errors='ignore'):
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get('type') == 'result':
                cost = e.get('total_cost_usd')
        rows.setdefault(d.name.rsplit('-', 1)[0], {}).setdefault(root.name, []).append((r['reward'], r['f2p_passed'], r['f2p_total'], cost or 0))

arms = [Path(a).name for a in sys.argv[1:]]
print('| task | ' + ' | '.join(arms) + ' |')
print('|---|' + '---|' * len(arms))
tot = {a: [0, 0, 0.0, 0.0] for a in arms}
for t, v in sorted(rows.items()):
    print(f'| {t} | ' + ' | '.join(', '.join(f'{a} ({b}/{c})' for a, b, c, _ in v.get(arm, [])) for arm in arms) + ' |')
    for arm in arms:
        for a, b, c, cost in v.get(arm, []):
            tot[arm][0] += a; tot[arm][1] += 1; tot[arm][2] += b / c; tot[arm][3] += cost
for a, v in tot.items():
    print(f'{a}: solved {v[0]}/{v[1]}, mean hidden-test pass {v[2] / v[1]:.3f}, mean cost ${v[3] / v[1]:.2f}')
