---
name: handoff-protocols
description: Convenciones para los mensajes que viajan entre agentes (JSON schemas, metadatos, success/failure, idempotencia). Consulta al diseñar la comunicación entre agentes.
---

# Handoff Protocols

Cuando un agente delega en otro o pasa el control, el mensaje que viaja entre ambos es un contrato. Si lo dejas implícito, los fallos son silenciosos. Si lo formalizas, el sistema es debugeable.

## Estructura base de un handoff

```json
{
  "request_id": "req_2026-04-27_5f3a",
  "parent_agent": "orchestrator",
  "depth": 1,
  "correlation_id": "ticket_4729",
  "timestamp": "2026-04-27T10:15:00Z",
  "task": {
    "type": "classify_ticket",
    "payload": { "ticket_id": "4729", "subject": "...", "body": "..." }
  },
  "context_hints": {
    "language": "es",
    "tier": "premium"
  },
  "constraints": {
    "max_latency_ms": 3000,
    "max_tokens": 2000
  }
}
```

### Campos obligatorios

| Campo | Por qué |
|---|---|
| `request_id` | Trazabilidad end-to-end. Único por request entrante. |
| `parent_agent` | Saber quién originó el handoff. |
| `depth` | Profundidad de delegación. Para detectar cadenas excesivas y limitar. |
| `correlation_id` | Identificador del objeto de negocio (ticket, order, user). Permite correlar logs. |
| `timestamp` | ISO. Para logs y latencia. |
| `task.type` | Enum corto que el receptor sabe interpretar. |
| `task.payload` | Datos para hacer el trabajo. |

### Campos opcionales útiles

| Campo | Cuándo |
|---|---|
| `context_hints` | Información que el receptor podría querer pero no es esencial (idioma, tier). |
| `constraints` | Limites operacionales (latencia, tokens, presupuesto). |
| `dry_run` | Para tareas con side effect: validar sin aplicar. |
| `priority` | Para colas con priorización. |

---

## Estructura base de la respuesta

```json
{
  "request_id": "req_2026-04-27_5f3a",
  "agent": "classifier",
  "status": "ok",
  "result": {
    "category": "billing",
    "confidence": 0.92,
    "reasoning": "El ticket menciona 'cobro' y 'factura'."
  },
  "metrics": {
    "latency_ms": 245,
    "tokens": 187
  },
  "next_action": "delegate_to_billing_responder"
}
```

### Status posibles

| Status | Cuándo |
|---|---|
| `ok` | Trabajo completo, resultado listo. |
| `error` | Fallo recoverable o no. Acompaña con `error.code`, `error.retryable`. |
| `escalated` | El agente decidió no manejarlo y lo eleva. Adjunta `escalation_reason`. |
| `pending` | Necesita confirmación humana o paso async. Adjunta `next_action`. |
| `partial` | Resultado parcial. Para tareas largas o con timeout. |

---

## Cuándo pasar contexto completo vs un resumen

### Pasar todo

- Cuando el sub-agente necesita razonar sobre el matiz (clasificación contextual, redacción).
- Cuando "resumir" el contexto perdería información crítica.

### Pasar resumen / contexto reducido

- Cuando el sub-agente solo necesita el dato concreto (no hace falta saber la conversación entera).
- Cuando hay PII que no debe propagarse → pasa por bridge `filter`.
- Cuando el contexto cabe en >50% del prompt del sub-agente → riesgo saturación.

### Patrón "context envelope"

El mensaje viaja con tres capas:

1. **Identidad** (`request_id`, `correlation_id`).
2. **Tarea** (qué hacer).
3. **Contexto** (qué necesita saber para hacerlo).

Cuando dudas, mete en *contexto* solo lo que el receptor preguntará si no lo das.

---

## Convenciones de éxito/fallo

### Éxito

```json
{ "status": "ok", "result": { ... }, "next_action": null }
```

`next_action` puede sugerir al invocador qué hacer (delegar a otro especialista, devolver al usuario, etc.). El invocador es libre de seguirlo o no.

### Error recoverable

```json
{
  "status": "error",
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "La KB no respondió en 5s",
    "retryable": true,
    "retry_after_ms": 1000
  }
}
```

### Error no recoverable

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_INPUT",
    "message": "El ticket no tiene cuerpo",
    "retryable": false
  }
}
```

### Escalation

```json
{
  "status": "escalated",
  "escalation_reason": "Categoría 'fraude' requiere revisión humana",
  "context_for_human": {
    "ticket_id": "4729",
    "summary": "Cliente sospecha cobro no autorizado por 540€ el 2026-04-27",
    "evidence": [...]
  }
}
```

El humano nunca debe leer el historial completo del agente — debe leer un resumen estructurado.

---

## Idempotencia de handoffs

Si el mismo `request_id` llega dos veces (por retry de red, etc.), el receptor debería:

- Detectar el duplicado (caché en memoria, tabla, etc.).
- Devolver la misma respuesta sin re-ejecutar trabajo.

Esto es crítico cuando el handoff dispara side effects (envío de email, cobro). Sin idempotencia, un retry duplica el efecto.

---

## Profundidad y límites

- Cada handoff incrementa `depth` en 1.
- El sistema debe **rechazar** handoffs con `depth > maxDepth` (típicamente 4-5).
- Esto previene loops accidentales y cadenas excesivas que multiplican latencia.

---

## Ejemplos

### Orquestador → Worker

```json
{
  "request_id": "req_4729_001",
  "parent_agent": "orchestrator",
  "depth": 1,
  "correlation_id": "ticket_4729",
  "task": {
    "type": "classify_ticket",
    "payload": { "subject": "Mi factura está mal", "body": "..." }
  },
  "constraints": { "max_latency_ms": 1000 }
}
```

### Worker → Router (delega)

```json
{
  "request_id": "req_4729_002",
  "parent_agent": "classifier",
  "depth": 2,
  "correlation_id": "ticket_4729",
  "task": {
    "type": "compose_response",
    "payload": {
      "category": "billing",
      "ticket_id": "4729",
      "user_tier": "premium"
    }
  }
}
```

### Escalation a humano

```json
{
  "request_id": "req_4729_003",
  "status": "escalated",
  "escalation_reason": "Confianza < 0.6 en clasificación; ambigüedad entre billing y fraud.",
  "context_for_human": {
    "ticket_id": "4729",
    "subject": "Mi factura está mal",
    "summary": "Cliente premium reporta factura de 540€ que no reconoce. Usuario activo desde 2024.",
    "actions_taken": ["KB search realizada, sin resultado claro"],
    "recommended_action": "Asignar a especialista de billing senior."
  }
}
```

---

## Buenas prácticas

- **`request_id` siempre presente.** Sin él, no hay trazabilidad.
- **`correlation_id` cuando aplique.** Permite correlar todos los handoffs de un mismo objeto de negocio.
- **`depth` validado**, hard-cap.
- **Schemas tipados** en el `task.payload`. No `payload: any`.
- **Idempotencia por defecto** en los receptores.
- **Logging estructurado** en cada handoff: emit + receive.

---

## Cómo lo usan los subagentes

- `tool-designer` aplica esta skill al definir contratos de tools que delegan en sub-agentes.
- `context-strategist` usa los conceptos de `context_hints` y context envelope para decidir bridges `filter`/`transform`.
- `orchestration-critic` valida que los handoffs respetan el contrato (depth, idempotencia, structured errors).
