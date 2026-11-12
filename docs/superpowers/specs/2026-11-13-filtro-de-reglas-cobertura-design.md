# Filtro de reglas, fase 1.1: cobertura

Fecha: 2026-11-13 · Estado: implementado · Versión: entra en themis 2.2.0

Continúa `2026-11-12-filtro-de-reglas-design.md`. Todo lo que ese documento fija sigue vigente; este solo añade detectores.

## Intención

La medición a ciegas de la fase 1 dio una detección del 16 % (9,7 % tras las correcciones): de 475 reglas que los etiquetadores cortarían, el filtro cortó 16. Como la skill no añade cortes propios, `audit` e `init` cortan mucho menos que la 1.x en archivos reales. Se quiere subir la detección sin renunciar al determinismo ni a la precisión.

## Objetivo y medida

- Cinco detectores nuevos, todos por script, para las familias que concentran las reglas redundantes no detectadas en el primer corpus.
- Validación a ciegas en un corpus nuevo (el primero se usó para diseñar los detectores y ya no sirve para validarlos).
- Se mantiene la condición de la fase 1: `ask` por defecto solo con precisión de interrupción de 95 % o más sobre al menos 100 reglas interrumpidas. Si no se cumple, el modo por defecto sigue siendo `report`.
- Se publica la detección (reglas no-`keep` según la etiqueta que el filtro interrumpe) y la precisión por código de razón.

## Fuera de alcance

- Hechos de CI o de `tsconfig` («CI runs lint on PRs», alias de rutas).
- Recuperar las referencias inexistentes que la pregunta 7 dejó de marcar en monorepos.
- La pregunta 4 (comportamiento por defecto del modelo).

## Lo que haría fracasar esto

Lo mismo que en la fase 1, con un énfasis: un detector nuevo que corte una regla con información real. Cada detector lleva una lista cerrada de condiciones bajo las que se abstiene, y ante la duda se abstiene.

## Enfoques

**A. Dejar que el modelo proponga cortes en una columna aparte.** Recupera cobertura de inmediato, pero el resultado deja de ser repetible. El usuario eligió no hacerlo.

**B. Ampliar las tablas fijas (más alias, más frases).** No alcanza: las familias que faltan no son vocabulario, son formas («ruta + descripción», «lista de dependencias»).

**C. Detectores de forma que usan el repo como diccionario. Elegido.** En vez de una tabla de 45 tecnologías, el diccionario son las dependencias del `package.json`; en vez de una lista de scripts obvios, los scripts que existen y las palabras de su nombre y de su comando.

## Los cinco detectores

Todos viven en la pregunta 1 (inferible del repo), salvo el primero, que es de la pregunta 3. Todos se abstienen si la regla contiene una instrucción, una negación, un absoluto, una condición o un momento (las listas `IMPERATIVE`, `NEGATION`, `ABSOLUTE` y de palabras de tiempo que ya existen), o un dígito que no sea una versión comprobada contra el manifiesto.

| # | Familia | Se corta cuando | Código |
|---|---|---|---|
| 1 | Plantilla de `/init` | El encabezado de nivel 1 solo contiene nombres de archivo de reglas y palabras de relleno (`# CLAUDE.md`, `# AGENTS.md`, `# Project instructions`). O la frase es la plantilla «This file provides guidance to … when working with code in this repository» con cualquier nombre de agente y un paréntesis opcional. | `file-filler` |
| 2 | Ruta + descripción | El elemento empieza por una ruta que existe (o por un nombre seguido de una ruta que existe entre paréntesis), un separador y una descripción de 25 palabras o menos. Se abstiene además si la descripción contiene una palabra de estado (generated, auto-generated, legacy, deprecated, frozen, experimental, internal, vendored, temporary, WIP, readonly y equivalentes en español) o un comando entre comillas invertidas. | `inferable-path` |
| 3 | Lista de stack | Tras quitar una etiqueta inicial (Stack, Tech stack, Built with, Uses…), cada segmento separado por coma, `·`, `|`, `+`, `/` o «and» es una dependencia del manifiesto (por nombre, por la última parte de un nombre con ámbito o por alias de la tabla), con versión opcional y un paréntesis opcional cuyas palabras son neutras u otras dependencias. También «**dependencia**: descripción» con las mismas abstenciones que el detector 2. | `inferable-stack` |
| 3b | Versión desactualizada | En una lista de stack, un segmento da una versión mayor distinta de la del manifiesto. | `conflict` · `stale-version` |
| 4 | Script + descripción | La regla cita de forma explícita un script que existe (cualquier nombre) y las palabras de alrededor son neutras, partes del nombre del script, palabras del comando que el script ejecuta, o sinónimos de una lista cerrada (cov↔coverage, int↔integration, db↔database, e2e↔end-to-end…). | `inferable-script` |
| 5 | Resumen del proyecto | Párrafo sin comillas invertidas (salvo el nombre del paquete) con al menos 6 palabras de contenido, de las que el 80 % o más aparecen en la `description` del manifiesto, los tres primeros párrafos del README o los nombres de las dependencias. | `inferable-overview` |

Precisiones:

- El detector 2 es el más grande y el más arriesgado. Una descripción puede esconder un aviso sin usar ninguna palabra de las listas. La validación a ciegas publica su precisión por separado; si queda por debajo del 95 %, el detector se entrega desactivado por defecto tras una opción `gate_paths` y se documenta.
- Las rutas se resuelven con la misma función que la pregunta 7 (sufijos, subpaquetes, sufijos de línea).
- Los detectores nuevos van después de los existentes dentro de la pregunta 1: un caso que ya se cortaba conserva su código.

## Segundo corpus de validación

- Otros 40 repos como mínimo, con los mismos criterios de selección fijados de antemano, excluyendo los 40 del primer corpus. Al menos 15 con `AGENTS.md` como archivo de reglas. Máximo 40 reglas por repo, objetivo de unas 1 000.
- La recogida no lee los detectores ni ejecuta el filtro. Los detectores se congelan (commit anotado) antes de medir.
- Los snapshots guardan además `.gitignore`, todos los `package.json` del árbol (hasta 30) y el archivo de licencia. **Los directorios de snapshot no se versionan**: en git quedan `sources.json`, el script de recogida, `SOURCES.md` y los `.jsonl` con las reglas y etiquetas. Lo mismo se aplica al primer corpus antes de publicar la rama.
- Etiquetado con las mismas instrucciones que el primero, más una aclaración decidida antes de ver los datos: una ruta que existe bajo un directorio más profundo cuenta como existente.

## Riesgos

- La estimación de «10 % → alrededor de 50 %» sale de clasificar por patrones las reglas no detectadas del primer corpus; no es una medición.
- El primer corpus pasa a ser de desarrollo: sus números tras esta fase son un techo.
- Más detectores en la pregunta 1 alargan la evaluación; se mantiene el presupuesto de 200 ms en proceso.

## Resultado

- **Medición a ciegas** en el segundo corpus (`tests/gate/holdout2.jsonl`: 1 223 reglas de 40 repos, 22 `AGENTS.md` y 18 `CLAUDE.md`), con los detectores congelados en d176786. Por defecto: 99 reglas interrumpidas, precisión de interrupción 73,7 % (73 de 99), falsos cortes 3,1 % (26 de 849), detección 19,5 % (73 de 374). Con `--paths`: 103 interrumpidas, 74,8 %, detección 20,6 %; `inferable-path` actuó 4 veces y acertó las 4, demasiado pocas para medir su precisión. La estimación de alrededor del 50 % no se cumplió.
- **Rutas descritas desactivadas por defecto.** Una revisión adversarial mostró que una descripción hecha con palabras del archivo no prueba que el archivo lo diga. El detector 2 se entrega tras `gate_paths` (por defecto `false`) y `--paths`.
- **Se quitó la forma A** del detector 3: «**dependencia**: descripción» ya no se juzga, porque nada en el repo comprueba la descripción. Una lista de stack necesita al menos dos segmentos.
- **`dead-reference` pasa a ser una nota.** Fue la mayor fuente de interrupciones falsas en las dos mediciones (27 de 73 aciertos en el primer corpus, 1 de 18 en el segundo). Una referencia que no se resuelve deja la regla en `keep` con la nota `unresolved-reference`, que dice qué no se encontró. Tras este cambio, que se decidió viendo las dos mediciones y por tanto no es a ciegas: 81 interrumpidas, 84,0 %, falsos cortes 1,5 %, detección 18,2 %.
- **No se cumple la condición para `ask`** (95 % sobre al menos 100 interrupciones). `gate` sigue en `report`. Nueve de las interrupciones falsas que quedan son títulos de nivel 1 que estos etiquetadores mantuvieron y los del primer corpus cortaron; el usuario tiene que decidir cuál es el criterio.
- Los números completos y su desglose por código están en `RESULTS.md`.
