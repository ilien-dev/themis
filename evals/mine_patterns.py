"""Count recurring correction patterns in the user's own sessions (local only).
usage: python evals/mine_patterns.py [show-pattern-name]"""
import json, os, re, glob, sys
from collections import Counter, defaultdict

ROOT = os.path.expanduser('~/.claude/projects')
PATTERNS = {
    'answer_only': r'no hagas (nada|cambios)|solo responde|s[oó]lo resp[oó]nde|no cambies nada|just answer|don.t change anything',
    'still_broken': r'no funciona|sigue sin|sigue (igual|fallando|apareciendo|viendo)|todav[ií]a (no|se ve|sale)|a[uú]n no (funciona|se ve)|still (not|broken)',
    'missed_part': r'te falt[oó]|olvidaste|no hiciste|no (lo )?agregaste|falt[oó] (la|el|que)|no incluiste|you forgot|you missed',
    'not_what_asked': r'no (era|es) (eso|lo que)|no quer[ií]a|yo quer[ií]a|me refer[ií]a|no me refiero|a lo que me refiero|solo para aclarar|not what i (asked|meant)',
    'stopped_early': r'por qu[eé] (te detuviste|paraste|no (llegaste|terminaste|continuaste))|no te detengas|contin[uú]a|sigue con|keep going',
    'visual': r'no se ve|se ve (raro|mal|extra[nñ]o)|desentona|desacomod|contraste|se pierde',
    'unrequested': r'no (te )?ped[ií]|por qu[eé] (cambiaste|agregaste|borraste|eliminaste|tocaste)|sin (que te lo pidiera|preguntar)',
    'false_claim': r'no es cierto|no es verdad|mentiste|dijiste que|inventaste|alucin',
}
RX = {k: re.compile(v, re.I) for k, v in PATTERNS.items()}

def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(c.get('text', '') for c in content if isinstance(c, dict) and c.get('type') == 'text')
    return ''

counts, examples, total = Counter(), defaultdict(list), 0
for d in os.listdir(ROOT):
    if 'Temp-themis' in d:
        continue
    for f in glob.glob(os.path.join(ROOT, d, '*.jsonl')):
        for line in open(f, encoding='utf-8', errors='ignore'):
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get('type') != 'user' or e.get('isMeta'):
                continue
            t = text_of((e.get('message') or {}).get('content')).strip()
            if not t or t.startswith('<') or t.startswith('This session is being continued'):
                continue
            total += 1
            for k, rx in RX.items():
                if rx.search(t):
                    counts[k] += 1
                    examples[k].append(f"[{d[-22:]}] {t[:260]}")
print('user messages:', total)
for k, v in counts.most_common():
    print(f'{k:16} {v}')
if len(sys.argv) > 1:
    for ex in examples[sys.argv[1]]:
        print('-', ex.replace('\n', ' '))
