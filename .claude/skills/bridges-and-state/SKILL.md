---
name: bridges-and-state
description: Bridges (piezas de código no-LLM entre agentes) y modelos de state. Consulta al diseñar la variante intermedia o cuando un agente recibe payloads grandes/sensibles.
---

# Bridges and State

Las dos decisiones que más afectan a la salud de un sistema multiagente, y las dos más infravaloradas.

## Qué es un bridge

Un **bridge** es una pieza de código determinista que se sitúa entre dos agentes (o entre un agente y una tool, o entre un agente y el state). **No es un agente, no es una tool.** Es plumbing.

### Trabajos típicos

- **Filtrar**: quitar PII, descartar campos innecesarios, recortar payload.
- **Transformar**: cambiar formato, normalizar, enriquecer.
- **Resumir**: condensar payload grande antes de inyectar al siguiente agente.
- **Enrutar**: decidir destino con reglas duras (no LLM).
- **Validar**: rechazar payloads malformados.
- **Persistir**: escribir al state, log, métricas.
- **Agregar**: combinar N inputs en uno.
- **Componer**: encadenar varios bridges.

### Por qué importan

Los bridges son **el principal mecanismo para controlar el contexto** que recibe cada agente. Sin bridges, el output completo de A entra al contexto de B — y eso es la causa #1 de saturación de contexto.

---

## Tipos (`bridge.kind`)

### `filter`

**Ejemplo**: `pii_filter` que elimina email, teléfono, nombre del payload antes de pasar al `analyzer`.

**Cuándo**:
- Datos sensibles que no deben llegar al siguiente.
- Campos irrelevantes que ensucian el contexto.

### `transform`

**Ejemplo**: `csv_to_json` que parsea un CSV de respuesta de tool a un objeto estructurado.

**Cuándo**:
- Cambio de formato.
- Normalización (fechas, monedas, unidades).
- Enriquecimiento determinista (añadir campos calculados).

### `summarize`

**Ejemplo**: `kb_result_summarizer` que toma top-K resultados de KB y devuelve un resumen estructurado <500 tokens.

**Cuándo**:
- Output voluminoso que satura el contexto.
- Información que se puede condensar sin perder lo esencial.

**Implementación**: típicamente `code` con reglas (extraer top-N, recortar campos), o `llm_micro` si el resumen requiere lenguaje natural.

### `route`

**Ejemplo**: `category_router` que recibe `{category}` del classifier y decide a qué especialista mandar.

**Cuándo**:
- Decisión basada en reglas duras (mapping enum → destino).
- Más barato que un LLM router cuando las reglas son explícitas.

### `validate`

**Ejemplo**: `invoice_validator` que rechaza payloads con totales inconsistentes antes de pasarlos a `send_invoice`.

**Cuándo**:
- Antes de side effects irreversibles.
- Para garantizar contratos antes de delegar.

### `persist`

**Ejemplo**: `metrics_logger` que escribe métricas a un store después de cada decisión del classifier.

**Cuándo**:
- Observabilidad sin acoplar al agente.
- Side effects de logging/persistencia que no deben contaminar la lógica del agente.

### `aggregate`

**Ejemplo**: `multi_source_aggregator` que combina resultados de KB Search, FAQ Search y Docs Search en un solo bundle estructurado.

**Cuándo**:
- Múltiples fuentes contribuyen al mismo destino.
- Tras un fan-out con `parallel_tools`.

### `compose`

**Ejemplo**: `clean_summarize_pipeline` que encadena `pii_filter` + `kb_result_summarizer` en un solo bridge.

**Cuándo**:
- Varios bridges que siempre se ejecutan juntos. Mejor uno con `kind: compose` que cadena anidada confusa.

---

## Bridge vs sub-agente vs tool — árbol de decisión

Pregunta clave: **¿la operación requiere razonar?**

```
¿La operación es determinista?
├─ Sí → bridge (`code` preferido)
│   └─ ¿Tiene side effect externo (DB, HTTP, etc.)?
│       ├─ Sí → bridge `code_with_tool` o tool aparte
│       └─ No → bridge `code`
└─ No, requiere razonar sobre el contenido
    ├─ ¿Es una operación pequeña y bien acotada (resumen, clasificación binaria)?
    │   └─ Sí → bridge `llm_micro` (último recurso, justificar)
    └─ No → sub-agente
```

### Reglas

- **Si la lógica se puede expresar con código** (regex, mapping, schema validation) → bridge `code`.
- **Si la lógica se puede expresar con un LLM pequeño** (clasificación, extracción) que no necesita ser un agente → bridge `llm_micro`. Justifica por qué no lo hace un agente vecino.
- **Si requiere razonamiento contextual o planificación** → sub-agente.
- **Si tiene side effect externo claro** → tool, expuesta al agente.

---

## Implementaciones (`bridge.implementation`)

### `code` (preferido)

Función pura. Sin LLM, sin side effects.

```ts
function piiFilter(payload: any): any {
  return { ...payload, email: '<redacted>', phone: '<redacted>' };
}
```

**Cuándo**:
- Reglas claras (filtrado, transformación, validación de schema).

**Por qué preferida**:
- Coste cero por invocación.
- Latencia <1ms.
- Determinista, testeable.

### `code_with_tool`

Función que llama a APIs externas (DB, HTTP, embeddings).

```ts
async function enrichWithUserTier(payload: TicketPayload) {
  const tier = await fetchTier(payload.user_id);
  return { ...payload, user_tier: tier };
}
```

**Cuándo**:
- Necesitas datos externos para transformar.
- Embeddings, lookups en stores.

**Riesgos**:
- Latencia y disponibilidad de la API externa.
- Tratar errores externos sin romper el flujo.

### `llm_micro` (último recurso)

Una llamada LLM pequeña dedicada a la transformación.

```ts
async function summarizeKBResults(results: KBResult[]) {
  return await llm.complete({
    model: "claude-haiku-4-5",
    prompt: `Resume estos resultados en <500 tokens: ${JSON.stringify(results)}`,
    maxTokens: 500
  });
}
```

**Cuándo justificarlo**:
- La transformación requiere lenguaje natural genuino (resumir, parafrasear).
- No es expresable con reglas o regex.

**Cuándo NO**:
- Clasificación con enum claro → bridge `code` con reglas + fallback simple.
- Filtrado por presencia de patrones → regex.
- Extracción estructurada de input estructurado → parser.

---

## State models

Cada variante declara `stateModel`. Es la decisión más importante después de elegir agentes.

### `message_passing`

Cada agente solo ve lo que el invocador le pasa explícitamente en el mensaje. No hay estado compartido.

**Ventajas**:
- Aislamiento limpio.
- Fácil razonar sobre qué sabe cada agente.
- Sin race conditions.

**Desventajas**:
- Compartir contexto rico entre niveles requiere pasar todo por el mensaje.
- Si el árbol es profundo, el mensaje se infla.

**Cuándo elegirlo**:
- Sistemas jerárquicos cortos.
- Cuando el aislamiento es crítico (PII, multi-tenant).

### `shared_blackboard`

Hay un objeto de estado global que todos los agentes leen y escriben con claves bien definidas.

**Ventajas**:
- Colaboración asíncrona y paralela.
- Útil para "redactar un informe entre varios" — cada uno aporta su sección.

**Desventajas**:
- Race conditions si múltiples agentes escriben en la misma clave.
- Acoplamiento implícito difícil de seguir.

**Cuándo elegirlo**:
- Colaboración paralela con secciones bien delimitadas (1 escritor por clave).

**Regla**: si tienes >3 agentes escribiendo en la misma clave, replantea.

### `scoped_state`

Cada subárbol de delegación tiene su propio scope, hereda del padre pero no contamina hermanos.

**Ventajas**:
- Punto medio entre los anteriores.
- Sub-tareas independientes no se pisan.

**Desventajas**:
- Requiere disciplina en bridges para definir scope.
- Más overhead conceptual.

**Cuándo elegirlo**:
- Sistemas de 2-3 niveles donde subtareas son independientes.

### `external_store`

El estado vive en un store externo (Redis, DB, file). Los agentes leen/escriben con tools.

**Ventajas**:
- Persistencia real entre sesiones.
- Debugeable, replayeable.

**Desventajas**:
- Latencia de IO.
- Complejidad operacional (versioning, locking).

**Cuándo elegirlo**:
- Estado que debe persistir.
- Auditoría obligatoria.
- Multi-instancia (varios workers).

---

## `stateReads` y `stateWrites`

Cada agente declara explícitamente qué lee y qué escribe del state. Esto permite a `orchestration-critic` detectar:

- **Lecturas sin escritor**: dependencia rota.
- **Escrituras sin consumidor**: ruido.
- **Conflictos de escritura**: race condition latente.

### Buenas prácticas

- Paths con punto: `ticket.payload`, `ticket.classification.category`.
- Granularidad útil: no `ticket.*` (demasiado amplio); no `ticket.classification.confidence` (demasiado fino).
- Un solo propietario por path (un agente que lo escribe).
- Múltiples lectores está bien.

---

## Antipatrones

### Bridge `llm_micro` cuando bastaba código

Síntoma: el bridge resume "elimina la PII" o "extrae el campo X" usando un LLM.

**Coste**: tokens + latencia + posible hallucination.

**Fix**: regex / parser / validator.

### Cadena de bridges anidados que esconden lógica

Síntoma: `transform_a` → `transform_b` → `transform_c` → `validate` → ... pasando por la edge.

**Problema**: difícil de seguir, lógica dispersa.

**Fix**: un solo bridge `compose` con la cadena documentada.

### Estado compartido sin propietario claro

Síntoma: `shared_blackboard` con `ticket.metadata` escrito por 4 agentes.

**Problema**: race condition, comportamiento no determinista.

**Fix**: `scoped_state` con propietario único o un coordinador único.

### Pasar output completo de A a B sin filtrar

Síntoma: el classifier devuelve `{category, raw_input, debug_info, embeddings}` y todo entra al contexto del responder.

**Problema**: saturación.

**Fix**: bridge `filter` que extrae solo `{category, confidence}`.

### Tools de lectura masivas sin bridge `summarize`

Síntoma: `kb_search` devuelve 20 documentos a 5K tokens cada uno y todos entran al contexto del responder.

**Problema**: saturación inmediata + drift.

**Fix**: bridge `summarize` con top-K + recorte por longitud.

---

## Cómo lo usan los subagentes

- `tool-designer` consulta esta skill al decidir si la salida de una tool necesita bridge.
- `context-strategist` consulta para diseñar bridges entre agentes y elegir `stateModel`.
- `orchestration-critic` consulta para auditar antipatrones.
- `agent-decomposer` consulta para distinguir cuándo algo es bridge vs sub-agente.
