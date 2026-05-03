# Workflow

Flujo típico de uso del estudio. Léelo antes de tu primera sesión.

---

## 0. Setup inicial (una sola vez)

```bash
git clone <repo>
cd multiagent-architecture-studio
# El viewer se instala cuando lo arranques por primera vez
```

No hay paso de configuración global. Claude Code lee `.claude/agents/` y `.claude/skills/` directamente.

---

## 1. Diseñar un caso nuevo

### Paso 1 — Disparar el caso

Abre Claude Code en el repo y dile:

> *"Quiero diseñar un sistema multiagente para [tu problema]"*.

Claude detectará la intención y arrancará `case-intake`.

### Paso 2 — `case-intake` te entrevista

Te hará preguntas de una en una hasta tener:

- `title`, `description`
- `inputs` y `outputs` esperados
- `constraints` duros (latencia, coste, compliance, PII)
- `actors` humanos (si los hay)
- `volume` y frecuencia

Cuando tenga todo, escribe `architectures/<slug>.json` con `case` rellena y `variants` vacías.

**No saltes este paso.** Es donde el sistema convierte un problema vago en algo procesable.

### Paso 3 — `complexity-assessor` evalúa (gatekeeper KISS)

Antes de proponer agentes, evalúa la complejidad real en 5 ejes:

| Eje | Pregunta clave |
|---|---|
| Domain | ¿Cuánto conocimiento especializado? ¿Uno o varios dominios disjuntos? |
| Task | ¿Transformación lineal o razonamiento/exploración? |
| Context | ¿Cuánto input? ¿Crece con el tiempo? ¿Datos sensibles? |
| Tools | ¿Cuántas, qué heterogéneas, hay MCPs, side effects irreversibles? |
| Flow | ¿Lineal, ramificado, con loops, con humanos? |

Cada eje 1-5. La suma da un veredicto:

| Suma | Veredicto |
|---|---|
| 5–10 | **Single Agent + Tools** |
| 11–16 | Multiagente ligero |
| 17–22 | Multiagente estructurado |
| 23–25 | Sistema complejo |

> **El veredicto es vinculante.** Si dice "Single Agent + Tools" e insistes en multiagente, `agent-decomposer` te pedirá justificación explícita y la registrará en el JSON.

### Paso 4 — `agent-decomposer` propone agentes

Cuestiona cada agente que proponga el usuario:

- *"¿Por qué este agente y no una llamada directa a la herramienta?"*
- *"¿Toma decisiones o solo transforma datos? Si es lo segundo, es un bridge."*
- *"¿Estás separando por dominio o por tipo de tarea?"*

Consulta la skill `multiagent-patterns` y propone el patrón concreto que mejor encaja.

### Paso 5 — `tool-designer` define herramientas

Para cada agente, set mínimo de tools. Cuestiona:

- *"¿Esta tool debería existir o el agente puede pedírsela a otro?"*
- *"¿Es idempotente? ¿Qué pasa si falla?"*
- *"¿Su salida necesita un bridge antes de volver al agente?"*
- *"¿Hay un MCP existente que ya hace esto?"*

### Paso 6 — `execution-mode-designer` decide el modo

Para cada agente, fija el `executionMode` (`react_loop`, `one_shot`, `tool_then_return`, `plan_then_execute`, `parallel_tools`) y exige justificación.

> **Bandera roja**: `react_loop` con una sola tool casi siempre debería ser `tool_then_return`.

### Paso 7 — `context-strategist` define state y bridges

- Decide el `stateModel` de la variante (`message_passing`, `shared_blackboard`, `scoped_state`, `external_store`).
- Anota `contextStrategy`, `stateReads`, `stateWrites` por agente.
- Crea los bridges necesarios para no inflar contextos.

### Paso 8 — `orchestration-critic` audita

Mira la propuesta agregada. Si detecta:

- Saturación del orquestador (>5 tools o >4 subagentes).
- `react_loop` con una sola tool.
- Edges con payload grande sin bridge.
- `shared_blackboard` con escrituras conflictivas.
- State huérfano o mudo.

…**bloquea** el avance hasta que decidas qué hacer. No pasa al siguiente paso si hay alarmas serias.

### Paso 9 — `architecture-synthesizer` genera las 3 variantes

Cuando estés conforme con el diseño, sintetiza:

- **Básica**: lo mínimo que funciona. PoC.
- **Intermedia**: sweet spot para producción inicial. Mitiga los riesgos reales del caso.
- **Avanzada**: optimizada para escala/calidad. Solo si el caso lo justifica.

Cada variante con `rationale` que explica qué se gana y qué se paga.

---

## 2. Visualizar y editar

```bash
cd viewer
npm install   # solo la primera vez
npm run dev
```

Abre `http://localhost:5173`. Si no pasas `?case=...`, abre con el último caso modificado.

En la UI:

- **Tabs arriba**: Básica / Intermedia / Avanzada.
- **Badge**: `stateModel` activo.
- **Panel lateral**: rationale + detalle del nodo seleccionado.
- **Drag & drop**: mueve nodos. La nueva `position` se persiste.
- **Historial**: lista de iteraciones; clic para ver snapshot.

---

## 3. Iterar

Vuelve a Claude Code y di cosas en lenguaje natural:

- *"Renombra el agente Classifier a Intent Router."*
- *"En la variante avanzada, añade un bridge entre KB Search y Responder."*
- *"Mueve el orquestador a la izquierda."*
- *"En la intermedia, este agente debería ser `tool_then_return`."*
- *"Añade un dataStore tipo Redis para sesiones."*

`diagram-editor` aplica el cambio al JSON, añade entrada al `history`, y la web se refresca sola.

---

## 4. Ampliar con subagentes nuevos

Para añadir un subagente al sistema (ej. `security-auditor`, `cost-auditor`, `latency-estimator`):

1. Crea `.claude/agents/<nombre>.md` con el frontmatter YAML.
2. Sigue el espíritu socrático: **interroga, no respondas**.
3. Decide si su descripción contiene `Use PROACTIVELY` (auto-invocación) o si debe invocarse explícitamente.
4. Si toca el JSON, sigue las reglas: nunca sin entrada en `history`, nunca pisando campos desconocidos.

No hay registro central. Claude Code los descubre solos.

---

## 5. Reglas de oro

1. **El JSON es la única fuente de verdad.**
2. **Cada cambio del JSON añade entrada al `history`** — siempre.
3. **El veredicto de `complexity-assessor` es vinculante.**
4. **Las 3 variantes son distintas en filosofía** — no "la misma con más cosas".
5. **Cada agente justifica su `executionMode`.**
6. **Cada variante declara su `stateModel`.**
7. **Payloads grandes pasan por un `bridge`** — o se justifica por qué no.
8. **Saturación del orquestador es bandera roja**: >5 tools o >4 subagentes.
9. **Los subagentes interrogan, no responden.**
10. **KISS por defecto**: el primer patrón a considerar es Single Agent + Tools.

---

## 6. Troubleshooting

| Síntoma | Probable causa | Acción |
|---|---|---|
| El viewer muestra "Caso no encontrado" | Filename del JSON no coincide con `case.slug` | Renombra el archivo o ajusta el slug. |
| Cambios al JSON no se reflejan en el navegador | Vite watcher caído | Reinicia `npm run dev`. |
| Drag & drop no persiste | Endpoint de save deshabilitado | Comprueba que `viewer/vite.config.ts` no esté en read-only. |
| El subagente no se invoca solo | Falta `Use PROACTIVELY` en su `description` | Edita el frontmatter. |
| `architecture-synthesizer` produce 3 variantes muy parecidas | El usuario no reflejó qué quería ganar en cada una | Vuelve atrás y obliga rationale comparativo. |
