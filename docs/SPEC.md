# Multi-Agent Architecture Studio — Spec

> Especificación completa del proyecto. Fuente de verdad para diseño y construcción.

---

## 1. Propósito

Soy arquitecto de soluciones y diseño sistemas multiagente con frecuencia. Quiero un **estudio local de diseño asistido** donde:

1. Yo describo un caso de uso en lenguaje natural.
2. Una serie de **subagentes especializados** me interrogan por turnos para cuestionar mis decisiones, detectar huecos y forzarme a pensar bien la arquitectura **antes** de implementarla.
3. El sistema produce **3 propuestas de arquitectura escaladas**: Básica, Intermedia, Avanzada — todas viables, no solo "más cosas".
4. Cada arquitectura se renderiza en una **web local interactiva con React Flow** que puedo iterar conversando con Claude.
5. Las iteraciones quedan versionadas dentro del propio JSON de arquitectura.

**Filosofía clave**: el sistema no es un "validador" de arquitecturas ya hechas. Es un **socrático de diseño**. Su trabajo es ayudarme a decidir:

- qué agentes necesito,
- qué herramientas le doy a cada uno,
- qué modo de ejecución usa cada agente (ReAct loop, one-shot, tool-then-return…),
- cómo se comparte el state entre agentes y entre niveles,
- qué bridges (código no-LLM) median entre agentes para filtrar/transformar/enrutar contexto,
- cómo evito saturar al orquestador.

La auditoría (seguridad, costes…) viene después y es secundaria por ahora.

---

## 2. Stack técnico

### Decisiones tomadas

| Componente | Tecnología | Justificación |
|---|---|---|
| Orquestación de agentes | **Claude Code + subagentes (`.claude/agents/`)** | Es el entorno desde el que trabajaré. Subagentes nativos = aislamiento de contexto gratis. |
| Patrones de referencia | **Skills (`.claude/skills/`)** | Catálogo consultable por demanda, sin gastar contexto si no aplica. |
| Formato de arquitectura | **JSON único por proyecto** (`architectures/<case>.json`) | Una sola fuente de verdad. Versionado embebido. Fácil de parsear y de regenerar el diagrama. |
| Renderizado | **HTML + React Flow** servido en local con Vite | Drag & drop, interactivo, hot-reload al cambiar el JSON. Liviano (no Next.js, no backend). |
| Comunicación JSON ↔ UI | **File watcher + WebSocket** (Vite ya lo trae) | Cuando Claude modifica el JSON, el navegador refresca solo. |
| Versionado | **Historial dentro del JSON** (`history: []`) | Sin Git ceremonioso. Cada iteración añade un snapshot con timestamp y diff-summary. |
| Lenguaje del proyecto | TypeScript + React | Estándar para React Flow, buen tooling. |

### Lo que NO se usa

- No LangGraph / CrewAI / AutoGen — el proyecto es **agnóstico al framework** que use después en producción.
- No backend (FastAPI, Express…) — todo es estático servido por Vite + lectura del JSON.
- No base de datos — el JSON es el estado.
- No Mermaid — descartado por falta de interactividad real (drag & drop, edición visual).

---

## 3. Estructura de carpetas

```
multiagent-architecture-studio/
├── .claude/
│   ├── agents/                          # Subagentes interrogadores
│   │   ├── case-intake.md
│   │   ├── complexity-assessor.md
│   │   ├── agent-decomposer.md
│   │   ├── tool-designer.md
│   │   ├── execution-mode-designer.md
│   │   ├── context-strategist.md
│   │   ├── orchestration-critic.md
│   │   ├── architecture-synthesizer.md
│   │   └── diagram-editor.md
│   └── skills/                          # Patrones de referencia
│       ├── multiagent-patterns/SKILL.md
│       ├── execution-modes/SKILL.md
│       ├── context-management/SKILL.md
│       ├── tool-design/SKILL.md
│       ├── handoff-protocols/SKILL.md
│       ├── bridges-and-state/SKILL.md
│       └── failure-modes/SKILL.md
├── architectures/                       # Un JSON por caso
│   └── <case-slug>.json
├── viewer/                              # App React Flow
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── ArchitectureCanvas.tsx
│       │   ├── VariantSwitcher.tsx
│       │   ├── HistoryPanel.tsx
│       │   ├── StateModelBadge.tsx
│       │   └── NodeTypes/
│       │       ├── AgentNode.tsx
│       │       ├── ToolNode.tsx
│       │       ├── BridgeNode.tsx
│       │       └── DataStoreNode.tsx
│       ├── hooks/
│       │   └── useArchitectureFile.ts
│       └── lib/
│           └── jsonToFlow.ts
├── docs/
│   ├── SPEC.md
│   ├── ARCHITECTURE_SCHEMA.md
│   └── WORKFLOW.md
├── CLAUDE.md
├── README.md
└── .gitignore
```

---

## 4. Esquema del JSON de arquitectura

Formato canónico. La UI lo lee, los subagentes lo escriben, el historial vive dentro.

```json
{
  "case": {
    "slug": "customer-support-triage",
    "title": "Triage automático de tickets de soporte",
    "description": "Sistema que recibe tickets, los clasifica, los enruta y genera respuestas borrador.",
    "constraints": [
      "Latencia < 5s en P95",
      "Coste por ticket < 0.05 USD",
      "Sin PII en logs"
    ],
    "createdAt": "2026-04-27T10:00:00Z",
    "complexity": {
      "domain": 2, "task": 3, "context": 4, "tools": 2, "flow": 3,
      "total": 14,
      "verdict": "Multiagente ligero",
      "recommendedPatterns": ["Router", "Reflection"],
      "rationale": "..."
    }
  },
  "variants": {
    "basic":        { "stateModel": "...", "agents": [], "tools": [], "bridges": [], "dataStores": [], "edges": [], "rationale": "..." },
    "intermediate": { "stateModel": "...", "agents": [], "tools": [], "bridges": [], "dataStores": [], "edges": [], "rationale": "..." },
    "advanced":     { "stateModel": "...", "agents": [], "tools": [], "bridges": [], "dataStores": [], "edges": [], "rationale": "..." }
  },
  "activeVariant": "intermediate",
  "history": [
    {
      "timestamp": "2026-04-27T10:15:00Z",
      "variant": "intermediate",
      "summary": "Renombrado 'Classifier' a 'Intent Router' y añadida tool knowledge_base_search.",
      "snapshot": { "...": "copia completa de variants" }
    }
  ]
}
```

### 4.1 `variant`

```json
{
  "stateModel": "scoped_state",
  "agents": [...],
  "tools": [...],
  "bridges": [...],
  "dataStores": [...],
  "edges": [...],
  "rationale": "Esta variante es la mínima viable porque..."
}
```

### 4.2 `agent`

```json
{
  "id": "orchestrator",
  "name": "Orchestrator",
  "role": "Recibe el ticket, decide flujo, delega",
  "model": "claude-opus-4-7",
  "systemPromptSummary": "...",
  "tools": ["delegate_to_classifier", "delegate_to_responder"],
  "executionMode": "react_loop",
  "executionModeRationale": "Debe razonar sobre el resultado del classifier antes de delegar.",
  "contextStrategy": "windowed",
  "stateReads": ["ticket.payload"],
  "stateWrites": ["ticket.classification", "ticket.response_draft"],
  "position": { "x": 100, "y": 100 }
}
```

### 4.3 `tool`

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

### 4.4 `bridge`

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

### 4.5 `dataStore`

```json
{
  "id": "ticket_db",
  "name": "Ticket DB",
  "type": "postgres",
  "position": { "x": 700, "y": 200 }
}
```

### 4.6 `edge`

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

**Tipos de `edge.kind`**: `delegation`, `tool_call`, `data_read`, `data_write`, `event`, `handoff`.

### 4.7 Enums

- `agent.executionMode`: `react_loop`, `one_shot`, `tool_then_return`, `plan_then_execute`, `parallel_tools`.
- `agent.contextStrategy`: `stateless`, `windowed`, `summarized`, `full_history`, `rag`.
- `variant.stateModel`: `message_passing`, `shared_blackboard`, `scoped_state`, `external_store`.
- `bridge.kind`: `filter`, `transform`, `summarize`, `route`, `validate`, `persist`, `aggregate`, `compose`.
- `bridge.implementation`: `code`, `code_with_tool`, `llm_micro`.

---

## 4.5 Conceptos de primera clase: Execution Mode, State y Bridges

Estos tres ejes son **decisiones de diseño tan importantes como elegir los agentes**. El sistema debe forzar al usuario a tomarlas explícitamente para cada agente y cada conexión.

### 4.5.1 Execution Mode

Cada agente tiene un `executionMode` que define cómo se comporta cuando llama a herramientas:

| Modo | Comportamiento | Cuándo |
|---|---|---|
| `react_loop` | Itera: piensa → tool → observa → piensa → tool… hasta decidir terminar. | Tareas exploratorias, problemas mal definidos, agentes que deben razonar sobre resultados intermedios. |
| `one_shot` | Una sola llamada al LLM, sin tools. | Transformaciones, clasificación, extracción estructurada. **Bandera roja**: rara vez es un "agente"; suele ser una llamada LLM dentro de otro componente. |
| `tool_then_return` | El LLM elige UNA tool, se ejecuta, y el resultado vuelve **directamente al invocador**. El agente no vuelve a razonar. | Routers con LLM. Reduce coste y latencia ~50%. |
| `plan_then_execute` | El LLM genera un plan (lista de tool calls), un ejecutor determinista lo recorre sin volver a llamar al LLM. | Workflows con pasos predecibles, coste fijo, trazabilidad. |
| `parallel_tools` | El LLM lanza varias tools en paralelo en un turno y agrega resultados. | Búsquedas independientes, fan-out simétrico. |

**Antipatrón clásico**: usar `react_loop` cuando `tool_then_return` bastaría — más tokens, más latencia, abre puerta a loops y drift sin ganar nada.

### 4.5.2 State sharing

Cada variante declara un `stateModel`:

| Modelo | Descripción | Trade-offs |
|---|---|---|
| `message_passing` | Cada agente solo ve lo que el invocador le pasa explícitamente. | Aislamiento limpio. Difícil compartir contexto rico entre niveles. |
| `shared_blackboard` | Objeto de estado global que todos leen y escriben con claves. | Flexible. Riesgo de acoplamiento implícito y race conditions. |
| `scoped_state` | Cada subárbol de delegación tiene scope propio, hereda del padre, no contamina hermanos. | Buen punto medio. Requiere disciplina en bridges. |
| `external_store` | El estado vive fuera (Redis, DB, file). Acceso vía tools. | Persistente, debugeable. Latencia y complejidad operacional. |

Cada agente declara `stateReads` y `stateWrites`. Esto permite a `orchestration-critic` detectar:

- Lecturas sin escritor (dependencia rota).
- Escrituras sin consumidor (ruido).
- Conflictos de escritura entre hermanos.

### 4.5.3 Bridges

Un **bridge** es una pieza de código determinista entre dos agentes (o entre un agente y una tool, o entre un agente y el state). Trabajos típicos:

- **Filtrar**: quitar PII, descartar campos, recortar payload.
- **Transformar**: cambiar formato, normalizar, enriquecer.
- **Resumir**: condensar resultado grande antes de inyectarlo al siguiente contexto.
- **Enrutar**: decidir destino con reglas duras (no LLM).
- **Validar**: rechazar resultados malformados antes de propagarlos.
- **Persistir**: escribir al state, log, métricas.

**Por qué importan**: los bridges son el principal mecanismo para controlar el contexto que recibe cada agente. Sin bridges, el output completo de A entra al contexto de B — causa #1 de saturación.

#### Edges con bridges

```json
{ "id": "e1", "source": "kb_search", "target": "responder", "via": "kb_result_summarizer", "kind": "tool_call" }
```

El campo `via` es opcional. Cuando existe, el viewer dibuja el bridge como nodo intermedio en la edge.

### 4.5.4 Reglas que aplican los subagentes

- `agent-decomposer` pregunta el `executionMode` y lo justifica.
- `tool-designer`, para cada tool, pregunta si su salida necesita bridge antes de volver al agente.
- `context-strategist` revisa todas las edges sin `via` y cuestiona si el payload completo debe entrar al contexto del destino.
- `orchestration-critic` alerta si:
  - `react_loop` con una sola tool → debería ser `tool_then_return`.
  - Edge con payload "grande" sin bridge.
  - `shared_blackboard` con >3 agentes escribiendo en la misma clave.
  - Bridge `llm_micro` sin justificación frente a alternativas deterministas.
  - Slot de estado leído pero no escrito.

---

## 5. Subagentes (`.claude/agents/`)

Cada subagente es un `.md` con frontmatter YAML siguiendo el formato de Claude Code. **El sistema crece añadiendo subagentes**; los iniciales son los enfocados en *diseño*. Después se añadirán los de auditoría (seguridad, costes, etc.).

Los 9 subagentes iniciales:

1. `case-intake` — Recoge el caso inicial y lo normaliza.
2. `complexity-assessor` — Evalúa complejidad ANTES de proponer agentes (gatekeeper KISS).
3. `agent-decomposer` — Qué agentes necesitas y por qué.
4. `tool-designer` — Qué herramientas le das a cada agente.
5. `execution-mode-designer` — Decide `executionMode` y justifica.
6. `context-strategist` — `stateModel`, `contextStrategy`, bridges.
7. `orchestration-critic` — Riesgos y antipatrones.
8. `architecture-synthesizer` — Genera las 3 variantes.
9. `diagram-editor` — Aplica iteraciones en lenguaje natural sobre el JSON.

Cada uno con prompt detallado en `.claude/agents/<nombre>.md`.

---

## 6. Skills (`.claude/skills/`)

Cada skill es una carpeta con un `SKILL.md` que Claude consulta cuando aplica. **No se cargan siempre** — son referencia bajo demanda.

Las 7 skills iniciales:

1. `multiagent-patterns` — Catálogo de patrones canónicos (Single Agent, Orchestrator-Worker, Router, Pipeline, Map-Reduce, Reflection, etc.).
2. `execution-modes` — ReAct vs one-shot vs tool-then-return vs plan-then-execute vs parallel-tools.
3. `context-management` — Compaction, sub-agent isolation, memory, RAG vs full-context.
4. `tool-design` — Granularidad, idempotencia, error handling, MCP vs custom.
5. `handoff-protocols` — JSON schemas para mensajes entre agentes.
6. `bridges-and-state` — Bridges (filter/transform/summarize/route) y state models.
7. `failure-modes` — Loops infinitos, context bleed, tool hallucination, drift.

---

## 7. Aplicación de visualización (`viewer/`)

### Funcionalidad mínima

1. **Lee** `architectures/<slug>.json` al arrancar (ruta por query string: `?case=customer-support-triage`).
2. **Renderiza** la variante activa con React Flow:
   - Tipos de nodo distintos para `agents`, `tools`, `bridges`, `dataStores`.
   - Bridges con forma distinta (rombo/hexágono) y color neutro.
   - Edges con label y estilo según `kind` (delegación = sólida, tool_call = punteada, data = gris).
   - Cuando una edge tiene `via`, atraviesa el bridge correspondiente.
3. **Tabs** arriba para Básica / Intermedia / Avanzada.
4. **Badge visible** del `stateModel` de la variante activa.
5. **Panel lateral**:
   - `rationale` de la variante.
   - Al seleccionar agente: `executionMode`, `contextStrategy`, `stateReads`, `stateWrites`.
   - Lista de iteraciones del `history`.
6. **Hot reload**: cuando Claude modifica el JSON, el navegador refresca solo (Vite watcher + WS).
7. **Drag & drop**: el usuario mueve nodos. Se persiste la nueva `position` al JSON.

### Estilo

- Tema oscuro por defecto.
- Tipografía: Inter o similar.
- Sin frameworks UI pesados (no MUI / Antd). Tailwind o CSS plano.

### Comandos

```bash
cd viewer
npm install
npm run dev
```

Abre en `http://localhost:5173`. Si no se pasa `?case=...`, abre con el último caso modificado.

---

## 8. CLAUDE.md (instrucciones globales)

Ya creado en la raíz. Resume:

- Qué es el proyecto.
- Flujo recomendado de subagentes.
- Reglas duras (veredicto vinculante, history obligatorio, variantes distintas en filosofía, saturación del orquestador, executionMode justificado, bridges para payloads grandes, stateModel declarado).
- Filosofía de diseño y stack.

---

## 9. Flujo de uso (`docs/WORKFLOW.md`)

Documenta el flujo típico de uso paso a paso desde el primer prompt del usuario hasta la iteración sobre el diagrama renderizado.

---

## 10. Entregables

1. Toda la estructura de carpetas de la sección 3.
2. Los 9 archivos de subagentes con prompts completos.
3. Los 7 archivos de skills con contenido real, accionable, sin relleno.
4. La app `viewer/` funcional, con soporte para nodos `bridge` y badge de `stateModel`. `npm install && npm run dev` arranca y muestra al menos un caso de ejemplo.
5. Un caso de ejemplo en `architectures/example-customer-support.json` con las 3 variantes ya rellenas, **incluyendo al menos un bridge en la variante intermedia y varios bridges + state model claro en la avanzada**.
6. `CLAUDE.md`, `README.md`, `docs/ARCHITECTURE_SCHEMA.md`, `docs/WORKFLOW.md`.
7. `.gitignore` razonable.

---

## 11. Criterios de aceptación

- [ ] El usuario dice "quiero diseñar un sistema para X" y el flujo arranca solo.
- [ ] Los subagentes interrogan, no dan respuestas hechas.
- [ ] `complexity-assessor` da nota explícita y veredicto antes de proponer agentes.
- [ ] Si la complejidad es baja, el sistema propone Single Agent + Tools y se resiste a meter más.
- [ ] El sistema obliga a justificar el `executionMode` de cada agente.
- [ ] El sistema obliga a declarar el `stateModel` de cada variante.
- [ ] Cuando hay payloads grandes entre agentes, el sistema propone (o reclama) un `bridge`.
- [ ] Las 3 variantes son distintas en filosofía, con rationale comparativo.
- [ ] La web arranca con `npm run dev` y renderiza el ejemplo sin tocar nada.
- [ ] El usuario dice "renombra X" y ve el cambio en la web sin recargar manualmente.
- [ ] El historial dentro del JSON se llena con cada cambio.
- [ ] Añadir un nuevo subagente interrogador en el futuro es trivial: un `.md` más en `.claude/agents/`.

---

## 12. Notas finales

- **No sobrediseñar el viewer.** Es una herramienta personal local.
- **Sí cuidar la calidad de los prompts de los subagentes.** Esa es la pieza de valor real.
- Si hay dudas sobre el esquema JSON, proponer variación y justificar — no pedir permiso para detalles menores.
- Usar TypeScript estricto en el viewer. Tipar el esquema del JSON.
