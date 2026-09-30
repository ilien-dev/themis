"""Write a compact, committable summary of DeepSWE trials (no transcripts, no secrets).
usage: python summarize.py <out.json> <runs-dir>..."""
import json, glob, os, sys

rows = []
for root in sys.argv[2:]:
    arm = 'themis' if 'themis' in root else 'base'
    for trial in sorted(glob.glob(os.path.join(root, '*', '*__*'))):
        rw = os.path.join(trial, 'verifier', 'reward.json')
        if not os.path.exists(rw):
            continue
        r = json.load(open(rw))
        cost = turns = secs = None
        log = os.path.join(trial, 'agent', 'claude-code.txt')
        if os.path.exists(log):
            for line in open(log, encoding='utf-8', errors='ignore'):
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                if e.get('type') == 'result':
                    cost, turns, secs = e.get('total_cost_usd'), e.get('num_turns'), (e.get('duration_ms') or 0) // 1000
        patch = os.path.join(trial, 'artifacts', 'model.patch')
        rows.append({'source': root, 'arm': arm, 'task': os.path.basename(trial).split('__')[0], **r,
                     'cost_usd': cost, 'turns': turns, 'secs': secs,
                     'patch_bytes': os.path.getsize(patch) if os.path.exists(patch) else None})
json.dump(rows, open(sys.argv[1], 'w'), indent=1)
print(len(rows), 'trials ->', sys.argv[1])
