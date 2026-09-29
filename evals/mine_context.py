"""Show the assistant's last text before user messages matching a regex (local only).
usage: python evals/mine_context.py "<regex>" [chars]"""
import json, os, re, glob, sys

ROOT = os.path.expanduser('~/.claude/projects')
rx = re.compile(sys.argv[1], re.I)
n = int(sys.argv[2]) if len(sys.argv) > 2 else 400

def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(c.get('text', '') for c in content if isinstance(c, dict) and c.get('type') == 'text')
    return ''

for d in sorted(os.listdir(ROOT)):
    if 'Temp-themis' in d:
        continue
    for f in glob.glob(os.path.join(ROOT, d, '*.jsonl')):
        prev, prev_stop = '', ''
        for line in open(f, encoding='utf-8', errors='ignore'):
            try:
                e = json.loads(line)
            except Exception:
                continue
            msg = e.get('message') or {}
            if e.get('type') == 'assistant':
                t = text_of(msg.get('content'))
                if t.strip():
                    prev = t
                prev_stop = msg.get('stop_reason') or prev_stop
            elif e.get('type') == 'user' and not e.get('isMeta'):
                t = text_of(msg.get('content')).strip()
                if t and not t.startswith('<') and rx.search(t) and len(t) < 300:
                    print(f"=== [{d[-20:]}] USER: {t[:200]}")
                    print('    PREV:', prev[-n:].replace('\n', ' '))
