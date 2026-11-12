# Filtro de reglas, fase 1: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada regla nueva de `CLAUDE.md` / `AGENTS.md` reciba un veredicto determinista con código de razón y evidencia, calculado por script en el hook, en la skill y en un informe de métricas.

**Architecture:** Un módulo puro en `hooks/gate/` (extractor de reglas → hechos del repo → preguntas en orden fijo → veredicto) que usan tres entradas: `pre-tool.ts` (pide confirmación), `parity.ts` (registra lo aceptado) y un CLI `gate.ts` (`check`, `audit`, `report`). Las tablas son módulos TypeScript de datos. No hay red, ni modelo, ni dependencias en ejecución.

**Tech Stack:** TypeScript estricto, Node (fuentes con `node --test` en ≥ 22.18; `hooks/dist/` debe correr en Node 18), ESLint, `git` como único proceso externo.

**Spec:** `docs/superpowers/specs/2026-11-12-filtro-de-reglas-design.md`

## Global Constraints

- Sin dependencias en tiempo de ejecución: solo `node:*`. Nada de `import x from './y.json'` (Node 18): las tablas son `.ts`.
- `hooks/dist/` se versiona y CI falla si no coincide con el build. Cada commit que toque `hooks/` incluye `npm run build`.
- `npm run check` (typecheck, lint sin avisos, build, test) pasa al final de cada tarea.
- Los hooks fallan en silencio: cualquier excepción termina en `exit 0` sin salida (ya lo hace `run()` en `hooks/lib.ts`).
- El filtro nunca devuelve `deny`.
- Mismo texto + mismo repo + mismas tablas → mismo veredicto. Ninguna función de `hooks/gate/` lee el reloj, salvo que reciba la fecha como argumento.
- Evaluar las reglas de una edición tarda menos de 200 ms en proceso.
- Identificadores, mensajes y comentarios en inglés, como el resto del repo. Mensajes de commit sin líneas `Claude-Session:` ni enlaces a sesiones.
- Trabajar en la rama `gate-phase-1`, no en `main`.

### Nombres en el código

La spec nombra los veredictos en español; el código usa estos equivalentes (coinciden con los que la skill ya usa en `audit`):

| Spec | Código | | Nota en la spec | Código |
|---|---|---|---|---|
| `ENTRA` | `keep` | | `SIN_EVIDENCIA` | `no-evidence` |
| `NO_ENTRA` | `cut` | | `SIN_ANCLA` | `no-anchor` |
| `MOVER` | `move` | | `ABSOLUTA_SIN_MOTIVO` | `absolute-no-reason` |
| `REESCRIBIR` | `rewrite` | | `ACEPTADA` | `accepted` |
| `CORREGIR` | `fix` | | | |
| `CONFLICTO` | `conflict` | | | |

Códigos de razón: `inferable-tech`, `inferable-script`, `inferable-title`, `inferable-tree`, `inferable-overview` (pregunta 1); `enforced-config`, `enforced-deny`, `config-conflict` (2); `generic-advice`, `file-filler`, `vendor-declared` (3); `absolute-command` (5); `long-procedure`, `duplicated-passage` (6); `emphasis`, `dead-reference` (7).

La pregunta 4 y la opción `gate_models` no se implementan en esta fase.

## Review Focus

1. **Archivos con CRLF.** Un `CLAUDE.md` guardado en Windows debe dar las mismas reglas y los mismos hashes que su versión LF. Test en la tarea 1 y en la 8.
2. **Configuración rota.** `package.json` con JSON inválido, `tsconfig.json` con comentarios o con un `extends` circular: `readFacts` no lanza y la regla sale `keep`. Test en la tarea 2.
3. **Cosas que parecen rutas y no lo son.** URLs, globs (`src/**/*.ts`), rutas con `\`, versiones (`v2.1/3`) dentro de comillas invertidas no deben salir `dead-reference`. Test en la tarea 7.
4. **Bloques de código con sintaxis Markdown dentro.** Un bloque cercado que contiene `# comentario` o `- item` es una sola regla de tipo `code`. Test en la tarea 1.
5. **Líneas enormes.** Una regla de 20 000 caracteres en una línea se evalúa en menos de 200 ms (ningún patrón de las tablas retrocede de forma catastrófica). Test en la tarea 9.

---

## Estructura de archivos

```
hooks/gate/types.ts        tipos compartidos
hooks/gate/extract.ts      Markdown → reglas; reglas nuevas de una edición
hooks/gate/read-config.ts  lectores mínimos: JSONC, YAML plano, .editorconfig
hooks/gate/facts.ts        hechos del repo
hooks/gate/text.ts         normalizar, palabras, similitud, anclas, comandos y rutas citados
hooks/gate/checks/q1.ts q2.ts q3.ts q5.ts q6.ts q7.ts
hooks/gate/tables/alias.ts lint-map.ts phrases.ts
hooks/gate/verdict.ts      orden de preguntas, notas
hooks/gate/accepted.ts     .claude/themis-accepted.json y pendientes
hooks/gate/format.ts       texto de ask, tabla de audit, métricas
hooks/gate.ts              CLI
hooks/pre-tool.ts, hooks/parity.ts, hooks/lib.ts   (modificados)
tests/gate/*.test.ts, tests/gate/corpus.jsonl, tests/gate/holdout/
```

---

### Task 1: Tipos, extractor y configuración del build

**Files:**
- Create: `hooks/gate/types.ts`, `hooks/gate/extract.ts`, `tests/gate/extract.test.ts`
- Modify: `tsconfig.json` (include `hooks/**/*.ts`, `tests/**/*.ts`), `tsconfig.build.json` (include `hooks/**/*.ts`), `package.json` (`"test": "node --test tests/*.test.ts tests/gate/*.test.ts"`), `eslint.config.ts` si sus globs no cubren las carpetas nuevas

**Interfaces:**
- Produces:

```ts
// types.ts
export type VerdictKind = 'keep' | 'cut' | 'move' | 'rewrite' | 'fix' | 'conflict';
export type Note = 'no-evidence' | 'no-anchor' | 'absolute-no-reason' | 'accepted';
export type RuleKind = 'heading' | 'item' | 'paragraph' | 'steps' | 'code';
export interface Rule { readonly text: string; readonly kind: RuleKind; readonly line: number; readonly lines: number }
export interface Answer {
  readonly verdict: Exclude<VerdictKind, 'keep'>;
  readonly code: string;       // uno de los códigos de razón
  readonly question: 1 | 2 | 3 | 5 | 6 | 7;
  readonly evidence: string;   // p. ej. "package.json: dependencies.express"
  readonly target?: string;    // destino sugerido en move
}
export interface Verdict {
  readonly rule: Rule; readonly verdict: VerdictKind; readonly code: string | null;
  readonly question: number | null; readonly evidence: string;
  readonly notes: readonly Note[]; readonly original?: Answer; // presente con la nota accepted
}
// extract.ts
export function parseRules(markdown: string): Rule[];
export function newRules(before: string | null, after: string): Rule[];
export function normalize(text: string): string; // CRLF→LF, espacios colapsados, trim
```

Reglas de `parseRules`: solo los encabezados de nivel 1 producen una regla (`heading`); un elemento de lista incluye sus líneas de continuación con sangría; una lista numerada completa es una regla `steps`; un bloque cercado se une al párrafo que lo precede y es `code`; el resto son `paragraph`. `line` es 1-based.

- [ ] **Step 1: Tests que fallan** en `tests/gate/extract.test.ts`:

```ts
test('a wrapped bullet is one rule', () => {
  const r = parseRules('- Never run `x`\n  because it drops the db\n- Second');
  assert.deepEqual(r.map((x) => [x.kind, x.lines]), [['item', 2], ['item', 1]]);
});
test('a numbered list is one steps rule', () => {
  assert.deepEqual(parseRules('1. a\n2. b\n3. c').map((x) => x.kind), ['steps']);
});
test('a fenced block joins its lead-in and hides markdown inside it', () => {
  const r = parseRules('Tree:\n```\n# not a heading\n- not an item\n```');
  assert.equal(r.length, 1); assert.equal(r[0]?.kind, 'code');
});
test('only level-1 headings are rules', () => {
  assert.deepEqual(parseRules('# Ledger\n## Commands\n- a').map((x) => x.kind), ['heading', 'item']);
});
test('CRLF gives the same rules as LF', () => {
  const lf = '- a\n- b\n'; assert.deepEqual(parseRules(lf.replace(/\n/g, '\r\n')), parseRules(lf));
});
test('newRules ignores reorders, rewraps and deletions', () => {
  assert.deepEqual(newRules('- a\n- b', '- b\n-   a'), []);
  assert.deepEqual(newRules('- a\n- b', '- a'), []);
  assert.deepEqual(newRules('- a', '- a\n- c').map((x) => x.text), ['- c']);
  assert.equal(newRules(null, '- a\n- b').length, 2);
});
```

- [ ] **Step 2:** `npm test` → fallan por módulo inexistente.
- [ ] **Step 3:** Implementar `types.ts` y `extract.ts`. `newRules` compara por `normalize(rule.text)`.
- [ ] **Step 4:** `npm run check` → pasa; `hooks/dist/gate/extract.js` existe.
- [ ] **Step 5:** Commit: `Add the rule extractor for the gate`.

### Task 2: Hechos del repo

**Files:**
- Create: `hooks/gate/read-config.ts`, `hooks/gate/facts.ts`, `tests/gate/facts.test.ts`, `tests/gate/helpers.ts`

**Interfaces:**
- Produces:

```ts
// read-config.ts
export function parseJsonc(text: string): unknown;                       // comentarios y comas finales; null si no parsea
export function parseFlatYaml(text: string): Record<string, unknown>;    // solo clave: escalar en el nivel superior
export function parseEditorconfig(text: string): Record<string, string>; // sección [*] fusionada con la raíz
// facts.ts
export type Tool = 'prettier' | 'eslint' | 'biome' | 'tsc' | 'editorconfig' | 'commitlint';
export interface Facts {
  readonly root: string;                 // raíz git, o dir si no hay repo
  readonly dir: string;                  // directorio del archivo de reglas
  readonly inRepo: boolean;
  readonly pkg: { readonly path: string; readonly name: string | null; readonly deps: ReadonlySet<string>; readonly scripts: Readonly<Record<string, string>> } | null;
  readonly lockfiles: ReadonlySet<string>;        // nombres de archivo
  readonly config: ReadonlyMap<string, unknown>;  // "prettier.semi", "tsconfig.strict", "editorconfig.indent_style", "eslint.rules.quotes"
  readonly unreadable: readonly string[];         // p. ej. "eslint.config.js"
  readonly runs: ReadonlySet<Tool>;               // herramientas con prueba de ejecución
  readonly deny: readonly string[];               // permissions.deny de .claude/settings*.json
  readonly files: ReadonlySet<string>;            // rutas posix relativas a root
  readonly languages: readonly string[];          // por número de archivos, descendente
  readonly docs: readonly { readonly file: string; readonly text: string }[]; // párrafos de README.md y docs/*.md
}
export function readFacts(ruleFile: string, override?: { files?: readonly string[] }): Facts;
// tests/gate/helpers.ts
export function repo(files: Record<string, string>): string; // dir temporal con git init y git add
```

Decisiones:
- Para `package.json` y cada config gana el archivo más cercano subiendo desde `dir` hasta `root`.
- `files` sale de `git ls-files -co --exclude-standard` (timeout 5000 ms, como `gitLines` en `lib.ts`); con `override.files` no se llama a git.
- `runs` contiene una herramienta si su nombre aparece como palabra en el valor de algún script de `pkg.scripts`, en un archivo de `.husky/`, en `lefthook.yml`, en `.pre-commit-config.yaml` o en `.github/workflows/*.yml`. `tsc` está siempre que exista `tsconfig.json`; `editorconfig` nunca (los editores no son prueba).
- `tsconfig.json`: seguir `extends` relativos, hasta 5 saltos; un ciclo corta sin error.
- `eslint.config.*`, `prettier.config.*`, `.prettierrc.js`, `.eslintrc.js|cjs` van a `unreadable`.
- `languages`: por extensión sobre `files` (`.ts/.tsx`→TypeScript, `.js/.mjs/.cjs/.jsx`→JavaScript, `.py`→Python, `.go`→Go, `.rs`→Rust).

- [ ] **Step 1: Tests que fallan:**

```ts
test('the nearest package.json wins in a monorepo', () => {
  const d = repo({ 'package.json': '{"name":"root","dependencies":{"react":"1"}}', 'packages/api/package.json': '{"name":"api","dependencies":{"express":"1"}}', 'packages/api/CLAUDE.md': '' });
  const f = readFacts(join(d, 'packages/api/CLAUDE.md'));
  assert.equal(f.pkg?.name, 'api'); assert.ok(f.pkg?.deps.has('express')); assert.ok(!f.pkg?.deps.has('react'));
});
test('prettier config resolves values and needs proof of execution', () => {
  const d = repo({ '.prettierrc': 'semi: false\nsingleQuote: true\n', 'package.json': '{"scripts":{"format":"prettier --write ."}}' });
  const f = readFacts(join(d, 'CLAUDE.md'));
  assert.equal(f.config.get('prettier.semi'), false); assert.ok(f.runs.has('prettier'));
  assert.ok(!readFacts(join(repo({ '.prettierrc': 'semi: false\n' }), 'CLAUDE.md')).runs.has('prettier'));
});
test('tsconfig with comments and extends is read; a cycle does not throw', () => {
  const d = repo({ 'tsconfig.json': '{ // c\n "extends": "./base.json" }', 'base.json': '{"extends":"./tsconfig.json","compilerOptions":{"strict":true}}' });
  assert.equal(readFacts(join(d, 'CLAUDE.md')).config.get('tsconfig.strict'), true);
});
test('broken package.json gives null, not an exception', () => {
  assert.equal(readFacts(join(repo({ 'package.json': '{nope' }), 'CLAUDE.md')).pkg, null);
});
test('code-only configs are listed as unreadable', () => {
  assert.deepEqual(readFacts(join(repo({ 'eslint.config.js': '' }), 'CLAUDE.md')).unreadable, ['eslint.config.js']);
});
test('outside a git repo inRepo is false and root is the file directory', () => { /* mkdtemp sin git init */ });
test('permissions.deny is read from both settings files', () => { /* .claude/settings.json + settings.local.json */ });
```

- [ ] **Step 2:** `npm test` → fallan.
- [ ] **Step 3:** Implementar `read-config.ts` y `facts.ts`.
- [ ] **Step 4:** `npm run check` → pasa.
- [ ] **Step 5:** Commit: `Read repository facts for the gate`.

### Task 3: Utilidades de texto y veredicto con notas

**Files:**
- Create: `hooks/gate/text.ts`, `hooks/gate/verdict.ts`, `tests/gate/verdict.test.ts`

**Interfaces:**
- Consumes: `Rule`, `Answer`, `Verdict`, `Note`, `Facts`.
- Produces:

```ts
// text.ts
export function words(text: string): string[];                    // minúsculas, sin puntuación ni marcadores de lista
export function similarity(a: string, b: string): number;         // Jaccard sobre conjuntos de trigramas de palabras; 0 si alguno tiene menos de 3 palabras
export function spans(text: string): string[];                    // contenido de cada `…`
export function citedPaths(text: string): string[];               // spans con forma de ruta
export function citedScripts(text: string): { pm: string; script: string }[]; // `npm run x`, `pnpm x`, `npm test`…
export const ABSOLUTE: RegExp;   // never|always|under no circumstances|nunca|siempre|jamás, como palabra, sin distinguir mayúsculas
export function hasReason(text: string): boolean;                 // because|since|so that|or (they|it)…|porque|para que|ya que, o texto tras ";" o "—"
export function hasAnchor(text: string, techNames: readonly string[]): boolean; // span, ruta, identificador camelCase/snake_case/con punto, o tecnología conocida
export function ruleHash(text: string): string; // sha256 de normalize(text) sin el marcador de lista inicial; primeros 16 hex
// verdict.ts
export interface Context { readonly accepted: ReadonlyMap<string, Answer>; readonly techNames: readonly string[] }
export type Check = (rule: Rule, facts: Facts) => Answer | null;
export const CHECKS: readonly Check[];   // orden fijo; vacío en esta tarea, se llena en las tareas 4 a 7
export function judge(rule: Rule, facts: Facts, ctx: Context, checks?: readonly Check[]): Verdict;
export function judgeAll(rules: readonly Rule[], facts: Facts, ctx: Context): Verdict[];
export const interrupts = (v: Verdict): boolean => v.verdict !== 'keep';
```

`citedPaths`: un span es ruta si no tiene espacios, no empieza por un esquema (`https:`), no contiene `*`, `?`, `{`, `<`, y contiene `/` o termina en una extensión de 1 a 5 letras. Las `\` se convierten a `/` antes de comparar.

`judge`: fuera de un repo (`!facts.inRepo`) solo se aplican las preguntas 3 y 7. Si el hash de la regla está en `ctx.accepted`: `keep` con nota `accepted` y `original`. Si ningún check responde: `keep`, con `no-evidence` siempre en esta fase salvo que la regla contenga una tecnología de `techNames` o un script o ruta que exista; `no-anchor` si `!hasAnchor`; `absolute-no-reason` si casa `ABSOLUTE`, no hay spans y `!hasReason`. Los encabezados que salen `keep` no llevan notas.

- [ ] **Step 1: Tests que fallan:**

```ts
test('similarity ignores repetition and case', () => {
  assert.equal(similarity('Ledger tracks invoices and payments.', 'ledger tracks invoices and payments ledger tracks invoices and payments'), 1);
  assert.ok(similarity('run the unit tests first', 'deploy to the staging cluster') < 0.1);
});
test('citedPaths skips urls, globs and versions, accepts backslashes', () => {
  assert.deepEqual(citedPaths('see `https://x.dev/a`, `src/**/*.ts`, `v2.1/3 beta`, `src\\money.js`'), ['src/money.js']);
});
test('no check answers: keep with notes', () => {
  const v = judge(rule('- All money values are integer cents; never floats.'), facts, ctx, []);
  assert.equal(v.verdict, 'keep'); assert.deepEqual([...v.notes].sort(), ['absolute-no-reason', 'no-anchor', 'no-evidence']);
});
test('a reason clears absolute-no-reason', () => {
  assert.ok(!judge(rule('- Never use floats for money because they lose cents.'), facts, ctx, []).notes.includes('absolute-no-reason'));
});
test('first answering check wins and later ones do not run', () => { /* dos checks falsos; el segundo lanza si se llama */ });
test('an accepted rule is kept with its original answer', () => { /* ctx.accepted con el hash */ });
test('outside a repo only questions 3 and 7 apply', () => { /* check con question 1 no se llama */ });
```

- [ ] **Step 2:** `npm test` → fallan.
- [ ] **Step 3:** Implementar. `judge` busca en `ctx.accepted` con `ruleHash(rule.text)`; la tarea 8 reutiliza esa función.
- [ ] **Step 4:** `npm run check` → pasa.
- [ ] **Step 5:** Commit: `Add the verdict pipeline and its notes`.

### Task 4: Pregunta 1, inferible del repo

**Files:**
- Create: `hooks/gate/tables/alias.ts`, `hooks/gate/checks/q1.ts`, `tests/gate/q1.test.ts`
- Modify: `hooks/gate/verdict.ts` (añadir `q1` a `CHECKS`)

**Interfaces:**
- Produces:

```ts
// tables/alias.ts
export const AS_OF = '2026-11-12';
export interface Tech {
  readonly name: string; readonly aliases: readonly string[];
  readonly category: 'language' | 'framework' | 'test-runner' | 'bundler' | 'package-manager' | 'linter' | 'formatter' | 'orm' | 'runtime';
  readonly packages?: readonly string[]; readonly lockfile?: string; readonly language?: string;
  readonly replacesDefault?: true;   // pnpm, yarn, bun
}
export const TECH: readonly Tech[];
export const OBVIOUS_SCRIPTS: readonly string[]; // test, build, lint, dev, start, format, typecheck
export const AFFIRM: readonly RegExp[];          // plantillas en/es: "we use", "built with", "written in", "usamos", "hecho con", "escrito en"…
export const NEGATION: RegExp;                   // not|don't|never|instead of|rather than|no |nunca|en vez de|en lugar de
// checks/q1.ts
export const q1: Check;
```

Contenido inicial de `TECH`: al menos 40 entradas del ecosistema Node (referencia: los alias de ctxlint, MIT), más los lenguajes de `Facts.languages`.

Reglas de decisión, en este orden:
- `inferable-title`: regla `heading`, o primer `paragraph` del archivo, cuyas palabras incluyen `pkg.name`, o con `similarity > 0.8` frente al primer párrafo del README.
- `inferable-tree`: regla `code` con `├` o `└`; o lista en la que 3 o más elementos empiezan por una ruta existente en `files` seguida de una descripción sin verbo en imperativo.
- `inferable-script`: un único span, que es `<pm> run <s>` o `<pm> <s>` con `s` en `OBVIOUS_SCRIPTS` y en `pkg.scripts`, y como mucho 4 palabras fuera del span.
- `inferable-tech`: casa una plantilla de `AFFIRM`, no casa `NEGATION`, todas las tecnologías mencionadas están presentes (por paquete, lockfile o lenguaje), ninguna es `replacesDefault`, cada una es la única presente de su categoría (para `language`, la primera de `languages`), y quedan como mucho 3 palabras tras quitar plantilla y nombres.
- `inferable-overview`: `paragraph` de 2 o más frases, sin spans ni rutas, con `similarity > 0.8` frente a un párrafo del README.

- [ ] **Step 1: Tests que fallan** (cada uno con `repo({...})` y `q1(rule, facts)`):

```ts
// React único framework → cut inferable-tech, evidence "package.json: dependencies.react"
// "Use pnpm, not npm." con pnpm-lock.yaml → null
// "Use pnpm." con pnpm-lock.yaml → null (replacesDefault)
// "We use Jest." con jest y vitest en deps → null (dos de la categoría)
// "Don't use Express for new routes." → null (negación)
// "Use React Query for all server state, never useEffect fetches." → null (más de 3 palabras restantes)
// "- Lint: `npm run lint`" con script lint → cut inferable-script
// "- Run a single test: `npm test -- money`" → null (argumentos)
// "- Generate schema: `npm run gen`" → null (gen no es obvio)
// "# Ledger - Project Instructions for Claude" con name ledger → cut inferable-title
// el bloque "Directory structure" de evals/cases/c14-themis-audit/fixture/CLAUDE.md → cut inferable-tree
// párrafo de 2 frases copiado del README → cut inferable-overview; con un span dentro → null
```

- [ ] **Step 2:** `npm test` → fallan.
- [ ] **Step 3:** Implementar tabla y check; registrar en `CHECKS`.
- [ ] **Step 4:** `npm run check` → pasa.
- [ ] **Step 5:** Commit: `Gate question 1: rules the repository already reveals`.

### Task 5: Pregunta 2, ya impuesto por una herramienta

**Files:**
- Create: `hooks/gate/tables/lint-map.ts`, `hooks/gate/checks/q2.ts`, `tests/gate/q2.test.ts`
- Modify: `hooks/gate/verdict.ts`

**Interfaces:**
- Produces:

```ts
export interface LintRule { readonly id: string; readonly pattern: RegExp; readonly tool: Tool; readonly key: string; readonly value: unknown }
export const LINT_MAP: readonly LintRule[];
export const q2: Check;
```

Cada intención tiene una entrada por valor: `semi-on` (`prettier.semi`, `true`) y `semi-off` (`prettier.semi`, `false`). Contenido inicial: al menos 30 entradas en inglés y español que cubran prettier (`semi`, `singleQuote`, `tabWidth`, `useTabs`, `trailingComma`, `printWidth`), editorconfig (`indent_style`, `indent_size`, `end_of_line`), tsconfig (`strict`, `noImplicitAny`, `noUnusedLocals`), eslint en `.eslintrc.json` (`quotes`, `semi`, `no-var`, `prefer-const`, `eqeqeq`, `no-console`) y commitlint (`extends` conventional). Referencia: `src/detectors/config-overlap.ts` de instrlint (MIT).

Decisión para una regla que casa `pattern`:
- `config.get(key)` igual a `value` y `runs.has(tool)` → `cut`, `enforced-config`, evidencia `"<archivo>: <clave> = <valor>; run by <dónde>"`.
- `config.get(key)` definido y distinto → `conflict`, `config-conflict`.
- No definido, o definido sin prueba de ejecución → `null`.
- Las entradas con `tool: 'editorconfig'` nunca cortan; solo pueden dar `conflict`.

`enforced-deny`: la regla casa `ABSOLUTE` o una negación, tiene un span de comando, y alguna entrada de `deny` de la forma `Bash(<prefijo>…)` tiene un prefijo (sin `:*` ni `*` finales) con el que empieza el span → `cut`.

- [ ] **Step 1: Tests que fallan:**

```ts
// "Use semicolons." + .prettierrc semi:true + script "prettier --check ." → cut enforced-config
// "Use semicolons." + .prettierrc semi:false + script → conflict config-conflict
// "Use semicolons." + .prettierrc semi:true, nadie ejecuta prettier → null
// "Use semicolons." + prettier.config.js (unreadable) → null
// "Usa comillas simples." + package.json {"prettier":{"singleQuote":true}} + husky que llama a prettier → cut
// "Enable strict mode." + tsconfig strict:true → cut (tsc siempre cuenta)
// "Indent with 2 spaces." + .editorconfig indent_size=4 → conflict; con indent_size=2 → null
// "Never run `git push --force`." + deny ["Bash(git push --force:*)"] → cut enforced-deny
// "Never run `git push --force`." sin deny → null
```

- [ ] **Step 2 a 5:** fallan → implementar y registrar tras `q1` → `npm run check` → commit `Gate question 2: rules a tool already enforces`.

### Task 6: Pregunta 3, frases genéricas, relleno y declaradas por el proveedor

**Files:**
- Create: `hooks/gate/tables/phrases.ts`, `hooks/gate/checks/q3.ts`, `tests/gate/q3.test.ts`
- Modify: `hooks/gate/verdict.ts`

**Interfaces:**
- Produces:

```ts
export interface Phrase {
  readonly pattern: RegExp; readonly group: 'generic' | 'filler' | 'vendor';
  readonly source?: { readonly url: string; readonly models: readonly string[]; readonly retrieved: string }; // obligatorio en vendor
}
export const PHRASES: readonly Phrase[];
export const q3: Check;
```

Una regla se corta solo si, tras quitar las frases que casan, quedan como mucho 3 palabras: «Write clean code» se corta; «Write clean code: no function over 40 lines in `src/core/`» no. Una regla con un span o una ruta nunca se corta por esta pregunta.

Contenido inicial:
- `generic` (en/es): al menos todas las líneas de «General guidelines» y «Notes» del fixture c14, más las listas de «What does not belong» de la skill actual.
- `filler`: «this file (gives|provides) … (context|guidance)», «keep (it|this file) updated», y equivalentes en español.
- `vendor`: solo frases que una guía vigente de Anthropic u OpenAI pide quitar y que ninguna guía de la otra familia recomienda. Tomarlas de las notas de investigación sobre modelos recientes (guardadas fuera del repositorio) con su URL exacta; como mínimo «think step by step» y «think carefully» y sus equivalentes en español. No incluir «delegate to subagents», «be concise» ni «always run tests».

- [ ] **Step 1: Tests que fallan:**

```ts
// cada línea de "General guidelines" de c14 → cut; "Think step by step…" → vendor-declared, el resto generic-advice
// "This file gives Claude context about the Ledger project…" → cut file-filler
// "Remember to keep the code quality high and to communicate clearly about changes." (repetida 25 veces en una línea) → cut generic-advice
// "Escribe código limpio y maneja los errores." → cut generic-advice
// "Write clean code: no function over 40 lines in `src/core/`." → null
// "Handle errors with `AppError` from src/errors.js." → null
// toda entrada vendor tiene source.url que empieza por https:// y source.retrieved con formato AAAA-MM-DD
```

- [ ] **Step 2 a 5:** fallan → implementar y registrar tras `q2` → `npm run check` → commit `Gate question 3: generic, filler and vendor-declared phrases`.

### Task 7: Preguntas 5, 6 y 7

**Files:**
- Create: `hooks/gate/checks/q5.ts`, `q6.ts`, `q7.ts`, `tests/gate/q567.test.ts`
- Modify: `hooks/gate/verdict.ts` (orden final: q1, q2, q3, q5, q6, q7)

**Interfaces:**
- Produces: `export const q5: Check; export const q6: Check; export const q7: Check;`

Decisiones:
- **q5** `absolute-command`: casa `ABSOLUTE` y tiene al menos un span que es un comando (contiene un espacio, o es un script citado) o una ruta citada → `move`, `target: 'permissions.deny or a hook'`.
- **q6** `long-procedure`: regla `steps` con más de 5 elementos, o cualquier regla con `lines > 8` → `move`, `target: 'a skill or a doc, with a one-line pointer'`. `duplicated-passage`: `lines >= 3` y `similarity > 0.8` con un párrafo de `docs` → `move`, `target` = ese archivo.
- **q7** `dead-reference` (`fix`): una ruta de `citedPaths` que no está en `files` ni existe en disco resuelta desde `dir` ni desde `root`; o un script de `citedScripts` que no está en `pkg.scripts` (salvo `install`, `ci`, `test`, `start`, que npm trae). `emphasis` (`rewrite`): contiene `IMPORTANT`, `CRITICAL`, `MUST`, `NEVER`, `ALWAYS`, `IMPORTANTE`, `CRÍTICO`, `NUNCA`, `SIEMPRE` en mayúsculas como palabra, fuera de un span. `dead-reference` tiene prioridad sobre `emphasis`.

- [ ] **Step 1: Tests que fallan:**

```ts
// "Never run `npm publish` locally." → q5 move absolute-command
// "All money values are integer cents; never floats." → q5 null
// "Do not edit src/generated/ by hand." (sin marcador absoluto) → q5 null
// lista numerada de 6 pasos → q6 long-procedure; de 5 → null
// bloque de 4 líneas copiado de docs/CONVENTIONS.md → q6 duplicated-passage con target docs/CONVENTIONS.md
// una línea que también está en docs → q6 null (los gotchas se quedan)
// "- Run unit tests: `npm run test:unit`" sin ese script → q7 fix dead-reference
// "See `src/missing.js`." → fix; "See `src\\money.js`." existente → null
// "`https://x.dev/a`", "`src/**/*.ts`", "`v2.1/3 beta`" → q7 null
// "- IMPORTANT: Use arrow functions where appropriate." → rewrite emphasis
// "Set `NODE_ENV=IMPORTANT`" → null (dentro de un span)
```

- [ ] **Step 2 a 5:** fallan → implementar y registrar → `npm run check` → commit `Gate questions 5 to 7: absolutes, long passages and form`.

### Task 8: Reglas aceptadas y pendientes

**Files:**
- Create: `hooks/gate/accepted.ts`, `tests/gate/accepted.test.ts`

**Interfaces:**
- Consumes: `ruleHash`, `Answer`, `Verdict`.
- Produces:

```ts
export const ACCEPTED_FILE = '.claude/themis-accepted.json';
export function loadAccepted(root: string): Map<string, Answer>;      // archivo ausente o inválido → mapa vacío
export function recordAccepted(root: string, verdicts: readonly Verdict[], date: string): void; // solo los que interrumpen
export function pruneAccepted(root: string, liveHashes: ReadonlySet<string>): number;           // devuelve cuántas quitó
export function pendingKey(sessionId: string, file: string, toolInput: unknown): string;        // sha256
export function writePending(key: string, hashes: readonly string[]): void; // os.tmpdir()/themis-gate/<key>.json; borra los de más de 24 h
export function takePending(key: string): string[] | null;                  // lee y borra
```

Formato del archivo, con claves ordenadas y salto de línea final para que los diffs sean estables:

```json
{ "version": 1, "rules": { "3f2a9c1b7d4e6a80": { "verdict": "cut", "code": "generic-advice", "question": 3, "evidence": "phrases: clean code", "date": "2026-11-12" } } }
```

- [ ] **Step 1: Tests que fallan:**

```ts
// recordAccepted + loadAccepted devuelven la misma Answer; un veredicto keep no se guarda
// el mismo texto con CRLF, con "-  " o con "* " da el mismo hash; cambiar una palabra da otro
// escribir dos veces en distinto orden produce el mismo archivo byte a byte
// archivo con JSON inválido → loadAccepted devuelve mapa vacío y recordAccepted lo reescribe
// pruneAccepted quita solo los hashes ausentes y devuelve la cuenta
// takePending devuelve los hashes una vez y null la segunda
```

- [ ] **Step 2 a 5:** fallan → implementar → `npm run check` → commit `Remember rules the user accepted`.

### Task 9: CLI, formato, corpus de regresión y pruebas de propiedades

**Files:**
- Create: `hooks/gate/format.ts`, `hooks/gate.ts`, `tests/gate/cli.test.ts`, `tests/gate/corpus.test.ts`, `tests/gate/corpus.jsonl`, `tests/gate/repos/` (repos de ejemplo adicionales)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:

```ts
// format.ts
export function formatAsk(verdicts: readonly Verdict[], fileName: string): string;
export function formatNotes(verdicts: readonly Verdict[]): string;       // '' si no hay notas
export function formatAudit(verdicts: readonly Verdict[]): string;       // tabla Markdown + línea de cobertura
export interface Metrics { interrupted: number; precision: number | null; falseCut: number | null; coverage: number; byVerdict: Record<string, { n: number; correct: number }> }
export function metrics(cases: readonly { expect: VerdictKind; got: Verdict }[]): Metrics;
// gate.ts (CLI, se compila a hooks/dist/gate.js)
//   gate check  [--file <ruta>] [--json]   Markdown por stdin; --file fija el repo (por defecto ./CLAUDE.md)
//   gate audit  <archivo> [--json] [--prune]
//   gate report <corpus.jsonl> [--json]
// Código de salida 0 siempre que la entrada sea válida; 2 con uso incorrecto.
```

Texto exacto de `formatAsk` (inglés, lo ve el usuario):

```
themis: <n> of <m> new rules in <fileName> may not be needed.

  "<primera línea de la regla, máx. 100 caracteres>"
  <verdict> · <code> · question <q>
  <evidence>[ → <target>]

Approve to add them as written; themis will remember the choice. Deny to drop the edit.
```

Cobertura: reglas con veredicto distinto de `keep`, o `keep` sin la nota `no-evidence`, sobre el total (sin contar encabezados).

Formato de un caso de corpus (una línea JSON):

```json
{"id":"c14-12","repo":"evals/cases/c14-themis-audit/fixture","file":"CLAUDE.md","rule":"- Write clean, readable and maintainable code.","expect":"cut","code":"generic-advice"}
```

`repo` es una ruta relativa a la raíz de themis; el test copia ese directorio a un temporal con `git init` antes de leer hechos. `code` es opcional cuando `expect` es `keep`.

Contenido obligatorio de `corpus.jsonl` (150 casos o más, inglés y español):
- Todas las reglas de `evals/cases/c14-themis-audit/fixture/CLAUDE.md`. Esperado: título, árbol, las diez líneas de «General guidelines», «About this file» y «Notes» → `cut`; `npm run test:unit` → `fix`; `npm run lint` → `cut`; `npm run gen`, las tres líneas de «Important» → `keep`; las seis líneas `IMPORTANT:` de «Style» → `rewrite`. Los dos párrafos de «Overview» se etiquetan según lo que diga el README del fixture: `cut` si casan `inferable-overview` o `inferable-tech`, `keep` si no.
- Todas las reglas de `evals/cases/c15-cap/fixture/CLAUDE.md`. Las que casan alguna de las 10 expresiones `KEYS` de `evals/cases/c15-cap/grade.ts` deben ser `keep`.
- Los casos de los tests unitarios de las tareas 4 a 7, y al menos 5 casos por código de razón.

- [ ] **Step 1: Tests que fallan:**

```ts
// corpus.test.ts
test('every corpus case gets its expected verdict and code', …);
test('the corpus has at least 150 cases and every reason code at least 5', …);
test('two runs, the second in reverse order, give identical output', …); // JSON.stringify de judgeAll
test('judging the largest fixture takes under 200 ms', …);               // readFacts + judgeAll en proceso, performance.now()
test('a 20,000-character single-line rule is judged in under 200 ms', …);
// cli.test.ts (ejecuta hooks/dist/gate.js)
test('check reads markdown on stdin and prints one verdict per rule', …);
test('check --json is parseable and has verdict, code, question, evidence, notes', …);
test('audit prints the coverage line and --prune drops stale accepted entries', …);
test('report prints precision, false-cut rate and coverage', …);
test('unknown subcommand exits 2', …);
```

- [ ] **Step 2:** `npm test` → fallan.
- [ ] **Step 3:** Implementar `format.ts` y `gate.ts`; escribir el corpus. Si un caso de c14 o c15 no sale como se espera, se corrige la tabla o el check, no la etiqueta.
- [ ] **Step 4:** `npm run check` → pasa.
- [ ] **Step 5:** Commit: `Add the gate CLI and its regression corpus`.

### Task 10: Integración en los hooks

**Files:**
- Modify: `hooks/lib.ts` (`HookInput` gana `session_id: string | undefined` y `permission_mode: string | undefined`), `hooks/pre-tool.ts`, `hooks/parity.ts`, `.claude-plugin/plugin.json`, `tests/hooks.test.ts`

**Interfaces:**
- Consumes: `newRules`, `readFacts`, `judgeAll`, `interrupts`, `loadAccepted`, `recordAccepted`, `pendingKey`, `writePending`, `takePending`, `formatAsk`, `formatNotes`, `option`.

Decisiones:
- Opción `gate` en `userConfig`: tipo `string`, valores `ask`, `report`, `off`, **por defecto `report`** (la tarea 12 decide si pasa a `ask`). Título: «Rule gate». Descripción: «What themis does when a new rule in CLAUDE.md or AGENTS.md is inferable from the repo, already enforced, generic or badly formed: ask (confirm with you), report (tell Claude, do not interrupt) or off.»
- `pre-tool.ts`: nueva `checkGate`, llamada solo si `checkCap` y `checkParity` no decidieron nada. Con `gate=off` no hace nada. Calcula `newRules(read(file), applyEdits(file, input))`.
  - Ninguna interrumpe: si hay notas, emite `additionalContext` con `formatNotes`.
  - Alguna interrumpe y el modo efectivo es `ask`: `writePending(...)` con los hashes que interrumpen y `decide('ask', formatAsk(...))`.
  - Alguna interrumpe y el modo efectivo es `report`: `additionalContext` con `formatAsk` más la frase «Not blocked. Drop or fix these rules unless the user asked for them as written.»
- Modo efectivo: `report` si `gate=report`, o si `permission_mode` es `dontAsk` o `bypassPermissions`. Antes de escribir el código, leer la referencia de hooks vigente (`https://code.claude.com/docs/en/hooks`) y confirmar: el nombre del campo de modo, sus valores, y si la entrada distingue una sesión `-p` o un subagente. Si existe un campo para eso, esos casos también son `report`. Anotar en un comentario la versión de la documentación consultada.
- `parity.ts`, en `PostToolUse` sobre un archivo de reglas y antes de la copia al gemelo: `takePending(pendingKey(session_id, file, tool_input))`. Si hay pendientes, vuelve a evaluar las reglas del archivo, y llama a `recordAccepted` con los veredictos cuyo hash está en la lista. La fecha es la del día en UTC.
- `CLAUDE.local.md` pasa por el filtro; los archivos dentro de `~/.claude` y de los directorios de política (los `OWN_DIRS` de `lib.ts`) solo reciben las preguntas 3 y 7, porque `inRepo` es falso.

- [ ] **Step 1: Tests que fallan** en `tests/hooks.test.ts`, con el estilo existente (`pre`, `post`, `project`, variables `CLAUDE_PLUGIN_OPTION_GATE`):

```ts
// gate=ask: Write con "- Write clean code." → decision 'ask', reason contiene 'generic-advice'
// gate=ask: Write solo con un gotcha válido → sin decisión
// gate por defecto (report): la misma escritura → sin decisión, context contiene 'generic-advice' y 'Not blocked'
// gate=off → sin salida
// gate=ask + permission_mode 'dontAsk' → sin decisión, context con el veredicto
// Edit que añade una regla marcada a un archivo con otras reglas marcadas ya presentes → reason nombra solo la nueva ("1 of 1")
// un archivo sobre el tope sigue dando 'deny' por el tope, sin texto del filtro
// tras un ask: post() con el mismo session_id y tool_input crea .claude/themis-accepted.json con ese hash;
//   una segunda escritura de la misma regla ya no da 'ask'
// post() sin pendiente no crea el archivo
// el manifiesto declara userConfig.gate con default 'report'
```

- [ ] **Step 2:** `npm run build && npm test` → fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm run check` → pasa; los tests que ya existían en `tests/hooks.test.ts` siguen pasando sin modificarlos.
- [ ] **Step 5:** Commit: `Run the gate on every edit of a rule file`.

### Task 11: Skill

**Files:**
- Modify: `skills/themis/SKILL.md`, `tests/hooks.test.ts` (si hay tests que lean la skill)

Antes de editar, confirmar en la documentación vigente de skills (`https://code.claude.com/docs/en/skills`) qué variable se sustituye en el cuerpo de una skill de plugin. Usar `${CLAUDE_PLUGIN_ROOT}/hooks/dist/gate.js` si está documentada para skills; si no, `${CLAUDE_SKILL_DIR}/../../hooks/dist/gate.js`. En lo que sigue, `GATE` es esa ruta.

Cambios exactos:
- La `description` del frontmatter no cambia.
- Sustituir las secciones «What belongs» y «What does not belong» por una sección «The gate» de 12 líneas como máximo: qué decide el script (los seis grupos de códigos de razón, una línea cada uno), que su veredicto es el criterio y que no se cortan por criterio propio las reglas que deja pasar, y el significado de `keep`, `cut`, `move`, `rewrite`, `fix`, `conflict` y de las notas.
- **edit**, paso 2: «Pipe the new lines to `node GATE check --file <target>`. Write only the rules it keeps. For each other rule, tell the user the verdict and its evidence in one line and offer the alternative it names; write it as given only if the user insists, and themis will ask them to confirm.»
- **audit**, paso 2: «Run `node GATE audit <file> --prune` and show its table. Do not add cuts of your own. Check nothing by hand that the table already covers.» El paso 3 añade: quitar los encabezados cuya sección queda vacía.
- **init**, paso 3: redactar y pasar el borrador por `gate check` antes de mostrarlo; solo se escriben las reglas `keep`.
- **sync** no cambia.
- La skill completa no supera los 6 500 caracteres.

- [ ] **Step 1: Test que falla:** en `tests/hooks.test.ts`, `the skill tells every mode to run the gate`: el archivo contiene `gate.js check` y `gate.js audit`, no contiene `## What does not belong`, y mide 6 500 caracteres o menos.
- [ ] **Step 2 a 4:** falla → editar la skill → `npm run check`.
- [ ] **Step 5:** Commit: `Make the skill defer to the gate`.

### Task 12: Corpus de validación, etiquetado y decisión del modo por defecto

**Files:**
- Create: `tests/gate/holdout.jsonl`, `tests/gate/holdout/<repo>/…`, `tests/gate/holdout/SOURCES.md`
- Modify: `.claude-plugin/plugin.json` y `tests/hooks.test.ts` (solo si se cumple la condición), `RESULTS.md`

Esta tarea no es TDD: recoge datos y tiene un punto de control humano. Las tablas y los checks quedan congelados desde el commit de la tarea 11; si la medición lleva a cambiarlos, hay que recoger un corpus nuevo.

- [ ] **Step 1: Recoger.** Con las herramientas web de Svipall o `gh`, tomar `CLAUDE.md` o `AGENTS.md` de repos públicos de Node/TypeScript con licencia MIT, Apache-2.0, BSD o ISC, hasta reunir al menos 800 reglas de 40 repos o más (para esperar 100 interrupciones). Excluir los repos que se usaron como referencia para las tablas. Por repo, guardar en `tests/gate/holdout/<repo>/`: el archivo de reglas, `package.json`, los archivos de configuración que lee `readFacts`, `README.md`, `.claude/settings.json` si existe, y `files.txt` con la salida de `git ls-files` en el commit tomado. `SOURCES.md` lista URL, commit y licencia de cada uno.
- [ ] **Step 2: Soporte de `files.txt`.** `corpus.test.ts` y `gate report` pasan `override.files` a `readFacts` cuando el repo del caso tiene `files.txt`. Test: un caso con `files.txt` no marca `dead-reference` para una ruta listada ahí.
- [ ] **Step 3: Etiquetar.** Lanzar un agente nuevo con este encargo, sin darle acceso a `hooks/gate/`, a `tests/gate/corpus.jsonl` ni a ninguna salida del filtro: recibe cada regla, el snapshot de su repo y las definiciones de los seis veredictos tal como aparecen en la sección «Las siete preguntas» de la spec; devuelve `expect` por regla y una frase de motivo. Escribir `holdout.jsonl` con el formato de la tarea 9 más el campo `why`.
- [ ] **Step 4: Medir.** `node hooks/dist/gate.js report tests/gate/holdout.jsonl`. Guardar la salida.
- [ ] **Step 5: Punto de control con el usuario.** Presentarle 30 etiquetas al azar y todos los casos en que el filtro interrumpe y la etiqueta es `keep`. Corregir las etiquetas que el usuario cambie y volver a ejecutar `report`. No tocar tablas ni checks.
- [ ] **Step 6: Decidir.** Si la precisión de interrupción es de 95 % o más sobre 100 o más reglas interrumpidas: cambiar el valor por defecto de `gate` a `ask` en `plugin.json`, en `option('gate', …)` y en sus tests. Si no: dejar `report`.
- [ ] **Step 7:** `RESULTS.md`: sección «Rule gate» con tamaño del corpus, precisión global y por veredicto, tasa de corte falso, cobertura, quién etiquetó y qué revisó el usuario, la condición y si se cumplió. Decir que los evals de sesión c13 a c15 no se repitieron con el filtro.
- [ ] **Step 8:** `npm run check`; commit: `Measure the gate on a held-out corpus`.

### Task 13: Documentación y versión

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `.claude-plugin/plugin.json`, `.github/workflows/ci.yml`, `docs/superpowers/specs/2026-11-12-filtro-de-reglas-design.md` (estado → implementado, fase 1)

- [ ] **Step 1:** CI, job `node18`: añadir un paso que ejecute `printf -- '- Write clean code.\n' | node hooks/dist/gate.js check --json` en un directorio temporal y compruebe `"verdict":"cut"`.
- [ ] **Step 2:** `README.md`: sección «The rule gate» con las seis preguntas activas, los tres modos, el archivo `.claude/themis-accepted.json`, los comandos del CLI y los límites (solo Node, inglés y español, la pregunta sobre el comportamiento del modelo aún no activa).
- [ ] **Step 3:** Versión `2.2.0` en `package.json`, `package-lock.json` y `plugin.json`; entrada en `CHANGELOG.md`.
- [ ] **Step 4:** `npm run check` → pasa; `git status --porcelain -- hooks/dist` vacío tras el build.
- [ ] **Step 5:** Commit: `Document the rule gate and release 2.2.0`. No crear la etiqueta ni el PR: eso lo pide el usuario.
