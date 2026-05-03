---
name: failure-modes
description: Modos de fallo típicos en sistemas multiagente (loops, context bleed, tool hallucination, drift, race conditions) y mitigaciones. Consulta al auditar arquitecturas o cuando un sistema en producción se comporta extraño.
---

# Failure Modes

Catálogo de modos de fallo en sistemas multiagente. Para cada uno: descripción, síntomas observables, mitigaciones.

---

## Loops infinitos de delegación

### Qué es

Agente A delega en B, B delega en C, C delega de vuelta en A. O el mismo agente entra en `react_loop` sin condición de parada.

### Síntomas observables

- Latencia se dispara en una invocación concreta.
- Coste por invocación 10× lo normal.
- `depth` en los handoffs supera el threshold.
- Patrón en logs: el mismo `correlation_id` aparece muchas veces consecutivas.
- Output nunca llega o llega muy tarde.

### Mitigaciones

- **Hard cap en `depth`**: rechaza handoffs con `depth > maxDepth` (4-5 típicamente).
- **`maxSteps` en `react_loop`**: el loop no puede iterar más de N veces.
- **Detección de ciclos**: el orquestador mantiene un set de `(agent, request_id)` y rechaza repeticiones.
- **Dedup por `request_id`**: si el mismo handoff llega dos veces, devuelve la respuesta cacheada.
- **Tool `give_up_and_escalate`** siempre disponible para que el agente pueda salir voluntariamente.

---

## Context bleed

### Qué es

Un agente "ve" información que no debería: PII, contexto de otra sesión, instrucciones del padre que no aplican a su rol.

### Síntomas observables

- El agente menciona datos en su respuesta que no estaban en su prompt aparente.
- Respuestas consistentes con un rol distinto al asignado.
- Filtraciones de PII en logs o respuestas finales.
- En `shared_blackboard`: el agente B referencia algo que solo el agente A debería haber visto.

### Mitigaciones

- **Subagent isolation**: cuando se delega, el sub-agente arranca con contexto limpio (Claude Code lo hace por defecto).
- **`scoped_state`** en lugar de `shared_blackboard` cuando el aislamiento importa.
- **Bridges `filter`** antes de cada delegación que toque datos sensibles.
- **Validación en logs**: scanner de PII en outputs.
- **Tests con datos sintéticos** que verifican que el agente no menciona datos que no recibió.

---

## Tool hallucination

### Qué es

El agente se inventa parámetros para una tool, o llama a una tool que no existe. La tool falla o devuelve datos incorrectos.

### Síntomas observables

- Errores `INVALID_INPUT` o `VALIDATION_FAILED` repetidos en logs.
- El agente intenta tools con nombres similares pero distintos.
- Parámetros con tipos incorrectos (string donde se esperaba enum).

### Mitigaciones

- **Schemas estrictos** en las tools, validados antes de ejecutar.
- **Errores estructurados** con `code: "INVALID_INPUT"` y mensaje claro de qué campo falló.
- **Lista de tools concisa**: <7 tools por agente. Más → más espacio de hallucination.
- **Naming claro**: `lookup_user_by_email` no `lookup_user`.
- **Few-shot examples** en el system prompt para tools complejas.
- **Verifier** o bridge `validate` que rechaza llamadas mal formadas antes de ejecutar el side effect.

---

## Drift

### Qué es

El agente se desvía de su rol con el tiempo. Empieza siendo "Intent Router" y termina respondiendo directamente al cliente.

### Síntomas observables

- Respuestas con tono distinto al esperado.
- El agente toma decisiones fuera de su scope.
- Se "olvida" de instrucciones del system prompt en hilos largos.

### Mitigaciones

- **Subagent isolation**: cada delegación arranca con system prompt fresco.
- **Refresh periódico**: en `react_loop` largo, reinyectar el system prompt cada N turnos.
- **Reflection**: el agente revisa su última respuesta contra su rol antes de devolverla.
- **Supervisor**: agente que monitoriza adherencia al rol y corrige.
- **Reducir contexto**: `windowed` o `summarized` en lugar de `full_history`.

---

## Race conditions en `shared_blackboard`

### Qué es

Múltiples agentes escriben en la misma clave del blackboard simultáneamente. La última escritura "gana" sin coordinación.

### Síntomas observables

- Estado del blackboard cambia de forma inconsistente entre runs idénticos.
- Bugs intermitentes que no se reproducen.
- Ciertos campos a veces tienen valor de un agente, a veces de otro.

### Mitigaciones

- **`scoped_state` en lugar de `shared_blackboard`** cuando los agentes son hermanos no coordinados.
- **Propietario único por clave**: un solo agente escribe; los demás leen.
- **Locking optimista**: cada escritura lleva un `version` y rechaza si cambió.
- **Coordinador explícito**: un agente o bridge que serializa las escrituras conflictivas.

---

## Cascadas de errores

### Qué es

Un agente devuelve algo mal-formado o incorrecto, el siguiente lo acepta sin validar, el sistema completo entrega resultado erróneo.

### Síntomas observables

- Error visible al final del pipeline aunque cada paso individual no falló.
- Output con campos vacíos o sin sentido.
- El agente final justifica su respuesta con datos inexistentes.

### Mitigaciones

- **Bridges `validate`** entre agentes críticos.
- **Schemas estrictos** entre handoffs.
- **Verifier** al final del pipeline.
- **Reflection** en agentes intermedios que producen artefactos críticos.
- **Tests end-to-end** con casos conocidos.

---

## Saturación de contexto

### Qué es

El contexto que recibe un agente excede lo que puede manejar bien (token-wise o atención-wise). Las instrucciones tempranas se diluyen, el agente "se pierde".

### Síntomas observables

- El agente ignora instrucciones del system prompt.
- Respuestas repetitivas o redundantes.
- Pérdida de instrucciones críticas (formato, restricciones).
- Latencia y coste creciente sin razón obvia.
- Drift acumulativo.

### Mitigaciones

- **Bridges `summarize`** antes de edges con payloads grandes.
- **`contextStrategy: "windowed"` o `"summarized"`** en lugar de `"full_history"`.
- **Reducir tools** del agente saturado (<7).
- **Subagent isolation** para sub-tareas.
- **Compaction periódica** del historial.

---

## Escalation rota

### Qué es

El sistema no sabe cuándo pasar a humano. Casos críticos se procesan automáticamente con respuesta incorrecta. O al revés: escala todo y satura al equipo humano.

### Síntomas observables

- Casos sensibles con respuesta automática inadecuada.
- Cola humana satura con casos triviales.
- Errores recurrentes que no se escalan.
- Confianza baja del agente sin disparar escalado.

### Mitigaciones

- **Criterios de escalado explícitos** en el system prompt:
  - Confianza < threshold (ej. 0.6).
  - Categoría sensible (fraude, queja legal, salud).
  - Side effect irreversible.
- **Tool `escalate_to_human`** disponible para todos los agentes.
- **Context_for_human**: estructurado, no historial crudo.
- **Métricas de escalado**: tasa, distribución por categoría, tiempo de resolución.

---

## Otros modos

### Tool retry storms

Un fallo transitorio + retry sin backoff → tormenta de llamadas que tumba la API.

**Mitigación**: backoff exponencial + jitter, circuit breaker.

### Timeout cascades

Sub-agente lento → padre timea → padre redelega → loop de delegación.

**Mitigación**: timeouts coordinados (padre tiene mayor timeout que hijo).

### Modelo desactualizado

Agente usa modelo retirado o con comportamiento cambiado. Respuestas de calidad inferior tras update.

**Mitigación**: tests automatizados de regresión, versioning explícito del modelo.

### Cost blowup

Iteraciones largas en `react_loop` × número de invocaciones × modelo caro = factura inesperada.

**Mitigación**: presupuestos por request, monitoring por agente, alertas.

---

## Tabla resumen

| Modo de fallo | Síntoma rápido | Mitigación principal |
|---|---|---|
| Loop infinito | Latencia 10× normal, coste explota | `maxSteps`, hard cap `depth` |
| Context bleed | PII en respuesta, info de otra sesión | Subagent isolation + bridges `filter` |
| Tool hallucination | `INVALID_INPUT` repetidos | Schemas estrictos, tools <7, errores estructurados |
| Drift | Tono o decisiones fuera de rol | Refresh prompt, reflection, supervisor |
| Race condition | Bugs intermitentes en blackboard | `scoped_state`, propietario único por clave |
| Cascada de errores | Output final mal-formado | Bridges `validate` + verifier |
| Saturación contexto | Agente ignora system prompt | Bridges `summarize`, `windowed` |
| Escalation rota | Casos críticos sin humano | Criterios explícitos + tool `escalate` |
| Tool retry storm | API se cae bajo carga | Backoff + circuit breaker |
| Timeout cascade | Padre redelega tras timeout hijo | Timeouts coordinados |
| Modelo desactualizado | Calidad cae tras update | Tests de regresión, version pinning |
| Cost blowup | Factura inesperada | Presupuestos por request, alertas |

---

## Cómo lo usa `orchestration-critic`

`orchestration-critic` lee esta skill y revisa la propuesta agregada buscando estos modos de fallo:

- ¿Hay agente con `react_loop` sin `maxSteps`? → Riesgo loop.
- ¿Hay edge sin bridge con payload voluminoso? → Riesgo saturación.
- ¿Hay `shared_blackboard` con múltiples escritores en misma clave? → Riesgo race.
- ¿Hay tool con `sideEffect: "irreversible"` sin HITL? → Riesgo cascada de errores irrecuperable.
- ¿Hay tools >7 en un agente? → Riesgo hallucination + saturación.

Para cada riesgo detectado, severidad (`info`, `warn`, `block`) y mitigación recomendada.
