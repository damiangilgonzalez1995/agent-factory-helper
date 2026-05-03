---
name: context-management
description: Estrategias para gestionar el contexto de los agentes (subagent isolation, compaction, RAG vs full-context, memory). Consulta al diseñar contextStrategy o cuando detectes saturación.
---

# Context Management

El contexto que ve un agente es uno de los recursos más caros y limitantes del sistema. Cómo lo gestionas decide la calidad, el coste y el riesgo de drift.

## Subagent isolation

**Qué es**: cuando un agente delega en otro (como en Claude Code), el sub-agente arranca con un contexto **limpio**, no hereda la conversación del padre.

**Cuándo usar**:
- Tareas que requieren contexto distinto al del padre (otro dominio, otro sistema prompt).
- Cuando el padre quiere protegerse de la verbosidad del hijo (que no infle su propio contexto).

**Trade-offs**:
- + Aislamiento perfecto, sin context bleed.
- − Si el sub-agente necesita información del padre, hay que pasársela explícitamente en el mensaje.
- − No comparte memoria conversacional con el padre.

**Buenas prácticas**:
- Pasa solo la información relevante al sub-agente, no toda la conversación.
- Si necesitas que sepa la "historia previa", resume en bridge antes.

---

## Compaction strategies

Estrategias para reducir el contexto cuando crece más allá de lo manejable.

### Sliding window

**Qué**: solo los últimos N turnos.

**Cuándo**:
- Conversaciones donde lo reciente importa y lo viejo no.
- Bots de soporte simples.

**Riesgo**: pérdida de contexto crítico que estaba al inicio (instrucciones del usuario, restricciones).

**Mitigación**: `windowed` + summary del histórico anterior anclado al system prompt.

### Hierarchical summary

**Qué**: el contexto se organiza en niveles (resumen general → resumen reciente → últimos turnos).

**Cuándo**:
- Hilos largos donde múltiples niveles de detalle importan.
- Casos donde el usuario referencia "lo que dijimos al principio".

### Auto-compaction (periódica)

**Qué**: cuando el contexto cruza un threshold, un proceso (LLM o code) lo resume y reemplaza la cola por el resumen.

**Cuándo**:
- Sistemas long-running.
- Memoria episódica donde lo viejo se compacta y lo nuevo se mantiene crudo.

---

## RAG vs full-context

### Full-context

**Cuándo**:
- Corpus pequeño y estable (cabe entero en el prompt).
- Frecuencia de cambio baja (menos actualizaciones que invocaciones).
- Latencia crítica (RAG añade un retrieval round-trip).

### RAG (recuperación bajo demanda)

**Cuándo**:
- Corpus grande (miles de documentos).
- Cambia frecuentemente (no quieres re-cachear cada cambio).
- Solo una pequeña parte es relevante por query.

**Heurística**:

| Tamaño corpus | Frecuencia cambio | Estrategia |
|---|---|---|
| <50 KB | Estable | Full-context |
| <50 KB | Cambia mucho | Full-context con prompt cache |
| 50KB - 5MB | Estable | RAG con embeddings cacheados |
| >5MB | Cualquiera | RAG obligatorio |
| Cualquier tamaño | Por usuario/sesión | RAG por scope (no compartido) |

---

## Memory

### Corto plazo (en contexto)

**Qué**: el historial de la conversación actual.

**Cuándo**:
- Sesiones únicas.
- Información que solo aplica al hilo actual.

### Largo plazo (en almacén externo)

**Qué**: hechos persistidos en una DB, vector store, o archivo.

**Cuándo**:
- Información del usuario que persiste entre sesiones (preferencias, historial).
- Hechos que se aprenden y deben conservarse.

**Patrones**:
- `Memory agent`: agente dedicado que escribe/lee la memoria. Lo invocan otros agentes vía tool.
- File-based memory: archivo por usuario/proyecto que se carga al inicio.

**Riesgos**:
- Memory drift (información obsoleta que contradice la realidad).
- Privacy (información sensible persistida).

**Mitigaciones**:
- Verificación al recuperar ("¿sigue siendo cierto?").
- Filtrado PII al escribir.
- TTL para entradas viejas.

---

## ContextStrategy de los agentes

Cada agente declara su `contextStrategy`:

| Estrategia | Descripción |
|---|---|
| `stateless` | Sin memoria. Cada llamada es independiente. |
| `windowed` | Últimos N turnos. |
| `summarized` | Historial resumido + algo reciente crudo. |
| `full_history` | Todo. **Cuidado con saturación.** |
| `rag` | Recuperación bajo demanda. |

### Cuándo cada una

- **Stateless**: routers, transformaciones puras, classifiers.
- **Windowed**: conversaciones cortas, soporte de primera línea.
- **Summarized**: hilos largos donde el contexto antiguo aún influye.
- **Full_history**: solo si el contexto es genuinamente pequeño y todo importa.
- **Rag**: cuando hay un corpus externo grande relevante.

---

## Síntomas de saturación

Cuando un agente recibe demasiado contexto, los síntomas son:

| Síntoma | Diagnóstico |
|---|---|
| Respuestas que ignoran el system prompt | Saturación: instrucciones tempranas se diluyen. |
| Repeticiones de información ya dada | El agente está "perdido" en su propio histórico. |
| Pérdida de instrucciones críticas (formato, restricciones) | El system prompt está siendo desplazado por el historial. |
| Drift del rol | El agente se convierte en algo distinto a lo que era. |
| Latencia creciente sin razón obvia | El prompt está cerca del max de tokens. |
| Coste por llamada disparado | Igual. |

**Mitigaciones rápidas**:
- Bajar `windowed` a menos turnos.
- Añadir bridge `summarize` antes de la edge que satura.
- Mover lo que era system prompt al `messages[0]` con prompt caching.
- Convertir `full_history` en `summarized`.

---

## Tabla "síntoma → estrategia"

| Síntoma | Estrategia recomendada |
|---|---|
| Contexto crece sin parar en hilos largos | `summarized` o Summarizer-in-the-loop |
| Múltiples agentes ven cosas que no deberían | Subagent isolation con bridges `filter` |
| Información del usuario se olvida entre sesiones | Memory agent + external store |
| Corpus grande de documentos referenciados | RAG con embeddings |
| El agente reinterpreta su rol con cada turno | Refresh del system prompt + Reflection |
| Múltiples agentes leen lo mismo y se contradicen | `scoped_state` con propietario único de cada slot |

---

## Cómo lo usa `context-strategist`

`context-strategist` lee esta skill al diseñar la variante. Para cada agente decide:

1. ¿Qué contextStrategy es la mínima viable?
2. ¿Necesita memoria persistente? Si sí, ¿agente dedicado o tool?
3. ¿Hay datos sensibles que filtrar? → bridge `filter`.
4. ¿Hay payloads grandes entrantes? → bridge `summarize`.
5. ¿Qué `stateModel` casa con esta estrategia? (`scoped_state` y `external_store` se llevan bien con memoria persistente; `message_passing` con `stateless` y `windowed`.)
