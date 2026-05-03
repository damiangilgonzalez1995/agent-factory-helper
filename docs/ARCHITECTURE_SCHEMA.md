# Architecture JSON Schema

Documento de referencia del esquema JSON canónico para arquitecturas. Cualquier subagente que escriba al JSON y el viewer que lo lee deben respetar este contrato.

## Estructura raíz

```json
{
  "case":          { /* metadata del caso */ },
  "variants": {
    "basic":        { /* arquitectura básica */ },
    "intermediate": { /* arquitectura intermedia */ },
    "advanced":     { /* arquitectura avanzada */ }
  },
  "activeVariant": "basic" | "intermediate" | "advanced",
  "history":       [ /* iteraciones */ ]
}
```

---

## `case`

Metadata del problema del usuario. Se rellena por `case-intake` y se enriquece por `complexity-assessor`.

| Campo | Tipo | Descripción |
|---|---|---|
| `slug` | `string` | Identificador kebab-case. Debe coincidir con el filename. |
| `title` | `string` | Título humano. |
| `description` | `string` | Resumen del caso (1-3 párrafos). |
| `constraints` | `string[]` | Restricciones duras: latencia, coste, compliance, PII, etc. |
| `inputs` | `string[]` *(opcional)* | Tipos de input esperados. |
| `outputs` | `string[]` *(opcional)* | Tipos de output esperados. |
| `actors` | `string[]` *(opcional)* | Humanos involucrados (si los hay). |
| `volume` | `string` *(opcional)* | Frecuencia y volumen estimado. |
| `createdAt` | `string` (ISO) | Timestamp de creación. |
| `complexity` | `Complexity` | Evaluación de `complexity-assessor`. |

### `case.complexity`

Lo escribe `complexity-assessor`. **Vinculante** para `agent-decomposer`.

```json
{
  "domain":  3,        // 1-5: cuánto conocimiento especializado
  "task":    2,        // 1-5: razonamiento vs transformación
  "context": 4,        // 1-5: tamaño/sensibilidad del input
  "tools":   3,        // 1-5: nº y heterogeneidad de tools
  "flow":    2,        // 1-5: lineal vs ramificado vs con loops
  "total":  14,
  "verdict": "Multiagente ligero",
  "recommendedPatterns": ["Router", "Reflection"],
  "rationale": "..."
}
```

Tabla de veredictos:

| Suma | Veredicto |
|---|---|
| 5–10 | Single Agent + Tools |
| 11–16 | Multiagente ligero |
| 17–22 | Multiagente estructurado |
| 23–25 | Sistema complejo |

---

## `variant`

Cada una de las 3 propuestas (`basic`, `intermediate`, `advanced`).

| Campo | Tipo | Descripción |
|---|---|---|
| `stateModel` | `"message_passing" \| "shared_blackboard" \| "scoped_state" \| "external_store"` | Cómo se comparte el state entre agentes. **Obligatorio.** |
| `agents` | `Agent[]` | Lista de agentes. |
| `tools` | `Tool[]` | Tools disponibles. |
| `bridges` | `Bridge[]` | Piezas de código no-LLM entre agentes/tools. |
| `dataStores` | `DataStore[]` | Almacenes (DB, file, Redis...) externos. |
| `edges` | `Edge[]` | Conexiones del grafo. |
| `rationale` | `string` | Por qué esta variante: qué se gana, qué se paga frente a la anterior. |
| `patterns` | `string[]` *(opcional)* | Patrones canónicos aplicados (ej. `["Router", "Reflection"]`). |

---

## `agent`

```json
{
  "id": "orchestrator",
  "name": "Orchestrator",
  "role": "Recibe el ticket, decide flujo, delega",
  "model": "claude-opus-4-7",
  "systemPromptSummary": "Razonamiento sobre clasificación y delegación a especialistas.",
  "tools": ["delegate_to_classifier"],
  "executionMode": "react_loop",
  "executionModeRationale": "Necesita razonar sobre la salida del classifier antes de decidir.",
  "contextStrategy": "windowed",
  "stateReads": ["ticket.payload"],
  "stateWrites": ["ticket.classification"],
  "position": { "x": 100, "y": 100 }
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `id` | sí | Identificador único dentro de la variante. |
| `name` | sí | Nombre humano. |
| `role` | sí | Una frase: qué hace, qué decide. |
| `model` | sí | Identificador del modelo (`claude-opus-4-7`, `claude-sonnet-4-6`, etc.). |
| `systemPromptSummary` | sí | Resumen del system prompt (no el prompt completo). |
| `tools` | sí | IDs de tools que puede invocar. Puede estar vacío. |
| `executionMode` | sí | Ver enum abajo. **Justificado en `executionModeRationale`.** |
| `executionModeRationale` | sí | Por qué este modo y no otro. |
| `contextStrategy` | sí | Ver enum abajo. |
| `stateReads` | sí | Slots de estado que lee (rutas con punto: `ticket.payload`). |
| `stateWrites` | sí | Slots que escribe. |
| `position` | sí | `{x, y}` para React Flow. |

### Enum `agent.executionMode`

| Valor | Comportamiento |
|---|---|
| `react_loop` | Itera piensa → tool → observa → … hasta decidir. |
| `one_shot` | Una llamada al LLM, sin tools. |
| `tool_then_return` | Elige UNA tool, ejecuta, devuelve al invocador sin razonar. |
| `plan_then_execute` | Genera plan, un ejecutor determinista lo recorre. |
| `parallel_tools` | Lanza varias tools en paralelo en un turno. |

### Enum `agent.contextStrategy`

| Valor | Significado |
|---|---|
| `stateless` | Sin contexto previo. |
| `windowed` | Últimos N turnos. |
| `summarized` | Historial resumido. |
| `full_history` | Todo el historial (cuidado con saturación). |
| `rag` | Recuperación bajo demanda. |

---

## `tool`

```json
{
  "id": "knowledge_base_search",
  "name": "KB Search",
  "type": "mcp",
  "description": "Busca en la base de conocimiento interna",
  "consumedBy": ["responder"],
  "position": { "x": 400, "y": 300 }
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `id` | sí | Único en la variante. |
| `name` | sí | Nombre humano. |
| `type` | sí | `mcp`, `custom`, `http`, `sql`, etc. |
| `description` | sí | Una frase. |
| `consumedBy` | sí | IDs de agentes que la invocan. |
| `idempotent` | no | `true \| false`. |
| `sideEffect` | no | `read \| write \| irreversible`. |
| `position` | sí | `{x, y}`. |

---

## `bridge`

Pieza de código determinista entre nodos. **Nodo de primera clase**, no es agente ni tool.

```json
{
  "id": "kb_result_summarizer",
  "name": "KB Result Summarizer",
  "kind": "summarize",
  "implementation": "code",
  "description": "Resume top-K resultados de KB en <500 tokens antes de pasar al responder",
  "inputSchema": "KBSearchResult[]",
  "outputSchema": "SummarizedKBContext",
  "position": { "x": 500, "y": 250 }
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `id` | sí | Único en la variante. |
| `name` | sí | Nombre humano. |
| `kind` | sí | Ver enum. |
| `implementation` | sí | Ver enum. |
| `description` | sí | Una frase clara: qué hace, qué garantías da. |
| `inputSchema` | no | Tipo del input (texto libre o referencia). |
| `outputSchema` | no | Tipo del output. |
| `position` | sí | `{x, y}`. |

### Enum `bridge.kind`

| Valor | Trabajo |
|---|---|
| `filter` | Quita campos / PII / ruido. |
| `transform` | Cambia formato. |
| `summarize` | Condensa payload grande. |
| `route` | Decide destino con reglas duras. |
| `validate` | Rechaza payloads malformados. |
| `persist` | Escribe al state / log / métricas. |
| `aggregate` | Combina N inputs en uno. |
| `compose` | Encadena varios bridges. |

### Enum `bridge.implementation`

| Valor | Cuándo |
|---|---|
| `code` | Función pura. **Preferida.** |
| `code_with_tool` | Necesita APIs externas (DB, HTTP). |
| `llm_micro` | LLM pequeño dedicado solo a esta transformación. **Último recurso, justificar.** |

---

## `dataStore`

```json
{
  "id": "ticket_db",
  "name": "Ticket DB",
  "type": "postgres",
  "position": { "x": 700, "y": 200 }
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `id` | sí | Único. |
| `name` | sí | Nombre humano. |
| `type` | sí | `postgres`, `redis`, `s3`, `file`, `vector_db`, etc. |
| `position` | sí | `{x, y}`. |

---

## `edge`

```json
{
  "id": "e1",
  "source": "orchestrator",
  "target": "classifier",
  "label": "ticket payload",
  "kind": "delegation",
  "via": null
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `id` | sí | Único. |
| `source` | sí | ID de cualquier nodo (agent/tool/bridge/dataStore). |
| `target` | sí | ID de cualquier nodo. |
| `label` | no | Texto sobre la edge en la UI. |
| `kind` | sí | Ver enum. |
| `via` | no | ID de un `bridge` por el que pasa la edge. Cuando existe, el viewer dibuja el bridge como nodo intermedio. |

### Enum `edge.kind`

| Valor | Significado |
|---|---|
| `delegation` | Un agente delega tarea a otro (sólida, color principal). |
| `tool_call` | Agente invoca tool (punteada). |
| `data_read` | Lectura desde dataStore (gris). |
| `data_write` | Escritura a dataStore (gris). |
| `event` | Evento asíncrono (curva, color secundario). |
| `handoff` | Transferencia explícita de control (sólida con flecha doble). |

---

## `history`

Lista de iteraciones. Cada entrada es un snapshot completo.

```json
{
  "timestamp": "2026-04-27T10:15:00Z",
  "variant": "intermediate",
  "summary": "Renombrado 'Classifier' a 'Intent Router' y añadida tool knowledge_base_search.",
  "snapshot": { /* copia completa de variants en ese momento */ }
}
```

**Reglas**:

- Cada modificación al JSON añade una entrada — sin excepciones.
- Las entradas no se borran nunca, solo se añaden.
- `snapshot` es la copia profunda de `variants` (no de todo el archivo).

---

## Validaciones que aplica `orchestration-critic`

- **Estado huérfano**: hay `stateRead` que ningún agente escribe.
- **Estado mudo**: hay `stateWrite` que nadie consume.
- **`react_loop` con una sola tool** → recomendar `tool_then_return`.
- **Edge sin `via` con payload "grande"** → recomendar bridge.
- **`shared_blackboard` con >3 escritores en la misma clave** → race condition.
- **Bridge `llm_micro` sin justificación** frente a alternativa determinista.
- **Orquestador con >5 tools o >4 sub-agentes** → saturación.
- **Delegación de >2 niveles** → revisar latencia y context bleed.

---

## Convenciones de IDs

- `kebab-case` o `snake_case`, consistente dentro de la variante.
- Verbos para tools (`search_kb`, `send_email`).
- Sustantivos para agentes (`orchestrator`, `classifier`).
- Sufijo `_bridge` u operación clara para bridges (`pii_filter`, `kb_summarizer`).
- IDs únicos **dentro de la variante**, pueden repetirse entre variantes.

---

## Compatibilidad hacia adelante

El esquema puede crecer con campos opcionales. Los subagentes:

- Nunca borran campos desconocidos.
- Si añaden un campo nuevo, lo documentan aquí en una entrada de `history`.
- Lo no-opcional se mantiene estable.
