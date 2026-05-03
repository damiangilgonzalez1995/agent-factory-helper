---
name: execution-modes
description: Guía para elegir el executionMode de un agente (react_loop, one_shot, tool_then_return, plan_then_execute, parallel_tools). Consulta cuando estés diseñando un agente nuevo o auditando uno existente.
---

# Execution Modes

El `executionMode` define cómo se comporta un agente cuando llama a tools. Es una decisión que afecta coste, latencia y robustez de manera dramática y a menudo se pasa por alto.

## Los 5 modos

### `react_loop`

**Qué hace**: el agente itera. Piensa → llama tool → observa resultado → vuelve a pensar → llama otra tool → … hasta decidir terminar.

**Cuándo es necesario**:
- Tareas exploratorias donde el siguiente paso depende del resultado del anterior.
- Problemas mal definidos donde el agente tiene que descubrir el camino.
- Tools donde la salida es ambigua o variada y requiere interpretación.

**Cuándo es overkill**:
- Una sola tool. (Bandera roja: usa `tool_then_return`.)
- Flujo predecible. (Usa `plan_then_execute`.)
- Tools independientes que se podrían lanzar en paralelo. (Usa `parallel_tools`.)

**Riesgos**:
- Loops infinitos sin condición de parada.
- Drift: el agente se desvía de su rol con cada turno.
- Coste y latencia explotan en peores casos.

**Mitigaciones**:
- `maxSteps` explícito.
- Reflection cada N turnos para reanclar al objetivo.
- Tool `give_up_and_escalate` siempre disponible.

---

### `one_shot`

**Qué hace**: una sola llamada al LLM, sin tools. Entra prompt, sale respuesta.

**Cuándo se usa**:
- Transformación pura (extraer entidades, resumir, formatear).
- Clasificación cuando ya tienes el input completo.

**Bandera roja**: rara vez es un "agente" de verdad. Suele ser una llamada LLM que pertenece dentro de un bridge `llm_micro` o como pieza de un pipeline.

**Pregunta clave antes de aceptar `one_shot`**: *"¿Esto necesita ser un agente independiente o es un paso de transformación dentro de otra cosa?"*

---

### `tool_then_return`

**Qué hace**: el LLM elige UNA tool, se ejecuta, y el resultado se devuelve **directamente al invocador**. El agente no vuelve a razonar sobre la salida.

**Cuándo brilla**:
- Routers: clasificar y delegar al especialista.
- Wrappers de tools donde el agente solo decide qué hacer, lo hace, y delega de vuelta.
- Cuando el invocador (otro agente o el orquestador) sabe interpretar la salida.

**Por qué es el modo más infrautilizado**:
- Reduce coste y latencia ~50% vs `react_loop` (un solo turno LLM en vez de varios).
- Elimina riesgo de loops y drift.
- Más fácil de debuggear.

**Cuándo NO**:
- Si la salida realmente necesita interpretación contextual antes de devolverla.
- Si el resultado puede requerir un retry con parámetros distintos.

---

### `plan_then_execute`

**Qué hace**: el LLM genera un plan completo (lista de tool calls con parámetros), luego un ejecutor determinista (código) lo recorre sin volver a llamar al LLM.

**Cuándo**:
- Workflows con pasos predecibles.
- Trazabilidad obligatoria (auditoría, compliance).
- Coste fijo deseable.

**Ventajas**:
- Coste predecible (un solo turno LLM).
- Plan inspectable antes de ejecutar.
- Fácil de testear.

**Riesgos**:
- Si un paso intermedio falla, el plan no se re-evalúa. Puede dejar estado inconsistente.
- Validar el plan antes de ejecutar (schema, dependencias).
- Si hay side effects, considerar puntos de checkpoint.

---

### `parallel_tools`

**Qué hace**: el LLM emite múltiples tool calls en un único turno; se ejecutan en paralelo; los resultados se agregan y vuelven al LLM (o no, según diseño).

**Cuándo**:
- Búsquedas independientes (consultar 3 fuentes a la vez).
- Fan-out simétrico donde no hay dependencia entre tools.

**Riesgos**:
- Si las tools tienen side effects no idempotentes, conflictos.
- Si una tool depende del output de otra → mal modo.

---

## Tabla comparativa

| Modo | Tokens LLM | Latencia | Determinismo | Riesgo loops |
|---|---|---|---|---|
| `react_loop` | alto (N turnos) | alta | bajo | alto |
| `one_shot` | bajo (1 turno) | baja | alto | nulo |
| `tool_then_return` | bajo (1 turno) | media | alto | nulo |
| `plan_then_execute` | medio (1 turno LLM + N ejec.) | media | alto | nulo |
| `parallel_tools` | medio (1-2 turnos) | baja | medio | bajo |

---

## Árbol de decisión

```
¿El agente tiene tools?
├─ No → `one_shot` → ¿realmente es un agente o un bridge `llm_micro`?
└─ Sí
   ├─ ¿Solo una tool?
   │   ├─ Sí → `tool_then_return` (default) o `react_loop` solo si hay condicional sobre la salida
   │   └─ No
   │       ├─ ¿Las tools son independientes y se pueden lanzar a la vez?
   │       │   └─ Sí → considera `parallel_tools`
   │       ├─ ¿El flujo es siempre los mismos pasos?
   │       │   └─ Sí → `plan_then_execute` (coste fijo, trazabilidad)
   │       └─ ¿El siguiente paso depende del resultado del anterior?
   │           ├─ Sí → `react_loop` (con maxSteps explícito)
   │           └─ No → revisa, probablemente algo de los anteriores aplica
```

---

## Antipatrones

### `react_loop` con una sola tool

El más común y caro. El agente entra al loop, llama la tool, vuelve a "pensar" sobre la salida, y a menudo solo emite el resultado. Coste: 2× tokens, +1 turno latencia, posible loop.

**Fix**: cambiar a `tool_then_return`. Si necesitas algo de razonamiento sobre el resultado, ese razonamiento puede vivir en el invocador o en un bridge `transform`.

### `react_loop` sin condición de parada

Un agente que entra al loop y no tiene cláusula de salida bien definida. Riesgo: agotar presupuesto de tokens, drift, hang.

**Fix**: declarar `maxSteps`, condición de "considerarse satisfecho", y tool `give_up_and_escalate`.

### `plan_then_execute` con tools de side effect sin checkpoints

El plan se ejecuta sin re-evaluar; si el paso 3 falla, los pasos 1 y 2 ya tuvieron side effect.

**Fix**: validar el plan antes de ejecutar; añadir checkpoints o bridges `validate` entre pasos.

### `parallel_tools` con dependencias

Lanzar `getUser(id)` y `getOrders(userId)` en paralelo cuando la segunda depende del output de la primera.

**Fix**: cambiar a `react_loop` o `plan_then_execute`.

### `one_shot` disfrazado de agente

Un agente que solo hace una transformación textual. Está duplicando el coste de un bridge `llm_micro`.

**Fix**: convertir en bridge si la transformación no requiere ser un agente independiente.

---

## Ejemplos

| Escenario | Modo recomendado |
|---|---|
| Router clasifica ticket en una de 5 categorías y delega | `tool_then_return` |
| Responder busca en KB iterativamente hasta encontrar info suficiente | `react_loop` con maxSteps=4 |
| Pipeline de extracción → normalización → enriquecimiento (siempre los 3) | `plan_then_execute` |
| Buscar en 3 fuentes (KB interno, FAQ, docs) y combinar | `parallel_tools` |
| Detectar idioma de un texto | `one_shot` (probablemente bridge `llm_micro` o code con detector) |

---

## Cómo lo usa `execution-mode-designer`

El subagente `execution-mode-designer` lee esta skill y aplica el árbol de decisión. Para cada agente del JSON:

1. Identifica número de tools.
2. Pregunta sobre dependencias y predictibilidad.
3. Asigna modo y exige justificación en `executionModeRationale`.
4. Marca como bandera roja todo `react_loop` con una sola tool sin justificación robusta.
