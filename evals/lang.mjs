// Stopword-based language check. Only flags a reply that is clearly in another
// supported language; anything ambiguous (short, code-heavy) passes.
const SETS = {
  english: 'the and is are was were be been this that these those with for from have has not you your will would can should which what when there their they it its of to in on at by an or but if',
  spanish: 'el la los las un una unos unas y es son fue ser está están este esta estos estas con para por desde tiene tienen no que qué cuando donde hay del al lo como pero si ya se su sus más también',
  portuguese: 'o os as um uma uns umas e é são foi ser está estão este esta estes estas com para por desde tem têm não que quando onde há do da dos das ao como mas se já seu sua mais também',
  french: 'le la les un une des et est sont était être ce cette ces avec pour par depuis a ont ne pas que quand où il y du au comme mais si déjà son sa ses plus aussi',
  german: 'der die das ein eine und ist sind war sein dieser diese dieses mit für von hat haben nicht dass wenn wo es gibt dem den des wie aber auch schon sein ihr mehr',
  italian: 'il lo la i gli le un una e è sono era essere questo questa questi queste con per da ha hanno non che quando dove c del della come ma se già suo sua più anche',
};
const ALIASES = { english: /^(en|english|inglés|ingles)$/i, spanish: /^(es|spanish|español|espanol|castellano)$/i,
  portuguese: /^(pt|portuguese|português|portugues)$/i, french: /^(fr|french|français|francais)$/i,
  german: /^(de|german|deutsch)$/i, italian: /^(it|italian|italiano)$/i };
const WORDS = Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k, new Set(v.split(' '))]));

export function canonical(lang) {
  return Object.keys(ALIASES).find((k) => ALIASES[k].test(String(lang).trim())) || null;
}

export function counts(text) {
  const prose = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S*[\\/]\S*/g, ' ')
    .toLowerCase();
  const tokens = prose.match(/[a-záéíóúüñàâçèêëîïôûùœäöß]+/g) || [];
  const out = Object.fromEntries(Object.keys(WORDS).map((k) => [k, 0]));
  for (const t of tokens) for (const k in WORDS) if (WORDS[k].has(t)) out[k]++;
  return out;
}

export function detectMismatch(text, lang) {
  const target = canonical(lang);
  if (!target) return false;
  const c = counts(text);
  const [other, n] = Object.entries(c).filter(([k]) => k !== target).sort((a, b) => b[1] - a[1])[0];
  return n >= 8 && n > 2 * c[target];
}
