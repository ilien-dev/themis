"""Inspect a results round: hook firings and per-run notes/final text.
usage: python evals/inspect.py <tag> [case-substring] [arm]"""
import json, glob, os, re, sys, collections

tag = sys.argv[1]
flt = sys.argv[2] if len(sys.argv) > 2 else ''
arm = sys.argv[3] if len(sys.argv) > 3 else ''
root = os.path.join(os.path.dirname(__file__), 'results', tag)
fires = collections.Counter()
for f in sorted(glob.glob(os.path.join(root, '*', '*.jsonl'))):
    case = os.path.basename(os.path.dirname(f))
    run = os.path.basename(f)[:-6]
    for line in open(f, encoding='utf-8'):
        try:
            e = json.loads(line)
        except Exception:
            continue
        if e.get('type') == 'system' and e.get('subtype') == 'hook_response':
            o = e.get('output') or ''
            m = re.search(r'"(permissionDecision|decision)":"(\w+)"', o)
            if m:
                fires[(case, e.get('hook_name'), m.group(2))] += 1
                if flt and flt in case:
                    print('HOOK', case, run, e.get('hook_name'), o[:260])
for k, v in sorted(fires.items()):
    print('FIRE', k, v)
if flt:
    for f in sorted(glob.glob(os.path.join(root, f'*{flt}*', f'{arm}*.json'))):
        r = json.load(open(f, encoding='utf-8'))
        print('\n==', os.path.basename(os.path.dirname(f)), os.path.basename(f), r.get('pass'), r.get('notes'), '| denials', r.get('denials'), '| tools', r.get('tools'))
        print((r.get('final') or '')[:1200])
