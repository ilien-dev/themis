"""Mine the user's own Claude Code sessions for messages that correct the model.
Writes evals/mined/corrections.jsonl (local only; gitignored).
usage: python evals/mine_corrections.py"""
import json, os, re, glob

ROOT = os.path.expanduser('~/.claude/projects')
OUT = os.path.join(os.path.dirname(__file__), 'mined')
os.makedirs(OUT, exist_ok=True)

CORRECTION = re.compile(
    r"\b(no (funciona|sirve|era|es eso|hagas|toques|cambies|te ped[ií])|te ped[ií]|otra vez|de nuevo|sigue (sin|fallando|igual)|"
    r"por qu[eé] (cambiaste|borraste|eliminaste|agregaste|hiciste|tocaste|no)|no deber[ií]as|eso no|est[aá] mal|mal hecho|revierte|revert|deshaz|"
    r"rompiste|se rompi[oó]|ya no funciona|no lo probaste|no compila|inventaste|alucin|mentiste|no es cierto|no es verdad|"
    r"dijiste que|no hiciste|olvidaste|te falt[oó]|incompleto|a medias|no le[ií]ste|sin preguntar|no ped[ií]|"
    r"that'?s (wrong|not what)|you (broke|forgot|didn'?t|removed|changed)|i (didn'?t|did not) ask|revert|undo|still (broken|failing))",
    re.I)

def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(c.get('text', '') for c in content if isinstance(c, dict) and c.get('type') == 'text')
    return ''

rows = []
for d in sorted(os.listdir(ROOT)):
    if 'Temp-themis' in d:
        continue
    for f in glob.glob(os.path.join(ROOT, d, '*.jsonl')):
        last_assistant = ''
        for line in open(f, encoding='utf-8', errors='ignore'):
            try:
                e = json.loads(line)
            except Exception:
                continue
            msg = e.get('message') or {}
            if e.get('type') == 'assistant':
                t = text_of(msg.get('content'))
                if t.strip():
                    last_assistant = t
            elif e.get('type') == 'user' and not e.get('isMeta'):
                t = text_of(msg.get('content')).strip()
                if not t or t.startswith('<') or 'tool_use_id' in t:
                    continue
                if CORRECTION.search(t):
                    rows.append({'project': re.sub(r'^C--Users-[^-]+-?', '', d) or 'home',
                                 'session': os.path.basename(f)[:8], 'user': t[:700], 'prev': last_assistant[-500:]})
with open(os.path.join(OUT, 'corrections.jsonl'), 'w', encoding='utf-8') as out:
    for r in rows:
        out.write(json.dumps(r, ensure_ascii=False) + '\n')
from collections import Counter
print(len(rows), Counter(r['project'] for r in rows).most_common())
