---
name: multiagent-patterns
description: Catálogo de patrones canónicos para sistemas multiagente. Consulta cuando estés decidiendo cómo descomponer un problema en agentes, qué topología de coordinación usar, o cuándo NO meter más agentes.
---

# Multiagent Patterns

Catálogo de patrones para coordinar y colaborar entre agentes. Para cada patrón: qué es, cuándo usarlo, contras, **cuándo NO usarlo** (igual de importante).

> **Antes de leer**: el patrón correcto casi siempre es **Single Agent + Tools**. Solo añade complejidad si está justificada.

---

## Patrones de coordinación

### Single Agent + Tools

**Qué es**: un único LLM con un set de tools. El agente decide qué tool llamar, en qué orden, con qué parámetros.

**Cuándo usarlo**:
- El dominio es uno solo o pequeño.
- La tarea cabe en un único system prompt sin saturar.
- No hay especialización real entre subtareas.

**Cuándo NO**:
- Hay 3+ dominios disjuntos que requieren expertise distintos.
- El system prompt tendría que ser >1000 tokens para cubrir todos los casos.
- Diferentes partes de la tarea se beneficiarían de modelos distintos (ej. clasificación rápida vs respuesta cuidadosa).

**Antes de meter más agentes, justifica por qué este no basta.** KISS empieza aquí.

---

### Orchestrator-Worker

**Qué es**: un agente coordina, otros ejecutan tareas especializadas. El orquestador decide quién hace qué, recoge resultados, decide siguiente paso.

**Cuándo**:
- Especialización clara por dominio (ticket técnico → especialista técnico).
- El orquestador toma decisiones que cambian el rumbo según los resultados de los workers.

**Contras**:
- Cuello de botella en el orquestador.
- Saturación de su contexto si delega a muchos.
- Latencia se suma con cada delegación.

**Cuándo NO**:
- Los workers no necesitan razonar (entonces son tools, no agentes).
- El orquestador acumula >5 tools o >4 sub-agentes (saturación).

---

### Supervisor

**Qué es**: variante del Orchestrator-Worker donde el supervisor **revisa** el trabajo del worker además de delegarlo. Si la salida no es buena, redelega o ajusta.

**Cuándo**:
- La calidad del worker es variable.
- El coste de un error es alto.
- La revisión es barata frente a re-ejecutar todo.

**Cuándo NO**:
- El supervisor revisa cosas que él mismo podría hacer (entonces colapsa en Single Agent).

---

### Hierarchical (multi-nivel)

**Qué es**: árbol de delegación con varios niveles (orquestador → manager → worker).

**Cuándo**:
- Hay agrupaciones naturales por dominio amplio (Soporte → Soporte Técnico → especialistas técnicos).
- La organización del trabajo se mapea bien al árbol.

**Riesgos**:
- Latencia se multiplica con la profundidad.
- Context bleed entre niveles.
- Difícil de depurar.

**Regla**: **si pasas de 2 niveles, justifícalo muy bien.** Cada nivel extra es ~2× latencia y ~2× tokens.

---

### Router (clasificador → especialista)

**Qué es**: un agente liviano clasifica la entrada y delega al especialista correcto.

**Cuándo**:
- Hay muchos dominios disjuntos (3+).
- La clasificación es barata; los especialistas son los que hacen el trabajo pesado.

**Buenas prácticas**:
- El router debe ser barato y rápido (modelo pequeño, `tool_then_return`).
- La clasificación debe ser estructurada (enum de categorías), no texto libre.
- Si la confianza es baja, escalado a un fallback genérico.

**Cuándo NO**:
- Solo hay 2 categorías y el especialista podría manejar ambas.

---

### Pipeline / Sequential

**Qué es**: cadena lineal de agentes; cada uno transforma el output del anterior.

**Cuándo**:
- Workflow determinista con pasos fijos (extracción → normalización → respuesta).
- Cada paso aporta una transformación clara.

**Cuándo NO**:
- Si los pasos son siempre los mismos y no requieren razonamiento, considera `plan_then_execute` con un solo LLM.
- Si algún paso no requiere razonamiento, conviértelo en bridge.

---

## Patrones de colaboración

### Swarm / Peer-to-peer

**Qué es**: agentes se comunican entre sí sin jerarquía.

**Riesgos**:
- Caos.
- Loops infinitos.
- Coste imprevisible.

**Regla**: **casi nunca es la respuesta correcta.** Si crees que sí, probablemente lo que quieres es Blackboard.

---

### Blackboard

**Qué es**: estado compartido que todos leen/escriben con claves bien definidas.

**Cuándo**:
- Colaboración asíncrona o paralela en un mismo artefacto (varios agentes redactan secciones de un informe).
- Claves bien definidas con propietario claro por sección.

**Riesgos**:
- Race conditions si varios agentes escriben en la misma clave.
- Acoplamiento implícito.

**Regla**: si tienes >3 escritores en la misma clave, replantea (`scoped_state` o coordinador único).

---

### Map-Reduce / Fan-out-Fan-in

**Qué es**: un agente divide el trabajo en N tareas paralelas, workers las ejecutan, un agregador combina.

**Cuándo**:
- Procesar listas grandes (clasificar 100 documentos).
- Explorar alternativas en paralelo.
- Tareas independientes entre sí.

**Buenas prácticas**:
- El divisor produce tareas con schema claro.
- Cada worker es idempotente.
- El agregador maneja parcialidad (si 1 de 100 falla, no rompe todo).

---

### Competitive ensemble

**Qué es**: varios agentes resuelven la misma tarea con enfoques distintos; un juez elige el mejor.

**Cuándo**:
- Calidad importa más que coste (decisiones críticas, código sensible).

**Coste**:
- N× tokens por tarea.
- Latencia = max de los N + el juez.

**Cuándo NO**:
- Tareas frecuentes y baratas individualmente — el coste explota.

---

## Patrones de control de calidad

### Reflection / Self-critique

**Qué es**: el mismo agente revisa su salida en una segunda pasada.

**Cuándo**:
- Mejora la calidad notablemente.
- Antes de añadir un crítico externo, prueba esto.

**Coste**: ~2× tokens del agente, latencia +1 turno.

---

### Critic loop (dos agentes)

**Qué es**: un agente genera, otro critica, el primero revisa.

**Cuándo**:
- El rol crítico requiere expertise distinto (generador creativo + crítico técnico).
- Reflection no basta porque sesgos cognitivos.

---

### Verifier

**Qué es**: un agente determinista (o casi) que valida si la salida cumple criterios duros antes de devolverla.

**Cuándo**:
- Outputs estructurados (JSON con schema).
- Side effects irreversibles (validar antes de enviar email).

---

## Patrones de gestión de contexto

### Memory agent

**Qué es**: un agente dedicado a mantener y consultar memoria a largo plazo. Lo invocan otros vía tool.

**Cuándo**:
- Conversaciones largas con usuarios recurrentes.
- Estado relevante entre sesiones.

---

### Summarizer-in-the-loop

**Qué es**: un bridge LLM o code que resume el historial cuando crece >N tokens.

**Cuándo**:
- Hilos largos donde solo lo reciente y un resumen del pasado importa.

---

### Context broker

**Qué es**: un agente o bridge que decide qué contexto inyectar a cada sub-agente según la tarea.

**Cuándo**:
- Hay mucho contexto disponible y solo una parte es relevante por tarea.
- Mejor que `full_history` cuando el contexto es heterogéneo.

---

### Recursive decomposition

**Qué es**: el agente principal divide la tarea en subtareas, las pasa a clones de sí mismo con contexto reducido, agrega resultados.

**Cuándo**:
- Tareas con estructura fractal (análisis de código, exploración de árboles, escritura jerárquica).

---

## Patrones de interacción con humanos

### Human-in-the-loop checkpoint

**Qué es**: el flujo se pausa en puntos definidos hasta que un humano confirme.

**Esencial para**:
- Acciones irreversibles (envío de emails, cambios en DB de producción, cobros).
- Salidas de baja confianza.

---

### Escalation

**Qué es**: el agente decide cuándo no puede resolver y deriva a humano con contexto estructurado.

**Buenas prácticas**:
- Criterios de escalado bien definidos (confianza < threshold, error explícito, ambiguity detected).
- Contexto pasado al humano resumido (no historial crudo).

---

## Tabla rápida de selección

| Síntoma del problema | Patrón a considerar primero |
|---|---|
| Una sola tarea bien definida | Single Agent + Tools |
| Varios dominios disjuntos | Router |
| Pasos siempre los mismos | Pipeline o `plan_then_execute` |
| Calidad variable que hay que vigilar | Reflection o Supervisor |
| Lista grande a procesar | Map-Reduce |
| Decisión crítica donde la calidad pesa más que el coste | Competitive ensemble |
| Contribuciones paralelas a un mismo artefacto | Blackboard |
| Contexto crece sin parar | Summarizer-in-the-loop o Context broker |
| Acción irreversible | Human-in-the-loop checkpoint |
| Conversación con memoria entre sesiones | Memory agent |
| Workflow con auditoría requerida | `plan_then_execute` + Verifier |

---

## Reglas KISS para combinar patrones

- **Empieza por el patrón más simple que pueda funcionar.** Casi siempre es Single Agent + Tools o Router.
- **Cada nuevo agente que añades debe ganarse su sitio**: o aporta especialización real (otro modelo, otra herramienta, otro contexto), o reduce carga del principal de forma medible.
- **No combines más de 2 patrones por variante básica.** La intermedia puede sumar 1 más. La avanzada puede combinar libremente, pero el `rationale` debe explicar por qué.
- **Si dudas entre dos patrones**: implementa el más simple primero, mide, y migra solo si los datos lo respaldan.
