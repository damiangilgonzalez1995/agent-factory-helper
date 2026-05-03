# Multi-Agent Architecture Studio

## Qué es este proyecto

Un **estudio local de diseño asistido de arquitecturas multiagente**. El usuario describe un caso de uso en lenguaje natural y un conjunto de subagentes especializados (en `.claude/agents/`) le interrogan por turnos para forzar buenas decisiones arquitectónicas **antes** de implementar nada. El sistema produce 3 propuestas escaladas (Básica / Intermedia / Avanzada), todas viables, no solo "más cosas". Cada arquitectura se almacena en un único JSON por caso (`architectures/<slug>.json`) y se renderiza en una web local con React Flow (`viewer/`) que se refresca sola cuando el JSON cambia.

El sistema **no valida arquitecturas hechas**: es un **socrático de diseño**. Su trabajo es ayudar a decidir qué agentes existen, qué tools tiene cada uno, en qué `executionMode` corre, cómo se reparte el state, qué bridges (código no-LLM) median entre agentes, y cómo se evita saturar al orquestador.

La especificación completa del proyecto vive en `docs/SPEC.md`. Léela cuando necesites contexto profundo sobre el esquema JSON, los subagentes o el viewer.

## Flujo recomendado de los subagentes

El orden canónico para diseñar un caso nuevo es:

1. `case-intake` — normaliza el problema en JSON estructurado. Pregunta: título, descripción, inputs/outputs, actores, restricciones, volumen.
2. `complexity-assessor` — evalúa complejidad en 5 ejes (domain/task/context/tools/flow) y emite veredicto KISS. **Vinculante.**
3. `agent-decomposer` — propone agentes mínimos coherentes con el veredicto. Pregunta si cada agente se gana su sitio.
4. `tool-designer` — define tools por agente, sugiere bridges si la salida es voluminosa.
5. `execution-mode-designer` — fija `executionMode` y justifica.
6. `context-strategist` — define `stateModel`, `contextStrategy`, `stateReads`/`stateWrites`, y crea bridges.
7. `orchestration-critic` — revisa la propuesta completa y bloquea si detecta antipatrones serios.
8. `architecture-synthesizer` — genera las 3 variantes (básica / intermedia / avanzada) en el JSON.
9. `case-saver` — empaqueta todo en `architectures/<slug>.json`. Necesita recibir explícitamente: slug del proyecto, JSON de las 3 variantes, veredicto de complexity-assessor y el caso normalizado.
10. `diagram-editor` — aplica iteraciones en lenguaje natural sobre el JSON, registrando cada cambio en `history`.

Los subagentes pueden invocarse directamente por el usuario, o de forma proactiva cuando Claude detecta que toca esa fase.

## Reglas duras del proyecto

Estas reglas son **vinculantes** y los subagentes deben aplicarlas sin excepciones implícitas:

- **El veredicto de `complexity-assessor` es vinculante.** Si dice "Single Agent + Tools", no se puede proponer multiagente sin justificación explícita escrita en el JSON.
- **Nunca modificar el JSON sin añadir entrada al `history`.** Cada cambio lleva `timestamp`, `variant`, `summary` y `snapshot` completo. Nunca se borran entradas.
- **Las 3 variantes deben ser genuinamente distintas en filosofía**, no "la misma con más cosas". Cada una declara qué patrones aplica y un `rationale` que explica qué se gana y qué se paga frente a la anterior.
- **Saturación del orquestador**: si un orquestador acumula más de 5 herramientas o más de 4 sub-agentes, `orchestration-critic` debe avisar y proponer descomposición.
- **`executionMode` justificado para cada agente.** `react_loop` con una sola tool es bandera roja: probablemente debería ser `tool_then_return`.
- **Bridges para payloads grandes.** Toda edge que transporta resultados de búsqueda, documentos o listas debe pasar por un `bridge` (campo `via`), o justificar explícitamente por qué no.
- **`stateModel` declarado por variante.** Cada variante anuncia uno de: `message_passing`, `shared_blackboard`, `scoped_state`, `external_store`. Los agentes declaran `stateReads` y `stateWrites`.
- **Bridges como nodos de primera clase.** No son tools ni agentes. Tienen `kind` (`filter`, `transform`, `summarize`, `route`, `validate`, `persist`, `aggregate`, `compose`) e `implementation` (`code`, `code_with_tool`, `llm_micro` — este último siempre justificado frente a alternativas deterministas).

## Filosofía de diseño

- **KISS por defecto.** El primer patrón a considerar siempre es "Single Agent + Tools". Cada nuevo agente debe ganarse su sitio: o aporta especialización real, o reduce carga del principal de forma medible.
- **Los subagentes interrogan, no responden.** Su valor está en hacer preguntas que el usuario no se ha hecho. Cuestionar primero, proponer después.
- **El JSON es la única fuente de verdad.** UI lo lee, subagentes lo escriben, historial vive dentro. Sin DB, sin backend, sin Git ceremonioso para iteraciones.
- **Agnóstico al framework de runtime.** El estudio diseña arquitecturas; no asume LangGraph, CrewAI, AutoGen ni nada. La salida es JSON portable.

## Stack y convenciones técnicas

- **TypeScript estricto** en `viewer/` (tipar el esquema del JSON).
- **Vite + React + React Flow** para el viewer. Sin Next.js, sin backend propio, sin frameworks UI pesados (sin MUI / Antd). Tailwind o CSS plano.
- **Tema oscuro por defecto.** Tipografía Inter o similar.
- Hot reload del JSON vía Vite watcher + WebSocket.
- Drag & drop persiste `position` de vuelta al JSON.
- Bridges renderizan con forma distinta (rombo o hexágono) y color neutro, distintos de agentes (LLM) y tools (side-effect).

## Lo que NO se hace en este proyecto

- No auth, no deploy, no tests E2E. Es una herramienta personal local.
- No frameworks de orquestación (LangGraph/CrewAI/AutoGen) — el estudio es agnóstico.
- No backend (FastAPI/Express). Vite sirve estático y observa el JSON.
- No base de datos. El JSON es el estado.
- No Mermaid: descartado por falta de drag & drop real.
- No sobrediseñar el viewer. El valor de este proyecto está en la **calidad de los prompts de los subagentes**, no en la UI.

## Notas operativas para Claude

- Si tienes dudas reales sobre el esquema JSON, propón una variación y justifícala — no pidas permiso para detalles menores.
- Si vas a añadir un subagente nuevo (ej. `security-auditor`, `cost-auditor`), sigue el formato YAML de `.claude/agents/` y respeta el espíritu socrático: interroga, no respondas.
- Si el usuario pide un cambio en lenguaje natural sobre un diagrama existente (ej. *"renombra X a Y"*, *"añade una conexión de A a B"*), es trabajo de `diagram-editor` y siempre crea entrada en `history`.
- Para arrancar el viewer en desarrollo: `cd viewer && npm install && npm run dev`. Debe abrir en `http://localhost:5173` con el último caso modificado.
