# Filtro de reglas, fase 1.1 (cobertura): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir la detección de reglas redundantes con cinco detectores por script y validarlos a ciegas en un corpus nuevo.

**Architecture:** Los detectores se añaden a `hooks/gate/checks/q1.ts` (y la plantilla de `/init` a `tables/phrases.ts` / `q3.ts`), reutilizando el resolvedor de rutas de `q7.ts` y los hechos de `facts.ts`. Un segundo corpus (`tests/gate/holdout2*`) se recoge sin ver los detectores y se mide con `gate report` una vez congelados.

**Tech Stack:** el de la fase 1 (TypeScript estricto, `node --test`, `hooks/dist` versionado, sin dependencias en ejecución).

**Spec:** `docs/superpowers/specs/2026-11-13-filtro-de-reglas-cobertura-design.md` (y, para todo lo demás, `2026-11-12-filtro-de-reglas-design.md`).

## Global Constraints

- Las de la fase 1 siguen vigentes: sin dependencias en ejecución; `hooks/dist/` se reconstruye en cada commit que toque `hooks/`; `npm run check` verde; los hooks fallan en silencio; el filtro nunca devuelve `deny`; mismo texto + mismo repo + mismas tablas → mismo veredicto; menos de 200 ms en proceso; inglés en código y mensajes; sin líneas `Claude-Session:`.
- Marcar una regla que lleva información real es el fallo más caro. Ante la duda, un detector devuelve `null`. Cada detector nuevo lleva tests que prueban que NO marca reglas informativas.
- Ningún patrón con huecos abiertos: vocabularios cerrados o diccionarios sacados del repo.
- El valor por defecto de `gate` no cambia en este plan salvo en la tarea 3 y solo si se cumple la condición.
- Rama `gate-phase-1`.

## Review Focus

1. **Descripción que esconde un aviso.** «`src/db/` — schema, applied by the migrator at boot» no usa ninguna palabra de las listas y dice algo que el modelo necesita. Test en la tarea 1: los detectores 2 y 3 se abstienen ante descripciones con verbos de efecto (applied, loaded, required, must, needs, overrides, shared by…) según la lista cerrada que se defina.
2. **Dependencia homónima de una palabra corriente.** `express`, `debug`, `colors`, `ms`, `next` como palabras de prosa en una lista no deben contar como dependencias salvo en mayúscula inicial, entre comillas invertidas o en una lista cuyos demás segmentos son todos dependencias.
3. **Script cuyo comando contiene palabras genéricas.** Un script `"deploy": "node scripts/deploy.js --env production"` no autoriza a cortar «`npm run deploy` deploys to production; ask first». Test.
4. **Resumen con una frase nueva.** Un párrafo que repite el README en un 85 % y añade «the admin UI lives in another repo» se conserva. Test.
5. **Repos sin `package.json` o con manifiesto roto.** Los detectores 3, 4 y 5 devuelven `null` sin lanzar. Test.

---

### Task 1: Los cinco detectores

**Files:**
- Modify: `hooks/gate/checks/q1.ts`, `hooks/gate/checks/q3.ts`, `hooks/gate/checks/q7.ts` (exportar el resolvedor de rutas si no lo está), `hooks/gate/tables/phrases.ts`, `hooks/gate/tables/alias.ts`, `hooks/gate/facts.ts` (añadir a `Facts.pkg`: `description: string | null`, `versions: Readonly<Record<string, string>>` con el rango de cada dependencia, y `scripts` ya existe), `hooks/gate/types.ts` si hace falta
- Create: `tests/gate/coverage.test.ts`; casos nuevos en `tests/gate/corpus.jsonl` y repos de ejemplo en `tests/gate/repos/`
- Modify: `skills/themis/SKILL.md` (una línea: los grupos de razones incluyen rutas descritas y listas de stack), `README.md` (sección del filtro)

**Interfaces:**
- Consumes: `Check`, `Facts`, `Rule`, `Answer`; `IMPERATIVE`, `NEGATION`, `ABSOLUTE`, palabras de tiempo; el resolvedor de rutas de q7; `onlyConnectives`, `words`, `spans`.
- Produces: códigos de razón nuevos `inferable-path`, `inferable-stack`, `stale-version` (veredicto `conflict`); los existentes `file-filler`, `inferable-script`, `inferable-overview` amplían su alcance. Una función exportada por detector en `q1.ts`: `describedPath`, `stackList`, `describedScript`, `projectOverview` (cada una `Check`), llamadas desde `q1` después de las comprobaciones existentes y en ese orden.

Reglas exactas: la tabla «Los cinco detectores» de la spec, con sus abstenciones. Umbrales fijados: descripción ≤ 25 palabras (detectores 2 y 3); resumen con ≥ 6 palabras de contenido y ≥ 80 % contenidas (detector 5); versión comparada por número mayor (detector 3b).

- [ ] **Step 1: Tests que fallan** en `tests/gate/coverage.test.ts`. Como mínimo, con repos `repo({...})`:

```ts
// detector 1
// "# CLAUDE.md" → cut file-filler; "# AGENTS.md" → cut; "# CLAUDE.md — payments rules" → null
// "This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository." → cut file-filler
// la misma frase seguida de "Always run migrations first." en la misma regla → null
// detector 2
// "- `lib/nvidia.js` — Executes nvidia-smi and parses CSV output" (archivo existe) → cut inferable-path
// "- **TrackingCache** (lib/tracking-cache.js:5): In-memory LRU cache" (existe) → cut inferable-path
// "- `src/generated/` — generated by `npm run gen`" → null (palabra de estado y comando)
// "- `src/db/` — schema, applied by the migrator at boot" → null (verbo de efecto)
// "- `src/legacy/` — legacy billing code" → null
// "- `src/api/` — do not import from here" → null
// "- `src/missing.ts` — helpers" (no existe) → q1 null (q7 lo trata)
// descripción de 26 palabras → null
// detector 3
// "- Jest (unit + integration), ESLint + Prettier, Husky pre-commit" con las cuatro en devDependencies → cut inferable-stack
// "**Stack**: Next.js 15 · React 19 · Tailwind CSS · TypeScript" con next ^15, react ^19, tailwindcss, typescript → cut inferable-stack
// la misma con "React 18" y react ^19 en el manifiesto → conflict stale-version, evidence nombra ambas versiones
// "- Zod for all request validation" (zod en deps) → null (no es lista; lleva instrucción implícita "for all")
// "- **tsconfig-paths**: TypeScript path mapping support" (en deps) → cut inferable-stack
// "- **zod**: validate every request body with it" → null
// lista con un segmento que no es dependencia ("…, Stripe webhooks") → null
// "Use debug and colors sparingly" con debug y colors en deps → null (palabras corrientes en prosa)
// sin package.json → null
// detector 4
// "- `npm run test:integration` - Run integration tests with coverage" con script "test:integration": "vitest run --coverage tests/integration" → cut inferable-script
// "- `npm run db:backup` - Create database backup" con "db:backup": "node database/backup.mjs" → cut
// "- `npm run deploy` deploys to production; ask first" → null
// "- `npm run test:integration` needs the Docker stack up" → null
// "- `pnpm build` - Build all apps and packages" con script build → null salvo que "apps" y "packages" estén en el comando del script
// detector 5
// párrafo que repite la description del manifiesto y la intro del README (≥ 80 %) → cut inferable-overview
// el mismo párrafo más "The admin UI lives in another repo." → null
// párrafo de 5 palabras de contenido → null
// rendimiento: 200 reglas variadas sobre un repo de 2.000 archivos en menos de 200 ms
```

- [ ] **Step 2:** `npm test` → fallan.
- [ ] **Step 3:** Implementar. Añadir al corpus de regresión al menos 12 casos por código nuevo o ampliado (6 que se cortan y 6 informativos que se conservan), en inglés y español. Si un caso existente del corpus cambia de veredicto, se revisa con la regla «la etiqueta es lo que querría un mantenedor cuidadoso»: si el corte nuevo es correcto, se actualiza la etiqueta (y se quita su `gap` si lo tenía); si corta una regla informativa, se corrige el detector.
- [ ] **Step 4:** `npm run check` → pasa; `node hooks/dist/gate.js report tests/gate/corpus.jsonl` sin discrepancias. No ejecutar el filtro sobre `tests/gate/holdout2*`.
- [ ] **Step 5:** Commit: `Detect described paths, stack lists, described scripts and overviews`.

### Task 2: Segundo corpus de validación

**Files:**
- Create: `tests/gate/holdout2/sources.json`, `tests/gate/holdout2/SOURCES.md`, `tests/gate/holdout2-unlabelled.jsonl`, `tests/gate/.gitignore`
- Modify: `tests/gate/holdout/collect.mjs` y `unlabel.mjs` (directorio de salida, tope por repo y lista de exclusión como argumentos; guardar `.gitignore`, hasta 30 `package.json` del árbol y el archivo de licencia)

Esta tarea no lee `hooks/gate/checks/`, `hooks/gate/tables/`, `tests/gate/corpus.jsonl` ni ejecuta el filtro.

- [ ] **Step 1:** Parametrizar los scripts de recogida. `tests/gate/.gitignore` ignora `holdout/*__*/` y `holdout2/*__*/` (los snapshots no se versionan).
- [ ] **Step 2:** Recoger con `gh`: mismos criterios que el primer corpus (repos públicos TypeScript/JavaScript con `package.json` en la raíz, licencia MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause o ISC, archivo de reglas en la raíz con 10 reglas o más, candidatos en el orden de la búsqueda, descartes solo por razón objetiva anotada). Excluir los 40 repos de `tests/gate/holdout/sources.json` y los nombres excluidos entonces. Al menos 40 repos, de ellos al menos 15 con `AGENTS.md` como archivo tomado (si un repo tiene ambos, alternar para llegar a ese mínimo y anotarlo). Máximo 40 reglas por repo; parar cerca de 1 000 reglas.
- [ ] **Step 3:** `holdout2-unlabelled.jsonl` con `id`, `repo`, `file`, `rule`, `kind`, `line`. `SOURCES.md` con URL, SHA, licencia, archivo tomado, reglas y la lista de descartes.
- [ ] **Step 4:** Comprobar que `git status` no muestra ningún directorio de snapshot y que no hay archivos llamados `CLAUDE.md` o `AGENTS.md` bajo `tests/gate/` (el archivo de reglas se guarda como `rules.md`).
- [ ] **Step 5:** Commit: `Collect a second held-out corpus`.

### Task 3: Medición, decisión y documentación

**Files:**
- Create: `tests/gate/holdout2.jsonl` (lo entrega el controlador ya etiquetado)
- Modify: `RESULTS.md`, `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json` y `tests/hooks.test.ts` (solo si se cumple la condición, o si el detector 2 queda tras una opción), `hooks/pre-tool.ts` / `hooks/gate/checks/q1.ts` (solo si hace falta la opción `gate_paths`)

- [ ] **Step 1:** `node hooks/dist/gate.js report tests/gate/holdout2.jsonl` con los detectores congelados en el commit que indique el controlador. Guardar la salida. Calcular además la precisión por código de razón y la detección (reglas con etiqueta distinta de `keep` que el filtro interrumpe).
- [ ] **Step 2:** Decidir según la spec: si `inferable-path` queda por debajo del 95 % de precisión, se entrega tras una opción `gate_paths` (booleana, por defecto `false`) y se repite el cálculo sin él. Si la precisión de interrupción global es de 95 % o más sobre 100 o más interrupciones, el valor por defecto de `gate` pasa a `ask`; si no, sigue en `report`.
- [ ] **Step 3:** `RESULTS.md`: subsección del segundo corpus (tamaño, quién etiquetó, números globales y por código, detección, decisión), y nota de que el primer corpus es ahora de desarrollo. `README.md` y `CHANGELOG.md` (entrada 2.2.0) al día, incluidos los códigos nuevos y que los snapshots de terceros no se versionan y se regeneran con `collect.mjs`.
- [ ] **Step 4:** `npm run check` → pasa.
- [ ] **Step 5:** Commit: `Measure the new detectors on a second held-out corpus`.
