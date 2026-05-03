---
name: tool-design
description: Buenas prácticas para diseñar tools que los agentes invocan (granularidad, idempotencia, error handling, MCP vs custom, naming). Consulta al definir tools por agente.
---

# Tool Design

Las tools son el músculo del agente: lo que le permite tener efecto en el mundo. Su diseño afecta lo que el agente puede hacer, qué errores puede cometer, y cuán robusto es el sistema.

## Granularidad

### Una tool por intención, no por endpoint

Si tu API tiene `GET /users/{id}` y `GET /users?email=...`, **no expongas dos tools**. Expón una: `lookup_user(criteria)`.

| Mal | Bien |
|---|---|
| `read_user_by_id`, `read_user_by_email`, `read_user_by_phone` | `lookup_user(criteria)` |
| `send_email_template_a`, `send_email_template_b` | `send_templated_email(template, …)` |
| `query_db(sql)` | tools verticales por intención: `query_orders_by_status`, `find_open_tickets` |
| `call_api(url, method, body)` | tools específicas: `create_invoice`, `cancel_subscription` |

### Por qué importa

- Menos tools = menos espacio de decisión = menos hallucination.
- Tools verticales son más fáciles de validar y monitorizar.
- Schemas más estrictos (no `body: object`, sino `body: InvoicePayload`).

### Cuándo dividir

- Si una tool tiene >7 parámetros: probablemente esconde 2 tools distintas.
- Si dos invocaciones de la "misma" tool requieren contextos cognitivos muy distintos: divide.

---

## Idempotencia y retry-safety

### Idempotente

**Qué**: la misma llamada con los mismos parámetros produce el mismo efecto. Llamarla 2 veces = llamarla 1.

**Importante porque**:
- Reintentos seguros si la red falla.
- Posible cache.
- Composable con sistemas distribuidos.

### Cómo hacer una tool idempotente

- Para **lecturas**: trivialmente idempotentes.
- Para **escrituras**: usar `idempotency_key` que el agente genera (UUID). El servidor garantiza que la misma key produce el mismo resultado.
- Para **mutaciones específicas**: `update_user(id, fields)` con `If-Match` headers o versionado optimista.

### Tools no-idempotentes

A veces inevitable (ej. `send_email`). Marca `idempotent: false` y documenta:
- Si falla, ¿reintentamos? ¿Cómo evitamos duplicados?
- ¿Hay un `dedup_key`?

---

## Error handling

### Tool devuelve error estructurado vs lanza excepción

**Recomendado**: estructurado.

```json
{
  "status": "error",
  "code": "USER_NOT_FOUND",
  "message": "No user with id=42",
  "retryable": false
}
```

**Por qué**:
- El agente puede razonar sobre el error y decidir.
- No se pierde contexto entre la tool y el agente.
- Los códigos de error son enums, no texto libre.

### Estructura recomendada

| Campo | Significado |
|---|---|
| `status` | `"ok" \| "error"` |
| `code` | Enum corto en SCREAMING_SNAKE. |
| `message` | Texto humano para debug. |
| `retryable` | `boolean`. Indica si tiene sentido reintentar. |
| `payload` | Datos en caso de éxito. |
| `details` | Objeto opcional con info adicional. |

### Patrones útiles

- **Errores de validación** → `code: "VALIDATION_FAILED"`, `retryable: false`. El agente debe ajustar parámetros.
- **Errores transitorios** → `code: "UPSTREAM_TIMEOUT"`, `retryable: true`. El agente reintenta con backoff.
- **Errores de permiso** → `code: "FORBIDDEN"`, `retryable: false`. Escalar a humano.
- **Errores irreversibles** (ya cobramos al cliente, no podemos volver atrás) → `code: "EFFECT_APPLIED_BUT_FAILED"`. Caso especial.

---

## MCP vs tool custom

### Existe MCP oficial

**Usa MCP** cuando:
- Notion, Google Drive, Slack, Linear, GitHub, etc. tienen MCP estable.
- El contrato del MCP cubre tu necesidad.

**No uses MCP** cuando:
- Necesitas un contrato más estrecho que el MCP genérico expone (ej. solo lectura de un tipo de página).
- El MCP tiene side effects más amplios de los que quieres exponer al agente.

### Tool custom

**Cuándo**:
- Endpoint interno con contrato estable.
- Necesitas un wrapper más estrecho/seguro que el MCP genérico.
- Side effect crítico que requiere validación específica.

**Buenas prácticas**:
- Tool delgada (solo el contrato, no lógica de negocio).
- Schema declarado (con TypeScript / pydantic / JSON Schema).
- Logging y métricas en cada llamada.
- Tests unitarios para la tool, separados del agente.

---

## Naming

### Verbos claros

| Mal | Bien |
|---|---|
| `data` | `fetch_orders` |
| `process` | `summarize_kb_results` |
| `helper` | `format_phone_number` |
| `do_thing` | `send_invoice_pdf` |
| `lookup` (genérico) | `lookup_user_by_email` |

### Parámetros descriptivos

| Mal | Bien |
|---|---|
| `id`, `s`, `n` | `user_id`, `query`, `max_results` |
| `data: object` | `payload: InvoicePayload` |
| `flag: bool` | `dry_run: bool`, `force_send: bool` |

### Convenciones del proyecto

- snake_case para nombres de tools y parámetros.
- Verbos imperativos para tools que mutan: `create_*`, `update_*`, `delete_*`, `send_*`.
- `get_*` o `lookup_*` para lecturas.
- `search_*`, `query_*` para búsquedas.

---

## Tools peligrosas

### Side effects irreversibles

Marca `sideEffect: "irreversible"` para:
- Envío de emails, SMS, notifications externas.
- Cobros, transferencias, refunds.
- Borrado de datos en producción.
- Publicación pública (post a Twitter, deploy a prod).

### Patrones de seguridad

- **Confirmación humana** antes de ejecutar (`Human-in-the-loop checkpoint`).
- **Dry-run mode**: tool con flag `dry_run: bool`. Cuando true, valida pero no aplica.
- **Verifier antes de la tool**: bridge `validate` que rechaza payloads dudosos.
- **Logging extensivo**: todas las invocaciones a tools irreversibles se logean con request_id, agente, parámetros.

---

## Schemas estrictos

### Por qué importa

Tools con schemas laxos (`body: object`) abren puerta a tool hallucination: el agente se inventa estructuras que el backend rechaza.

### Cómo hacerlo

- TypeScript + Zod para definir tipos.
- JSON Schema en la spec MCP.
- pydantic en Python.

### Validación bidireccional

- En la entrada: rechaza llamadas con parámetros mal formados, con mensaje claro.
- En la salida: garantiza que el output sigue el schema; si no, error estructurado.

---

## Tabla rápida

| Pregunta | Respuesta esperada |
|---|---|
| ¿Cuántas tools tiene este agente? | <5 ideal. >7 = riesgo saturación. |
| ¿Es idempotente? | Si no → `idempotent: false`, documentar dedup. |
| ¿Side effect? | Marca `sideEffect`. Si irreversible → HITL. |
| ¿Schema de entrada/salida? | Estricto, validable. |
| ¿Errores estructurados? | Siempre `{status, code, message, retryable}`. |
| ¿MCP existente cubre esto? | Sí → úsalo. No → custom delgada. |
| ¿Necesita bridge a la salida? | Si voluminosa, ruidosa o sensible → sí. |

---

## Cómo lo usa `tool-designer`

El subagente `tool-designer` lee esta skill al definir tools por agente. Para cada tool:

1. Aplica el principio de **una tool por intención**.
2. Define schemas estrictos.
3. Decide idempotencia y side effects.
4. Decide MCP vs custom.
5. Si la salida es voluminosa → propone bridge.
6. Si es irreversible → propone HITL checkpoint y avisa a `orchestration-critic`.
