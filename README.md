# Multi-Agent Architecture Studio

Estudio local de diseño asistido para arquitecturas multiagente. Describe un caso en lenguaje natural y un conjunto de subagentes especializados te interrogan para forzar buenas decisiones **antes** de implementar nada. Salida: 3 propuestas de arquitectura escaladas (Básica / Intermedia / Avanzada) renderizadas en una web local con React Flow.

> **Filosofía**: socrático de diseño, no validador. Te ayuda a decidir qué agentes existen, qué tools tienen, en qué `executionMode` corren, cómo se reparte el state, y qué bridges (código no-LLM) median entre agentes.

## Cómo funciona

1. Abres Claude Code en este repo.
2. Dices: *"Quiero diseñar un sistema para X"*.
3. El subagente `case-intake` arranca, normaliza el problema y escribe `architectures/<slug>.json`.
4. `complexity-assessor` evalúa la complejidad real (5 ejes) y emite veredicto KISS — **vinculante**.
5. La cadena de subagentes (`agent-decomposer`, `tool-designer`, `execution-mode-designer`, `context-strategist`, `orchestration-critic`) te interroga.
6. `architecture-synthesizer` produce las 3 variantes en el JSON.
7. Arrancas el viewer:
   ```bash
   cd viewer
   npm install
   npm run dev
   ```
8. Iteras en lenguaje natural (*"renombra X a Y"*, *"añade un bridge entre A y B"*) — `diagram-editor` modifica el JSON, la web se refresca sola, y todo queda registrado en `history`.

## Estructura

```
.claude/agents/      # 9 subagentes interrogadores (case-intake, complexity-assessor, ...)
.claude/skills/      # 7 skills de referencia (multiagent-patterns, execution-modes, ...)
architectures/       # JSON por caso de uso (fuente de verdad)
viewer/              # App Vite + React + React Flow
docs/                # SPEC, esquema JSON, workflow
CLAUDE.md            # Manual operativo del proyecto
```

## Documentación

- `CLAUDE.md` — instrucciones globales y reglas duras.
- `docs/SPEC.md` — especificación completa del proyecto.
- `docs/ARCHITECTURE_SCHEMA.md` — esquema JSON canónico (`executionMode`, `stateModel`, `bridges`, `via`...).
- `docs/WORKFLOW.md` — flujo de uso paso a paso.

## Estado

Local-only. Sin auth, sin deploy, sin tests E2E. Es una herramienta personal.
