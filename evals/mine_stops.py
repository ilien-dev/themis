"""Offline precision/recall of an early-stop detector on the user's real sessions.
For each assistant turn-ending text followed by a user message, classify the user's reply:
  continue  -> user just told it to go on (the stop was premature)
  other     -> user redirected, answered a question, or gave new work
usage: python evals/mine_stops.py [show]"""
import json, os, re, glob, sys
from collections import Counter

ROOT = os.path.expanduser('~/.claude/projects')
sys.path.insert(0, os.path.dirname(__file__))

CONTINUE = re.compile(r"^\s*(contin[uú]a|sigue|s[ií]|dale|adelante|procede|ok|okay|va|hazlo|go on|continue|yes|proceed|keep going)\b[\s.!,]*(con (eso|lo|las? dem[aá]s|la siguiente).*)?$", re.I)

# Candidate detector: the turn ends by announcing the next step, or offering to continue.
ANNOUNCE = re.compile(
    r"(^|\n|\. )(sigo|contin[uú]o|ahora (paso|sigo|voy|hago|escribo|reviso|corro|conecto|preparo|creo|agrego|elimino)|"
    r"siguiente:|preparo|elimino|agrego|escribo|corro|reviso|paso a|voy a|now i.ll|next(,| up|:)|i.ll (now|next)|let me (now|next)|"
    r"quedan .{0,60}\. sigo)[^\n]{0,160}[.:]?\s*$", re.I)
OFFER = re.compile(r"(¿\s*(sigo|contin[uú]o|procedo|lo (hago|construyo|implemento|aplico|agrego)|quieres que (siga|contin[uú]e|lo))[^?]{0,160}\?\s*$)|"
                   r"((shall|should) i (continue|proceed|go ahead)|want me to (continue|proceed|go ahead))[^?]{0,120}\?\s*$", re.I)

def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(c.get('text', '') for c in content if isinstance(c, dict) and c.get('type') == 'text')
    return ''

def detect(t):
    tail = t.strip()[-400:]
    return bool(ANNOUNCE.search(tail) or OFFER.search(tail))

table = Counter()
shows = []
for d in os.listdir(ROOT):
    if 'Temp-themis' in d:
        continue
    for f in glob.glob(os.path.join(ROOT, d, '*.jsonl')):
        prev = ''
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
            elif e.get('type') == 'user' and not e.get('isMeta'):
                u = text_of(msg.get('content')).strip()
                if not u or u.startswith('<') or u.startswith('This session is being continued') or not prev or prev.startswith('No response requested'):
                    prev = ''
                    continue
                cont = bool(CONTINUE.match(u))
                fired = detect(prev)
                table[(fired, cont)] += 1
                if fired or cont:
                    shows.append((fired, cont, prev.strip()[-160:].replace('\n', ' '), u[:80].replace('\n', ' ')))
                prev = ''
tp, fp, fn, tn = table[(True, True)], table[(True, False)], table[(False, True)], table[(False, False)]
print(f'turn-ends followed by a user message: {sum(table.values())}')
print(f'detector fired & user said continue (TP): {tp}\nfired & user did something else (FP): {fp}\nmissed continue (FN): {fn}\nquiet & other (TN): {tn}')
if tp + fp:
    print(f'precision {tp/(tp+fp):.2f}  recall {tp/(tp+fn) if tp+fn else 0:.2f}')
if len(sys.argv) > 1:
    for fired, cont, p, u in shows:
        print(f"{'F' if fired else '-'}{'C' if cont else '-'} | ...{p} || USER: {u}")
