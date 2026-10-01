"""Proposal 2: measure unrequested additions ("coverage insurance") in agent patches.
Compares each run's patch with the task's reference solution:
  - extra_files: non-test source files the agent changed that the reference did not touch
  - extra_exports: exported/public names the agent added that the reference did not add
  - added_lines: size of the source (non-test) change vs the reference
usage: python extras.py host-runs/v10 host-runs/spec"""
import re, sys, json
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEST = re.compile(r'(^|/)(tests?|__tests__|spec|benches|examples|docs?)/|\.(test|spec)\.[jt]sx?$|_test\.(rs|go|py)$|\.md$|CHANGELOG|readme', re.I)
EXPORT = re.compile(r'^\+\s*(?:export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+(\w+)|export\s*\{([^}]*)\}|pub\s+(?:fn|struct|enum|trait|const|type|mod)\s+(\w+))')

def parse(patch):
    files, exports, added = set(), set(), 0
    cur = None
    for line in patch.splitlines():
        if line.startswith('diff --git '):
            cur = line.split(' b/', 1)[-1]
            continue
        if cur is None or TEST.search(cur):
            continue
        if line.startswith('+') and not line.startswith('+++'):
            added += 1
            files.add(cur)
            m = EXPORT.search(line)
            if m:
                for g in m.groups():
                    if g:
                        exports.update(x.strip().split(' as ')[-1] for x in g.split(',') if x.strip())
        elif line.startswith('-') and not line.startswith('---'):
            files.add(cur)
    return files, exports, added

rows = []
for root in sys.argv[1:]:
    for run in sorted(Path(root).glob('*-*')):
        if not (run / 'reward.json').exists():
            continue
        task = run.name.rsplit('-', 1)[0]
        ref = (HERE / 'repo' / 'tasks' / task / 'solution' / 'solution.patch').read_text(encoding='utf-8', errors='replace')
        mine = (run / 'model.patch').read_text(encoding='utf-8', errors='replace')
        rf, re_, ra = parse(ref)
        mf, me, ma = parse(mine)
        reward = json.loads((run / 'reward.json').read_text())
        rows.append({'arm': Path(root).name, 'run': run.name, 'reward': reward.get('reward'),
                     'f2p': f"{reward.get('f2p_passed')}/{reward.get('f2p_total')}",
                     'extra_files': sorted(mf - rf), 'extra_exports': sorted(me - re_),
                     'src_lines': ma, 'ref_src_lines': ra})
for r in rows:
    print(f"{r['arm']:5} {r['run']:45} reward={r['reward']} f2p={r['f2p']:8} src+{r['src_lines']:5} (ref +{r['ref_src_lines']:5}) "
          f"extraFiles={len(r['extra_files'])} extraExports={len(r['extra_exports'])} {r['extra_exports'][:6]}")
