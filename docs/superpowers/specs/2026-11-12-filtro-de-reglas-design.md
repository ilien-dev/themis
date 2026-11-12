# Filtro de reglas: diseño

Fecha: 2026-11-12 · Estado: aprobado · Versión objetivo: themis 2.2.0 (fase 1)

Los veredictos y notas se nombran aquí en español. En el código y en los mensajes del plugin van en inglés (`keep`, `cut`, `move`, `rewrite`, `fix`, `conflict`); la tabla de equivalencias está en el plan de la fase 1.

Investigación de respaldo: `reports/Filtro determinista de reglas CLAUDE.md` y las notas en `research_notes/Filtro determinista de reglas CLAUDE/`.

## Intención

Hoy themis decide qué entra en `CLAUDE.md` y `AGENTS.md` con dos listas en prosa dentro de `skills/themis/SKILL.md` («What belongs», «What does not belong»). El modelo las interpreta, así que la misma regla puede entrar un día y no otro, y no hay forma de medir cuánto acierta.

Se quiere que cada regla candidata pase por un análisis repetible y medible:

1. ¿Se puede inferir del proyecto, del código o de algo ya presente en el repo? Si sí, no entra.
2. ¿Los modelos recientes de Claude y de Codex (publicados en los últimos dos meses) ya lo hacen bien por defecto? Si sí, no entra.

«Repetible» significa que el mismo texto, en el mismo repo, con la misma versión de las tablas, da siempre el mismo veredicto. «Medible» significa que cada veredicto lleva un código de razón y su evidencia, y que la precisión y la cobertura del filtro se calculan con un comando.

## Objetivos

- Un módulo en TypeScript, sin dependencias en tiempo de ejecución, que recibe una regla y un repo y devuelve un veredicto con código y evidencia.
- El mismo módulo sirve a tres usos: el hook `PreToolUse` (al escribir), la skill (antes de editar y en `audit`) y un informe de métricas.
- Las siete preguntas del flujo se ejecutan siempre en el mismo orden; la primera que responde «sí» decide.
- Una tabla por modelo, construida solo con evals propios, responde la pregunta sobre el comportamiento por defecto.
- Un corpus etiquetado mide precisión y cobertura, y condiciona que el filtro pueda interrumpir al usuario.

## Fuera de alcance

- Clasificar reglas con un modelo. No hay ningún paso LLM en el filtro.
- Reescribir reglas automáticamente. El filtro dice qué cambiar; el texto nuevo lo redacta el modelo o el usuario.
- Ecosistemas distintos de Node en la fase 1. Las tablas son datos, de modo que añadir Python u otros no cambia código.
- Un lugar para reglas que solo ayudan a Codex. Si aparece una, el filtro la reporta como conflicto y pide confirmación.
- Ejecutar herramientas del proyecto (`eslint --print-config`, `prettier`) desde el hook.

## Lo que haría fracasar esto aunque funcione

- Cortar una regla útil sin que el usuario lo vea. Un corte falso cuesta más que un pase falso.
- Dar veredictos distintos para la misma entrada.
- Usar red, un modelo o procesos del proyecto dentro del hook.
- Retrasar de forma perceptible cada edición de un archivo de reglas.
- Bloquear una sesión por un error interno. Los hooks de themis fallan en silencio y eso se mantiene.

## Restricciones

- El plugin se distribuye como JS compilado en `hooks/dist/`, sin `node_modules`. Todo lo que el filtro lea debe poder leerse con `node:fs` y `JSON.parse`, más un lector mínimo propio para `.editorconfig` y YAML plano.
- TypeScript estricto y ESLint sin avisos, como el resto del repo (`npm run check`).
- El hook `PreToolUse` tiene 10 s de timeout; el filtro debe tardar menos de 200 ms en un repo normal. Solo puede lanzar `git`, como ya hace `lib.ts`.
- `CLAUDE.md` y `AGENTS.md` siguen siendo idénticos byte a byte. El filtro corre antes de la copia de paridad.
- El hook de themis ya rechaza escrituras por shell a los archivos de reglas, así que el filtro solo ve `Edit`, `Write` y `MultiEdit`.

## Enfoques considerados

**A. Mantener el criterio en la skill y afinar la prosa.** No añade código. No es repetible ni medible, que es justo lo que se pide. Descartado.

**B. Auditor aparte, al estilo de instrlint o ctxlint.** Un comando que revisa el archivo ya escrito. Es determinista, pero actúa tarde: la regla ya entró, ya se copió al gemelo y nadie está obligado a ejecutar el comando. Sirve como parte de la solución (modo `audit`), no como única pieza.

**C. Filtro en el hook con tablas versionadas, sin modelo. Elegido.** El veredicto se calcula al escribir, con funciones puras sobre el texto y los archivos del repo. Lo que ninguna tabla reconoce entra marcado. Limita la cobertura a lo que las tablas cubren, y esa cobertura se mide.

**D. Como C, más un clasificador LLM para lo que las tablas no reconocen.** Más cobertura, pero los modelos alojados no son deterministas ni a temperatura 0 (hasta 15 % de variación entre ejecuciones en un estudio), cuesta tokens en cada edición y necesita red. Descartado por decisión del usuario.

Decisiones del usuario que fijan el diseño dentro de C:

| Tema | Decisión |
|---|---|
| Regla pedida por el usuario que el filtro considera redundante | El hook pide confirmación (`ask`) con el veredicto y la evidencia. |
| Regla que ayuda a Claude y perjudica a Codex | Va a `.claude/rules/`, que Codex no lee. |
| Regla que ninguna tabla reconoce | Entra, marcada «sin evidencia», y cuenta en la cobertura. |
| Origen de la tabla por modelo | Solo evals propios. Sin medición, la pregunta responde «no». |
| Criterio en `audit` e `init` | Solo el script. La fase 1 amplía los detectores para cubrir lo que hoy cortan las listas en prosa. |
| Frases sobre el modelo sin medición propia | Se cortan si la guía vigente del proveedor pide quitarlas, con la cita como evidencia. |
| Etiquetado del corpus de validación | Un agente sin acceso a las tablas ni al código del filtro; el usuario revisa una muestra y los desacuerdos. |
| Reglas aprobadas en el aviso | Se recuerdan en un archivo versionado del repo. |

## Diseño

### Piezas

```
hooks/gate/
  extract.ts     líneas candidatas a partir de una edición
  facts.ts       hechos del repo, leídos una vez por invocación
  checks/        una función por pregunta (q1.ts … q7.ts)
  verdict.ts     orden de las preguntas, código de razón, evidencia
  tables/        datos: alias, lint-map, phrases, model-defaults (módulos .ts: el JS compilado debe correr en Node 18, que no importa JSON)
hooks/gate.ts    CLI: check | audit | report
hooks/pre-tool.ts  llama al filtro después de checkCap y checkParity
```

Cada pregunta es una función `(regla, hechos, tablas) → respuesta | null`, sin efectos. `verdict.ts` las recorre en orden y devuelve la primera respuesta.

### Unidad de análisis

Una **regla** es un bloque de Markdown: un elemento de lista con sus líneas de continuación, un párrafo, una lista numerada completa o un bloque de código junto al párrafo que lo introduce. Los encabezados no son reglas, salvo el de nivel 1, que la pregunta 1 evalúa como título del proyecto. `extract.ts` aplica la edición en memoria, como ya hace `applyEdits`, y devuelve los bloques que están en el texto nuevo y no en el anterior, comparados tras normalizar espacios. Una edición que solo borra o reordena no produce candidatas.

El hook y el CLI usan el mismo extractor sobre texto Markdown, de modo que no pueden discrepar sobre dónde empieza y termina una regla.

### Hechos del repo

`facts.ts` parte del directorio del archivo de reglas y sube hasta la raíz del repo git (o se queda en ese directorio si no hay repo). Para cada tipo de archivo gana el más cercano: un `packages/api/CLAUDE.md` se evalúa contra `packages/api/package.json` si existe. Las rutas citadas en una regla se resuelven desde el directorio del archivo y, si no existen ahí, desde la raíz. Lee:

- `package.json` (dependencias, scripts, claves `prettier` y `eslintConfig`) y qué lockfiles existen.
- `.prettierrc`, `.prettierrc.json`, `.prettierrc.yaml`; `.eslintrc.json`; `biome.json`; `.editorconfig`; `tsconfig.json` siguiendo `extends` relativos; configuración JSON de commitlint.
- `.claude/settings.json` y `.claude/settings.local.json`: hooks y `permissions.deny` / `ask`.
- Presencia de `.husky/`, `lefthook.yml`, `.pre-commit-config.yaml` y workflows de CI.
- `README.md` y los `.md` de `docs/`, partidos en frases.
- La lista de archivos versionados (`git ls-files`), para verificar rutas.

Las configuraciones que requieren ejecutar código (`eslint.config.js`, `prettier.config.js`) se registran como «no legible». Una pregunta que dependa de ellas responde «no» y lo anota en la evidencia.

### Las siete preguntas

| # | Pregunta | Responde «sí» cuando | Veredicto |
|---|---|---|---|
| 1 | ¿El repo ya lo revela? | (a) La regla afirma el uso de una tecnología (plantillas «usa X», «hecho con X», «usamos X») que está en las dependencias, es la única presente de su categoría y no reemplaza al valor por defecto del ecosistema. (b) La regla solo dice que se ejecute un script cuyo nombre es obvio (`test`, `build`, `lint`, `dev`, `start`, `format`, `typecheck`) y no añade argumentos ni contexto. (c) Es un título o descripción del proyecto que coincide con el nombre del paquete o la primera frase del README. (d) Es un árbol de carpetas: un bloque con caracteres de árbol, o una lista de 3 o más rutas que existen en el repo, cada una con una descripción corta y sin instrucción. (e) Es un resumen: un párrafo de 2 o más frases sin comando ni ruta cuya similitud con un pasaje del README supera 0,8. | `NO_ENTRA` |
| 2 | ¿Una herramienta ya lo impone? | `lint-map.json` asocia la regla con una clave de configuración, el **valor** resuelto coincide y hay prueba de que la herramienta se ejecuta. También cuando un `permissions.deny` ya cubre el comando que la regla prohíbe. Si el valor contradice la regla: `CONFLICTO`. | `NO_ENTRA` o `CONFLICTO` |
| 3 | ¿Es genérica o para modelos antiguos? | Coincide con `phrases.json` (inglés y español), que tiene tres grupos: consejo sin contenido («código limpio», «buenas prácticas», «maneja los errores»); relleno sobre el propio archivo («este archivo ofrece orientación a…»); y frases que la guía vigente de un proveedor pide quitar («piensa paso a paso», «piensa con cuidado»). | `NO_ENTRA` |
| 4 | ¿Los modelos recientes ya lo hacen? | La regla coincide con un comportamiento de `model-defaults.json` y la agregación por modelo lo indica (ver abajo). | `NO_ENTRA` o `MOVER` |
| 5 | ¿Es una prohibición sin excepciones? | Marcador absoluto (nunca, siempre, jamás, never, always, under no circumstances) junto a un comando o ruta entre comillas invertidas. | `MOVER` a hook o `permissions.deny` |
| 6 | ¿Es un procedimiento o un pasaje largo? | Más de 5 pasos numerados o más de 8 líneas; o un bloque de 3 líneas o más cuya similitud con un pasaje del README o de `docs/` supera 0,8 (Jaccard sobre trigramas de palabras). | `MOVER` a skill o doc, con puntero |
| 7 | ¿Tiene un problema de forma? | Énfasis en mayúsculas (IMPORTANT, CRITICAL, MUST, IMPORTANTE…); o cita un comando o ruta que no existe en el repo. | `REESCRIBIR` o `CORREGIR` |

Si ninguna responde, el veredicto es `ENTRA`. Puede llevar notas, que informan y no interrumpen:

- `SIN_EVIDENCIA`: la regla no coincidió con ninguna entrada de ninguna tabla.
- `SIN_ANCLA`: no nombra ningún comando, ruta, identificador ni tecnología conocida.
- `ABSOLUTA_SIN_MOTIVO`: usa un marcador absoluto sin comando ni ruta y sin cláusula de motivo. Fable 5.2 trata «nunca» como absoluto, pero gotchas legítimos como «los importes son céntimos enteros, nunca floats» tienen esta forma, así que no interrumpe.

Precisiones:

- **Declarado no es medido.** Cada frase del tercer grupo de `phrases.json` lleva la URL de la guía, los modelos a los que se refiere y la fecha de consulta, y su código de razón es `DECLARADO_PROVEEDOR`, distinto de los de la pregunta 4. Solo entran frases que ninguna guía de otra familia recomiende; «delega en subagentes», que Anthropic pide quitar y OpenAI recomienda, se queda para la pregunta 4. `gate report` lista las entradas con más de 60 días para revisarlas.
- **Configurado no es impuesto.** En la pregunta 2, la prueba de ejecución es que la herramienta aparezca en un script de `package.json`, en un hook de pre-commit (husky, lefthook, pre-commit) o en un workflow de CI. `tsconfig.json` cuenta siempre, porque lo aplica el compilador. Un `.prettierrc` que nadie ejecuta no corta nada. Los hooks de Claude Code no cuentan como prueba de que un comando está prohibido, porque son scripts arbitrarios; solo `permissions.deny`.

- **La excepción de la pregunta 1.** «Usa pnpm, no npm» entra aunque exista `pnpm-lock.yaml`. En el estudio de ETH, nombrar una herramienta que no es la predeterminada cambió el comportamiento (`uv`: 1,6 usos por tarea frente a menos de 0,01). `alias.json` marca qué tecnologías reemplazan a un valor por defecto (pnpm, yarn, bun) y agrupa las demás por categoría (framework, test runner, bundler…). Las reglas negativas («no uses X») nunca se cortan por la pregunta 1.
- **Los gotchas se quedan.** Una línea que repite algo que un doc también dice no se mueve; la pregunta 6 solo actúa sobre bloques de 3 líneas o más. Esto conserva el criterio actual de la skill.
- **Sin alcance por ruta en el filtro.** El artefacto de la investigación proponía mover a `.claude/rules` las reglas de una sola ruta. Se retira: Codex no lee ese directorio y la regla dejaría de existir para él. La skill puede sugerir un `CLAUDE.md` anidado en modo `audit`.
- **Fuera de un repo** (por ejemplo `~/.claude/CLAUDE.md`) solo corren las preguntas 3, 4 y 7.

### La pregunta 4 y la tabla por modelo

`model-defaults.json`:

```json
{
  "as_of": "2026-11-12",
  "window_days": 60,
  "models": [{ "id": "claude-opus-5-5", "family": "claude", "released": "2026-09-22" }],
  "behaviors": [{
    "id": "verify-before-done",
    "patterns": ["\\bverif(y|ica)\\b.*\\b(before|antes)\\b"],
    "results": [{
      "model": "claude-opus-5-5", "harness": "claude-code", "effort": "medium",
      "without": { "k": 59, "n": 60 }, "with": { "k": 60, "n": 60 },
      "state": "default", "measured": "2026-11-20"
    }]
  }]
}
```

Estado de cada par comportamiento–modelo, derivado solo de los conteos:

- `default`: sin la regla, el límite superior unilateral al 95 % de la tasa de fallo es menor que 5 % (por ejemplo 59 de 59).
- `helps`: con la regla la tasa de cumplimiento es mayor y la diferencia es significativa (prueba exacta de Fisher, p < 0,05).
- `hurts`: con la regla es menor y la diferencia es significativa.
- `neutral`: medido, sin diferencia significativa y sin llegar a `default`.
- `unmeasured`: no hay resultado.

Agregación por familia: una familia es `default` si todos sus modelos de la ventana lo son; `helps` si alguno lo es y ninguno es `hurts`; `hurts` si alguno lo es.

| Claude | Codex | Veredicto |
|---|---|---|
| `default` | `default` | `NO_ENTRA` |
| `helps` | `hurts` | `MOVER` a `.claude/rules/` |
| `hurts` | `helps` | `CONFLICTO` |
| `hurts` | cualquier otro | `NO_ENTRA` |
| cualquier otra combinación | | la pregunta responde «no» |

Una familia sin medir cuenta como `unmeasured`, así que la pregunta 4 no corta nada del texto compartido hasta que ambas familias estén medidas. La opción `gate_models` (abajo) permite declarar que solo se usa una.

Caducidad: si la fecha actual supera `as_of` más `window_days`, la pregunta 4 responde «no» para todo y el aviso de inicio de sesión dice que la tabla está caducada. Un veredicto de la pregunta 4 depende así de la fecha, y solo en un sentido: deja de cortar.

### Qué hace el hook

`pre-tool.ts`, tras `checkCap` y `checkParity`:

- Todas las candidatas `ENTRA`: deja pasar. Si alguna lleva nota, la añade como `additionalContext`.
- Alguna candidata con otro veredicto: devuelve `ask`. El texto, que ve el usuario, lista cada regla con su veredicto, código de razón y evidencia (archivo y clave), y dice que aprobar la deja entrar tal cual.

El filtro nunca devuelve `deny`. Un error interno sale en silencio, como en el resto de hooks.

Cuando nadie puede responder a un `ask` (sesiones con `-p`, modo de permisos `dontAsk` o `bypassPermissions`, subagentes), el filtro se comporta como `report`: deja pasar y pone los veredictos en `additionalContext`. Un `ask` sin respuesta se convertiría en un rechazo que el modelo no puede explicar. Quien lo construya confirma en la documentación actual qué campo de la entrada del hook indica el modo.

### Reglas aceptadas

Cuando el usuario aprueba un `ask`, la edición se ejecuta y el hook `PostToolUse` (`parity.ts`) vuelve a evaluar las reglas nuevas. Las que no son `ENTRA` y están en el archivo se guardan en `.claude/themis-accepted.json`, versionado: hash del texto normalizado, veredicto original y fecha. Solo se guarda si el filtro estaba en modo `ask` y la sesión podía responder; en modo `report` nadie aprobó nada.

Una regla cuyo hash está en ese archivo sale como `ENTRA` con la nota `ACEPTADA` y su veredicto original, tanto en el hook como en `audit`. Si el texto cambia, el hash cambia y la regla se evalúa de nuevo. `audit` elimina las entradas que ya no corresponden a ninguna regla.

Opciones nuevas en `userConfig`:

- `gate`: `ask` (por defecto), `report` (no interrumpe; todo va a `additionalContext`) u `off`.
- `gate_models`: `claude,codex` (por defecto), `claude` o `codex`. Familias que cuentan en la pregunta 4.

### Qué cambia en la skill

Las listas «What belongs» y «What does not belong» dejan de ser el criterio y pasan a ser una descripción breve de lo que el filtro comprueba. El modelo no corta por criterio propio lo que el script deja entrar. Para no perder lo que la skill corta hoy, los `CLAUDE.md` de los fixtures c14 y c15 se añaden al corpus de regresión: cada línea que sus evaluadores exigen quitar debe salir `NO_ENTRA` o `MOVER` por script, y cada gotcha que exigen conservar debe salir `ENTRA`. Los modos cambian así:

- **edit**: antes de editar, ejecutar `gate check` con las líneas nuevas. Las que no sean `ENTRA` no se escriben; se le dice al usuario por qué y qué alternativa hay (hook, skill, `.claude/rules`, reescritura). Si el usuario insiste, se editan y el hook le pide confirmación.
- **audit**: ejecutar `gate audit <archivo>` y mostrar su tabla en vez de clasificar a mano. Aplicar lo aprobado.
- **init**: redactar como hoy y pasar el borrador por `gate check` antes de escribir.

### CLI

```
node hooks/dist/gate.js check  [--file CLAUDE.md] [--json]   # Markdown por stdin; mismo extractor que el hook
node hooks/dist/gate.js audit  <archivo> [--json]            # veredicto de cada regla y cobertura
node hooks/dist/gate.js report <corpus.jsonl>                # precisión, cortes falsos, cobertura
```

## Cómo se mide

**Corpus de regresión** (`tests/gate/corpus.jsonl`). Cada caso: repo de ejemplo, texto de la regla, veredicto y código esperados. Al menos 150 casos, en inglés y español, que cubran cada código y sus casos límite (semicolons con `semi: false`, pnpm frente a React, «nunca» con y sin comando). Todos deben pasar en `npm test`.

**Corpus de validación** (`tests/gate/holdout.jsonl`). Reglas tomadas de archivos `CLAUDE.md` y `AGENTS.md` reales de repos públicos con licencia permisiva. Las etiqueta un agente que recibe la regla, el repo y la definición de cada veredicto, y que no puede leer `hooks/gate/` ni la salida del filtro. El usuario revisa unas 30 etiquetas al azar y todos los casos en que el filtro interrumpe y la etiqueta dice que debía entrar. No se usa para ajustar las tablas. De él salen las tres métricas:

- **Precisión de interrupción**: de las reglas con un veredicto que dispara `ask` (`NO_ENTRA`, `MOVER`, `REESCRIBIR`, `CORREGIR`, `CONFLICTO`), cuántas lo merecían. Se publica también por veredicto.
- **Tasa de corte falso**: de las reglas que debían entrar tal cual, cuántas se interrumpieron.
- **Cobertura**: reglas que coinciden con alguna tabla, sobre el total.

Cada caso lleva el repo del que salió la regla, reducido a los archivos que `facts.ts` lee, y una etiqueta: entra tal cual, o el veredicto que merece.

**Condición para activar `ask` por defecto**: precisión de interrupción de 95 % o más sobre al menos 100 reglas interrumpidas, no sobre 100 reglas del corpus. Si no se alcanza, 2.2.0 sale con `gate: report` por defecto y la condición se anota en `RESULTS.md`. La cobertura se publica, no condiciona nada.

Los evals de sesión existentes (c13 a c15) corren en modo `dontAsk`, donde el filtro solo informa. Volver a ejecutarlos con el filtro activo es una sesión facturada y necesita aprobación aparte.

**Repetibilidad**: una prueba ejecuta el corpus dos veces y con el orden de casos invertido y exige salidas idénticas.

**Rendimiento**: una prueba mide `gate check` sobre el repo de ejemplo más grande y falla por encima de 200 ms.

## Evals para la tabla por modelo

Arnés nuevo en `evals/defaults/`, apoyado en `evals/run.ts`:

- Un caso por comportamiento, con 3 tareas sobre repos de ejemplo y un evaluador determinista (regex y comprobaciones de archivos, como los actuales).
- Dos brazos: sin regla y con la regla en `CLAUDE.md`. 20 ejecuciones por tarea y brazo, 60 por brazo. Si el brazo sin regla sale `default`, el otro no se ejecuta.
- Modelo fijado con `--model`, esfuerzo por defecto del modelo, registrado en el resultado.
- Un comando convierte los resultados en entradas de `model-defaults.json`.

Comportamientos iniciales, tomados de lo que declaran las guías oficiales y aún sin medir: verificar antes de dar por terminado; no añadir funciones, tests ni docs no pedidos; delegar en subagentes; «piensa con cuidado»; «pregunta antes de…» sin acción concreta; «sé conciso»; declarar propiedad del código.

Coste estimado para la familia Claude: 7 comportamientos × 4 modelos × 60 a 120 ejecuciones × 0,13 a 0,24 USD (los costes de `RESULTS.md`) ≈ 220 a 810 USD. Es una estimación propia; lanzar los evals requiere aprobación aparte.

La familia Codex necesita un arnés equivalente sobre `codex exec` y una cuenta de OpenAI. No existe hoy.

## Fases

1. **Filtro por script** (2.2.0): preguntas 1, 2, 3, 5, 6 y 7, CLI, hook, reglas aceptadas, cambios en la skill, los dos corpus y el informe. `model-defaults.json` se publica sin comportamientos, de modo que la pregunta 4 responde «no».
2. **Tabla por modelo, Claude**: arnés `evals/defaults/`, medición de los siete comportamientos, primera tabla con datos.
3. **Tabla por modelo, Codex**: arnés sobre `codex exec` y medición. Hasta aquí la pregunta 4 solo corta para quien ponga `gate_models: claude`.

Cada fase tiene su propio plan. Este documento se aprueba completo; el primer plan cubre solo la fase 1.

## Lo que queda a quien lo construya

- El contenido inicial de `alias.json`, `lint-map.json` y `phrases.json`. Como referencia: los cerca de 21 pares de instrlint y los cerca de 29 alias de ctxlint, ambos MIT, corrigiendo que instrlint solo comprueba que la clave exista.
- La heurística exacta de «la regla no añade contexto» en la pregunta 1(b) y la de «cláusula de motivo» en la 7, fijadas con casos del corpus.
- El lector mínimo de YAML y de `.editorconfig`.
- El formato del texto de `ask` y de la tabla de `audit`.
- Cómo invoca la skill el CLI desde el directorio del plugin (confirmar en la documentación actual si `${CLAUDE_PLUGIN_ROOT}` se sustituye en el contenido de una skill).
- Qué repos públicos alimentan el corpus de validación.

## Riesgos conocidos

- **Tablas cortas al principio.** La cobertura inicial puede ser baja; por eso se mide y por eso lo no reconocido entra.
- **Idioma.** Las tablas cubren inglés y español; una regla en otro idioma entra como `SIN_EVIDENCIA`.
- **`ask` muestra la razón al usuario, no al modelo.** Si el usuario rechaza, el modelo solo ve el rechazo. Por eso la skill ejecuta `gate check` antes de editar.
- **La evidencia sobre los modelos de la ventana es escasa.** No hay estudios publicados de éxito en tareas con ellos; las mediciones de la fase 2 serían las primeras y con 60 ejecuciones solo detectan efectos grandes.
