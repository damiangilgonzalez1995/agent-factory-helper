# Pipeline & Viewer Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir selector de proyectos lateral, panel de resumen del caso, transición fade+scale, modelo 4.6 por defecto y subagente `case-saver`.

**Architecture:** Panel lateral izquierdo colapsable (`ProjectSidebar`) muestra la lista de proyectos vía `/api/cases`; al seleccionar uno, el canvas hace fade+scale y carga el nuevo JSON. El `SidePanel` derecho muestra `CaseOverview` (stats + restricciones + veredicto) cuando no hay nodo seleccionado.

**Tech Stack:** React 18, TypeScript estricto, Vite plugin (Node fs), CSS custom properties, sin librerías de animación.

---

## Archivos que se crean / modifican

| Archivo | Op |
|---|---|
| `.claude/settings.json` | Crear |
| `CLAUDE.md` | Modificar |
| `.claude/agents/case-saver.md` | Crear |
| `viewer/src/lib/formatRelativeTime.ts` | Crear |
| `viewer/vite.config.ts` | Modificar |
| `viewer/src/hooks/useProjectList.ts` | Crear |
| `viewer/src/hooks/useArchitectureFile.ts` | Modificar |
| `viewer/src/components/ProjectSidebar.tsx` | Crear |
| `viewer/src/components/CaseOverview.tsx` | Crear |
| `viewer/src/components/SidePanel.tsx` | Modificar |
| `viewer/src/App.tsx` | Modificar |
| `viewer/src/styles.css` | Modificar |

---

## Task 1: Configuración del proyecto (modelo + CLAUDE.md)

**Files:**
- Create: `.claude/settings.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Crear `.claude/settings.json`**

```json
{
  "model": "claude-sonnet-4-6"
}
```

- [ ] **Step 2: Añadir sección "Flujo de trabajo" al CLAUDE.md**

Buscar la sección `## Flujo recomendado de los subagentes` en `CLAUDE.md` y reemplazarla por:

```markdown
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
```

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
cd viewer && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.json CLAUDE.md
git commit -m "config: set default model to claude-sonnet-4-6 and document pipeline flow"
```

---

## Task 2: Subagente `case-saver`

**Files:**
- Create: `.claude/agents/case-saver.md`

- [ ] **Step 1: Crear el archivo del subagente**

Crear `.claude/agents/case-saver.md` con el contenido:

```markdown
---
name: case-saver
description: Empaqueta el resultado del pipeline de diseño en architectures/<slug>.json. Invócame al final, cuando architecture-synthesizer haya producido las 3 variantes.
---

# case-saver

## Tu rol

Eres el paso final del pipeline de diseño. Tu única misión es escribir un JSON válido en `architectures/<slug>.json` a partir del material que se ha producido durante la conversación.

## Inputs que necesitas (pídelos si faltan)

1. **slug** — nombre del archivo (kebab-case, sin espacios, sin .json). Si no se ha dado, pregunta: "¿Cómo quieres llamar a este caso? Usa kebab-case, p.ej. `triage-soporte`."
2. **Caso normalizado** — título, descripción, inputs, outputs, constraints, actors, volume (de `case-intake`).
3. **Veredicto de complejidad** — score por eje + total + verdict + rationale (de `complexity-assessor`).
4. **Las 3 variantes** — basic, intermediate, advanced con agents, tools, bridges, dataStores, apiGateways, edges, stateModel, rationale, patterns (de `architecture-synthesizer`).

## Lo que produces

Un archivo `architectures/<slug>.json` con este schema:

```json
{
  "case": {
    "slug": "<slug>",
    "title": "<título>",
    "description": "<descripción>",
    "constraints": [],
    "inputs": [],
    "outputs": [],
    "actors": [],
    "volume": "<volumen>",
    "createdAt": "<ISO timestamp>",
    "complexity": {
      "domain": 0, "task": 0, "context": 0, "tools": 0, "flow": 0,
      "total": 0, "verdict": "", "recommendedPatterns": [], "rationale": ""
    }
  },
  "variants": {
    "basic": { ... },
    "intermediate": { ... },
    "advanced": { ... }
  },
  "activeVariant": "basic",
  "history": [
    {
      "timestamp": "<ISO>",
      "variant": "basic",
      "summary": "Caso creado por pipeline de subagentes.",
      "snapshot": { "basic": { ... }, "intermediate": { ... }, "advanced": { ... } }
    }
  ]
}
```

## Reglas duras

- **Nunca inventes datos.** Si falta un campo obligatorio, pregunta.
- **Siempre añade entrada al history.** El snapshot debe incluir las 3 variantes.
- **Las posiciones** (`position.x`, `position.y`) de todos los nodos puedes inicializarlas a `{"x": 0, "y": 0}` — el viewer aplica auto-layout si detecta solapamientos.
- **Verifica el schema** antes de escribir: todos los agentes tienen `id`, `name`, `role`, `model`, `executionMode`, `contextStrategy`, `stateReads`, `stateWrites`, `tools`, `position`. Todas las edges tienen `id`, `source`, `target`, `kind`.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/agents/case-saver.md
git commit -m "feat: add case-saver subagent to finalize pipeline output"
```

---

## Task 3: Utilidad `formatRelativeTime`

**Files:**
- Create: `viewer/src/lib/formatRelativeTime.ts`

- [ ] **Step 1: Crear la utilidad**

Crear `viewer/src/lib/formatRelativeTime.ts`:

```ts
export function formatRelativeTime(mtime: number): string {
  const diff = Date.now() - mtime;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes}min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd viewer && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add viewer/src/lib/formatRelativeTime.ts
git commit -m "feat(viewer): add formatRelativeTime utility"
```

---

## Task 4: Enriquecer `/api/cases` en `vite.config.ts`

**Files:**
- Modify: `viewer/vite.config.ts` (líneas 29-48, sección `List all cases`)

- [ ] **Step 1: Reemplazar el handler de `/api/cases`**

En `viewer/vite.config.ts`, reemplazar el bloque completo del handler `/api/cases` (desde `server.middlewares.use('/api/cases'` hasta el cierre `});`) por:

```ts
server.middlewares.use('/api/cases', async (req, res, next) => {
  if (req.method !== 'GET') return next();
  try {
    const files = await fs.readdir(ARCH_DIR);
    const cases = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const slug = f.replace(/\.json$/, '');
          const filePath = path.join(ARCH_DIR, f);
          const stat = await fs.stat(filePath);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const arch = JSON.parse(content) as {
              case?: { title?: string };
              activeVariant?: string;
              variants?: Record<string, { agents?: unknown[]; tools?: unknown[] }>;
            };
            const activeVariant = arch.variants?.[arch.activeVariant ?? 'basic'];
            return {
              slug,
              mtime: stat.mtimeMs,
              title: arch.case?.title ?? slug,
              agentCount: activeVariant?.agents?.length ?? 0,
              toolCount: activeVariant?.tools?.length ?? 0,
            };
          } catch {
            return { slug, mtime: stat.mtimeMs, title: slug, agentCount: 0, toolCount: 0 };
          }
        }),
    );
    cases.sort((a, b) => b.mtime - a.mtime);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(cases));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err) }));
  }
});
```

- [ ] **Step 2: Verificar que el servidor arranca sin errores**

```bash
cd viewer && npm run dev
```

Abrir `http://localhost:5173/api/cases` en el navegador. Resultado esperado: JSON con `slug`, `mtime`, `title`, `agentCount`, `toolCount`.

- [ ] **Step 3: Commit**

```bash
git add viewer/vite.config.ts
git commit -m "feat(api): enrich /api/cases with title and node counts"
```

---

## Task 5: Hook `useProjectList`

**Files:**
- Create: `viewer/src/hooks/useProjectList.ts`

- [ ] **Step 1: Crear el hook**

Crear `viewer/src/hooks/useProjectList.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

export interface ProjectEntry {
  slug: string;
  mtime: number;
  title: string;
  agentCount: number;
  toolCount: number;
}

export function useProjectList(): ProjectEntry[] {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/cases');
      if (!res.ok) return;
      const data = (await res.json()) as ProjectEntry[];
      setProjects(data);
    } catch {
      // silencioso: sidebar simplemente queda vacío
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = () => void fetchProjects();
    import.meta.hot.on('architecture-changed', handler);
    return () => import.meta.hot?.off('architecture-changed', handler);
  }, [fetchProjects]);

  return projects;
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd viewer && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add viewer/src/hooks/useProjectList.ts
git commit -m "feat(viewer): add useProjectList hook"
```

---

## Task 6: Exponer `navigateTo` en `useArchitectureFile`

**Files:**
- Modify: `viewer/src/hooks/useArchitectureFile.ts`

El hook actualmente gestiona `slug` como estado interno. Necesitamos exponerlo para que `App.tsx` pueda cambiar el proyecto activo.

- [ ] **Step 1: Añadir `navigateTo` a la interfaz de retorno**

En `viewer/src/hooks/useArchitectureFile.ts`, reemplazar:

```ts
interface UseArchFileResult {
  arch: Architecture | null;
  slug: string | null;
  error: string | null;
  reload: () => void;
  saveLayout: (positions: Map<string, { x: number; y: number }>, summary?: string) => Promise<void>;
}
```

por:

```ts
interface UseArchFileResult {
  arch: Architecture | null;
  slug: string | null;
  error: string | null;
  reload: () => void;
  saveLayout: (positions: Map<string, { x: number; y: number }>, summary?: string) => Promise<void>;
  navigateTo: (newSlug: string) => void;
}
```

- [ ] **Step 2: Añadir `navigateTo` al return del hook**

Al final del hook, reemplazar:

```ts
  return { arch, slug, error, reload, saveLayout };
```

por:

```ts
  return { arch, slug, error, reload, saveLayout, navigateTo: setSlug };
```

- [ ] **Step 3: Verificar compilación**

```bash
cd viewer && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add viewer/src/hooks/useArchitectureFile.ts
git commit -m "feat(viewer): expose navigateTo in useArchitectureFile"
```

---

## Task 7: Componente `ProjectSidebar`

**Files:**
- Create: `viewer/src/components/ProjectSidebar.tsx`

- [ ] **Step 1: Crear el componente**

Crear `viewer/src/components/ProjectSidebar.tsx`:

```tsx
import { useState } from 'react';
import { useProjectList } from '../hooks/useProjectList';
import { formatRelativeTime } from '../lib/formatRelativeTime';

interface Props {
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

export default function ProjectSidebar({ activeSlug, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const projects = useProjectList();

  if (collapsed) {
    return (
      <aside className="project-sidebar collapsed" aria-label="Proyectos">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed(false)}
          title="Mostrar proyectos"
          aria-label="Mostrar proyectos"
        >
          <ProjectsIcon />
        </button>
        {activeSlug && <div className="sidebar-active-dot" title={activeSlug} />}
      </aside>
    );
  }

  return (
    <aside className="project-sidebar" aria-label="Proyectos">
      <header className="sidebar-head">
        <div className="sidebar-head-title">
          <ProjectsIcon />
          <span>Proyectos</span>
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(true)}
          title="Colapsar"
          aria-label="Colapsar panel de proyectos"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>
      </header>

      <div className="sidebar-list">
        {projects.map((p) => (
          <div
            key={p.slug}
            className={`sidebar-project${p.slug === activeSlug ? ' active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(p.slug)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(p.slug);
              }
            }}
            aria-current={p.slug === activeSlug ? 'page' : undefined}
          >
            <span className={`sidebar-dot${p.slug === activeSlug ? ' active' : ''}`} />
            <div className="sidebar-project-info">
              <div className="sidebar-project-name">{p.slug}</div>
              <div className="sidebar-project-title">{p.title}</div>
              <div className="sidebar-project-meta">
                <span>{p.agentCount} ag · {p.toolCount} tools</span>
                <span>{formatRelativeTime(p.mtime)}</span>
              </div>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="sidebar-empty">No hay proyectos en <code>architectures/</code></p>
        )}
      </div>

      <footer className="sidebar-foot">
        Crea un caso con <code>case-intake</code> en Claude Code.
      </footer>
    </aside>
  );
}

function ProjectsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
```

- [ ] **Step 2: Añadir estilos del sidebar a `viewer/src/styles.css`**

Añadir al final de `viewer/src/styles.css`:

```css
/* ─────────────── Project Sidebar ─────────────── */
.project-sidebar {
  width: 240px;
  background: var(--bg-1);
  border-right: 1px solid var(--border-0);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 250ms var(--ease-out-quart);
  min-width: 0;
}

.project-sidebar.collapsed {
  width: 40px;
  align-items: center;
  padding-top: var(--sp-3);
  gap: var(--sp-4);
}

.sidebar-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--sp-1);
  border-radius: var(--r-base);
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--dur-fast);
}
.sidebar-toggle-btn:hover { color: var(--text-1); }

.sidebar-active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--agent);
  box-shadow: 0 0 6px rgba(108, 142, 245, 0.6);
  flex-shrink: 0;
}

.sidebar-head {
  padding: var(--sp-3) var(--sp-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-0);
  flex-shrink: 0;
}

.sidebar-head-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--text-0);
  font-size: var(--text-sm);
  font-weight: var(--weight-semi);
}

.sidebar-collapse-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--sp-1);
  border-radius: var(--r-base);
  color: var(--text-2);
  display: flex;
  align-items: center;
  transition: color var(--dur-fast);
}
.sidebar-collapse-btn:hover { color: var(--text-1); }

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-project {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background var(--dur-fast), border-color var(--dur-fast);
}
.sidebar-project:hover { background: var(--bg-3); }
.sidebar-project.active {
  background: var(--bg-3);
  border-color: var(--agent);
}

.sidebar-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-2);
  margin-top: 5px;
  flex-shrink: 0;
  transition: background var(--dur-fast), box-shadow var(--dur-fast);
}
.sidebar-dot.active {
  background: var(--agent);
  box-shadow: 0 0 5px rgba(108, 142, 245, 0.5);
}

.sidebar-project-info { flex: 1; min-width: 0; }

.sidebar-project-name {
  color: var(--text-0);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar-project.active .sidebar-project-name { color: var(--agent); }

.sidebar-project-title {
  color: var(--text-1);
  font-size: var(--text-xs);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-project-meta {
  display: flex;
  justify-content: space-between;
  color: var(--text-2);
  font-size: var(--text-xs);
  margin-top: var(--sp-1);
}

.sidebar-empty {
  color: var(--text-2);
  font-size: var(--text-xs);
  padding: var(--sp-3);
  text-align: center;
  line-height: var(--lh-base);
}

.sidebar-foot {
  padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid var(--border-0);
  color: var(--text-2);
  font-size: var(--text-xs);
  line-height: var(--lh-loose);
  flex-shrink: 0;
}
.sidebar-foot code {
  color: var(--agent);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

/* ─────────────── Canvas transition ─────────────── */
.canvas-area {
  transition: opacity 200ms var(--ease-out-quart), transform 200ms var(--ease-out-quart);
  will-change: opacity, transform;
}
.canvas-area.canvas-exit {
  opacity: 0;
  transform: scale(0.97);
  pointer-events: none;
}
@keyframes canvas-fade-in {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
.canvas-area.canvas-enter {
  animation: canvas-fade-in 200ms var(--ease-out-quart) forwards;
}
```

- [ ] **Step 3: Actualizar el grid en `styles.css`**

En `viewer/src/styles.css`, reemplazar:

```css
.app {
  display: grid;
  grid-template-columns: 1fr 360px;
  grid-template-rows: 56px 1fr;
  height: 100%;
  width: 100%;
}
```

por:

```css
.app {
  display: grid;
  grid-template-columns: auto 1fr 360px;
  grid-template-rows: 56px 1fr;
  height: 100%;
  width: 100%;
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd viewer && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add viewer/src/components/ProjectSidebar.tsx viewer/src/styles.css
git commit -m "feat(viewer): add ProjectSidebar with collapsible panel and canvas transition styles"
```

---

## Task 8: Componente `CaseOverview`

**Files:**
- Create: `viewer/src/components/CaseOverview.tsx`

- [ ] **Step 1: Crear el componente**

Crear `viewer/src/components/CaseOverview.tsx`:

```tsx
import type { Architecture, VariantKey } from '../types';

interface Props {
  arch: Architecture;
  variantKey: VariantKey;
}

export default function CaseOverview({ arch, variantKey }: Props) {
  const variant = arch.variants[variantKey];
  const complexity = arch.case.complexity;

  const verdictColor =
    complexity?.verdict.toLowerCase().includes('single') ? 'var(--info)' : 'var(--success)';

  const MAX_CONSTRAINTS = 6;
  const constraints = arch.case.constraints ?? [];
  const visibleConstraints = constraints.slice(0, MAX_CONSTRAINTS);
  const hiddenCount = constraints.length - MAX_CONSTRAINTS;

  return (
    <div className="case-overview">
      {/* Cabecera */}
      <div className="panel-section">
        <div className="case-overview-label">Caso activo</div>
        <p style={{ fontWeight: 'var(--weight-semi)' as React.CSSProperties['fontWeight'], color: 'var(--text-0)', marginBottom: 'var(--sp-2)' }}>
          {arch.case.title}
        </p>
        <p className="case-overview-desc">{arch.case.description}</p>
      </div>

      {/* Stats */}
      <div className="panel-section">
        <div className="case-overview-stats">
          <div className="case-stat">
            <span className="case-stat-value" style={{ color: 'var(--agent)' }}>
              {variant.agents.length}
            </span>
            <span className="case-stat-label">agentes</span>
          </div>
          <div className="case-stat">
            <span className="case-stat-value" style={{ color: 'var(--tool)' }}>
              {variant.tools.length}
            </span>
            <span className="case-stat-label">tools</span>
          </div>
          <div className="case-stat">
            <span className="case-stat-value" style={{ color: 'var(--bridge)' }}>
              {variant.bridges.length}
            </span>
            <span className="case-stat-label">bridges</span>
          </div>
          <div className="case-stat">
            <span className="case-stat-value" style={{ color: 'var(--warning)' }}>
              {complexity?.total ?? '—'}
            </span>
            <span className="case-stat-label">compl.</span>
          </div>
        </div>
      </div>

      {/* Restricciones */}
      {constraints.length > 0 && (
        <div className="panel-section">
          <h3>Restricciones</h3>
          <div className="tag-list">
            {visibleConstraints.map((c, i) => (
              <span key={i} className="tag">{c}</span>
            ))}
            {hiddenCount > 0 && (
              <span className="tag" style={{ color: 'var(--text-2)' }}>+{hiddenCount} más</span>
            )}
          </div>
        </div>
      )}

      {/* Veredicto KISS */}
      {complexity && (
        <div className="panel-section">
          <div className="case-overview-label">Veredicto KISS</div>
          <p style={{ color: verdictColor, fontWeight: 'var(--weight-semi)' as React.CSSProperties['fontWeight'], fontSize: 'var(--text-sm)', margin: '4px 0 4px' }}>
            {complexity.verdict}
          </p>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--text-xs)' }}>
            {complexity.total}/25 · {complexity.rationale.slice(0, 80)}{complexity.rationale.length > 80 ? '…' : ''}
          </p>
        </div>
      )}

      {/* Hint */}
      <div className="panel-section">
        <p style={{ color: 'var(--text-2)', fontSize: 'var(--text-xs)' }}>
          Haz clic en un nodo para ver su detalle →
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Añadir estilos al final de `viewer/src/styles.css`**

Añadir al final de `viewer/src/styles.css`:

```css
/* ─────────────── CaseOverview ─────────────── */
.case-overview {}

.case-overview-label {
  font-size: var(--text-xs);
  font-weight: var(--weight-semi);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-2);
  margin-bottom: var(--sp-2);
}

.case-overview-desc {
  color: var(--text-1);
  font-size: var(--text-sm);
  line-height: var(--lh-base);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.case-overview-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: var(--sp-2);
}

.case-stat {
  background: var(--bg-3);
  border-radius: var(--r-md);
  padding: var(--sp-2) var(--sp-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.case-stat-value {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  line-height: 1;
}

.case-stat-label {
  font-size: var(--text-xs);
  color: var(--text-2);
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd viewer && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add viewer/src/components/CaseOverview.tsx viewer/src/styles.css
git commit -m "feat(viewer): add CaseOverview panel with stats, constraints and verdict"
```

---

## Task 9: Integrar `CaseOverview` en `SidePanel`

**Files:**
- Modify: `viewer/src/components/SidePanel.tsx`

El `SidePanel` actualmente muestra siempre el caso + complejidad + variante + historial, y debajo el nodo seleccionado. Queremos que cuando no hay nodo seleccionado, muestre `CaseOverview` en lugar del bloque de caso actual.

- [ ] **Step 1: Modificar `SidePanel.tsx`**

Reemplazar el contenido completo de `viewer/src/components/SidePanel.tsx` por:

```tsx
import type { Architecture, SelectedNode, VariantKey } from '../types';
import CaseOverview from './CaseOverview';
import HistoryPanel from './HistoryPanel';

interface Props {
  arch: Architecture;
  variantKey: VariantKey;
  selected: SelectedNode | null;
}

export default function SidePanel({ arch, variantKey, selected }: Props) {
  const variant = arch.variants[variantKey];

  if (!selected) {
    return (
      <div>
        <CaseOverview arch={arch} variantKey={variantKey} />
        <div className="panel-section">
          <h3>Variante: {variantKey}</h3>
          {variant.patterns?.length ? (
            <div className="tag-list" style={{ marginBottom: 8 }}>
              {variant.patterns.map((p) => (
                <span key={p} className="tag">{p}</span>
              ))}
            </div>
          ) : null}
          <p>{variant.rationale}</p>
        </div>
        <div className="panel-section">
          <h3>Historial ({arch.history.length})</h3>
          <HistoryPanel history={arch.history} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SelectedNodePanel arch={arch} variantKey={variantKey} selected={selected} />
      <div className="panel-section">
        <h3>Historial ({arch.history.length})</h3>
        <HistoryPanel history={arch.history} />
      </div>
    </div>
  );
}

function SelectedNodePanel({ arch, variantKey, selected }: Props & { selected: SelectedNode }) {
  const v = arch.variants[variantKey];
  if (selected.kind === 'agent') {
    const a = v.agents.find((x) => x.id === selected.id);
    if (!a) return null;
    return (
      <div className="panel-section">
        <h3>Agente seleccionado</h3>
        <p style={{ fontWeight: 600, color: 'var(--text-0)' }}>{a.name}</p>
        <p style={{ marginBottom: 12 }}>{a.role}</p>
        <div className="kv">
          <span className="k">id</span><span className="v"><code>{a.id}</code></span>
          <span className="k">model</span><span className="v"><code>{a.model}</code></span>
          <span className="k">executionMode</span><span className="v"><code>{a.executionMode}</code></span>
          <span className="k">contextStrategy</span><span className="v"><code>{a.contextStrategy}</code></span>
        </div>
        <h3 style={{ marginTop: 16 }}>Justificación del modo</h3>
        <p>{a.executionModeRationale}</p>
        <h3 style={{ marginTop: 16 }}>System prompt</h3>
        <p>{a.systemPromptSummary}</p>
        <h3 style={{ marginTop: 16 }}>Tools ({a.tools.length})</h3>
        <div className="tag-list">
          {a.tools.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
        <h3 style={{ marginTop: 16 }}>State reads</h3>
        <div className="tag-list">
          {a.stateReads.length > 0
            ? a.stateReads.map((s) => <span key={s} className="tag">{s}</span>)
            : <span className="empty">ninguno</span>}
        </div>
        <h3 style={{ marginTop: 16 }}>State writes</h3>
        <div className="tag-list">
          {a.stateWrites.length > 0
            ? a.stateWrites.map((s) => <span key={s} className="tag">{s}</span>)
            : <span className="empty">ninguno</span>}
        </div>
      </div>
    );
  }
  if (selected.kind === 'tool') {
    const t = v.tools.find((x) => x.id === selected.id);
    if (!t) return null;
    return (
      <div className="panel-section">
        <h3>Tool seleccionada</h3>
        <p style={{ fontWeight: 600, color: 'var(--text-0)' }}>{t.name}</p>
        <p style={{ marginBottom: 12 }}>{t.description}</p>
        <div className="kv">
          <span className="k">id</span><span className="v"><code>{t.id}</code></span>
          <span className="k">type</span><span className="v"><code>{t.type}</code></span>
          {t.idempotent !== undefined && (
            <><span className="k">idempotent</span><span className="v">{t.idempotent ? 'sí' : 'no'}</span></>
          )}
          {t.sideEffect && (
            <><span className="k">sideEffect</span><span className="v"><code>{t.sideEffect}</code></span></>
          )}
        </div>
        <h3 style={{ marginTop: 16 }}>Consumida por</h3>
        <div className="tag-list">
          {t.consumedBy.map((c) => <span key={c} className="tag">{c}</span>)}
        </div>
      </div>
    );
  }
  if (selected.kind === 'bridge') {
    const b = v.bridges.find((x) => x.id === selected.id);
    if (!b) return null;
    return (
      <div className="panel-section">
        <h3>Bridge seleccionado</h3>
        <p style={{ fontWeight: 600, color: 'var(--text-0)' }}>{b.name}</p>
        <p style={{ marginBottom: 12 }}>{b.description}</p>
        <div className="kv">
          <span className="k">id</span><span className="v"><code>{b.id}</code></span>
          <span className="k">kind</span><span className="v"><code>{b.kind}</code></span>
          <span className="k">implementation</span><span className="v"><code>{b.implementation}</code></span>
          {b.inputSchema && <><span className="k">input</span><span className="v"><code>{b.inputSchema}</code></span></>}
          {b.outputSchema && <><span className="k">output</span><span className="v"><code>{b.outputSchema}</code></span></>}
        </div>
      </div>
    );
  }
  if (selected.kind === 'datastore') {
    const d = v.dataStores.find((x) => x.id === selected.id);
    if (!d) return null;
    return (
      <div className="panel-section">
        <h3>DataStore seleccionado</h3>
        <p style={{ fontWeight: 600, color: 'var(--text-0)' }}>{d.name}</p>
        <div className="kv">
          <span className="k">id</span><span className="v"><code>{d.id}</code></span>
          <span className="k">type</span><span className="v"><code>{d.type}</code></span>
        </div>
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd viewer && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add viewer/src/components/SidePanel.tsx
git commit -m "feat(viewer): show CaseOverview in SidePanel when no node selected"
```

---

## Task 10: Integrar `ProjectSidebar` y transición en `App.tsx`

**Files:**
- Modify: `viewer/src/App.tsx`

- [ ] **Step 1: Reemplazar el contenido completo de `viewer/src/App.tsx`**

```tsx
import { useCallback, useRef, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import VariantSwitcher from './components/VariantSwitcher';
import StateModelBadge from './components/StateModelBadge';
import ArchitectureCanvas from './components/ArchitectureCanvas';
import SidePanel from './components/SidePanel';
import ProjectSidebar from './components/ProjectSidebar';
import { useArchitectureFile } from './hooks/useArchitectureFile';
import type { LayerKey, LayerState, SelectedNode, VariantKey } from './types';

function getInitialSlug(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get('case');
}

export default function App() {
  const initialSlug = getInitialSlug();
  const { arch, slug, error, saveLayout, navigateTo } = useArchitectureFile(initialSlug);
  const [variantKey, setVariantKey] = useState<VariantKey | null>(null);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    api: true,
    tools: true,
    bridges: true,
    datastores: true,
  });
  const positionsCollectorRef = useRef<(() => Map<string, { x: number; y: number }>) | null>(null);
  const autoLayoutRunnerRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((l) => ({ ...l, [key]: !l[key] }));
  }, []);

  const triggerCanvasTransition = useCallback((callback: () => void) => {
    const el = canvasRef.current;
    if (!el) { callback(); return; }
    el.classList.add('canvas-exit');
    setTimeout(() => {
      callback();
      el.classList.remove('canvas-exit');
      el.classList.add('canvas-enter');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.remove('canvas-enter'));
      });
    }, 200);
  }, []);

  const handleProjectSelect = useCallback((newSlug: string) => {
    if (newSlug === slug) return;
    triggerCanvasTransition(() => {
      navigateTo(newSlug);
      setVariantKey(null);
      setSelected(null);
      history.replaceState(null, '', `?case=${newSlug}`);
    });
  }, [slug, navigateTo, triggerCanvasTransition]);

  const handleVariantChange = useCallback((v: VariantKey) => {
    triggerCanvasTransition(() => {
      setVariantKey(v);
      setSelected(null);
    });
  }, [triggerCanvasTransition]);

  const handleSave = useCallback(
    async (summary?: string) => {
      if (!positionsCollectorRef.current) return;
      const positions = positionsCollectorRef.current();
      try {
        await saveLayout(positions, summary);
        setLayoutDirty(false);
      } catch (err) {
        alert('No se pudo guardar el layout: ' + (err instanceof Error ? err.message : err));
      }
    },
    [saveLayout],
  );

  const handleAutoLayout = useCallback(async () => {
    if (!autoLayoutRunnerRef.current) return;
    autoLayoutRunnerRef.current();
    requestAnimationFrame(() => { void handleSave('Auto-layout aplicado.'); });
  }, [handleSave]);

  const collectPositions = useCallback(
    (collector: () => Map<string, { x: number; y: number }>) => {
      positionsCollectorRef.current = collector;
    },
    [],
  );

  const registerAutoLayout = useCallback((run: () => void) => {
    autoLayoutRunnerRef.current = run;
  }, []);

  if (error) {
    return (
      <div className="app">
        <div className="topbar"><h1>Multi-Agent Architecture Studio</h1></div>
        <div className="canvas-area" style={{ gridColumn: '1 / -1' }}>
          <div className="error-box">
            <strong>Error</strong>
            <p style={{ margin: '8px 0 0 0' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!arch) {
    return (
      <div className="app">
        <div className="topbar"><h1>Multi-Agent Architecture Studio</h1></div>
        <ProjectSidebar activeSlug={slug} onSelect={handleProjectSelect} />
        <div className="canvas-area" style={{ gridColumn: '2 / 4' }}>
          <div className="loading">cargando arquitectura…</div>
        </div>
      </div>
    );
  }

  const activeVariant = variantKey ?? arch.activeVariant;
  const variant = arch.variants[activeVariant];
  const counts = {
    agents: variant.agents.length,
    tools: variant.tools.length,
    bridges: variant.bridges.length,
    dataStores: variant.dataStores.length,
    apiGateways: variant.apiGateways?.length ?? 0,
  };

  return (
    <div className="app">
      <div className="topbar">
        <h1>{arch.case.title}</h1>
        <span className="subtitle"><code>{slug}</code></span>
        <div className="spacer" />
        <VariantSwitcher active={activeVariant} onChange={handleVariantChange} />
        <StateModelBadge stateModel={variant.stateModel} />
        <button
          className="layout-button"
          onClick={handleAutoLayout}
          title="Recalcula posiciones con dagre y persiste al JSON"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12h4l3-9 4 18 3-9h4" />
          </svg>
          Auto-layout
        </button>
        <button
          className="save-button"
          onClick={() => handleSave()}
          disabled={!layoutDirty}
          title={layoutDirty ? 'Guardar nuevas posiciones al JSON' : 'No hay cambios pendientes'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {layoutDirty ? 'Guardar layout' : 'Layout sincronizado'}
        </button>
      </div>

      <ProjectSidebar activeSlug={slug} onSelect={handleProjectSelect} />

      <div className="canvas-area" ref={canvasRef}>
        <ReactFlowProvider>
          <ArchitectureCanvas
            arch={arch}
            variantKey={activeVariant}
            visibleLayers={layers}
            onToggleLayer={toggleLayer}
            layerCounts={counts}
            onSelect={setSelected}
            onLayoutDirty={setLayoutDirty}
            collectPositions={collectPositions}
            registerAutoLayout={registerAutoLayout}
          />
        </ReactFlowProvider>
      </div>

      <div className="side-panel">
        <SidePanel arch={arch} variantKey={activeVariant} selected={selected} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd viewer && npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Verificar visualmente**

```bash
cd viewer && npm run dev
```

Verificar:
- El sidebar aparece a la izquierda con los proyectos listados.
- Al colapsar, queda un rail de 40px con el punto azul.
- Al hacer clic en otro proyecto, el canvas hace fade+scale y carga el nuevo JSON.
- Al cambiar variante (básica → intermedia), el canvas también hace fade+scale.
- Con ningún nodo seleccionado, el panel derecho muestra `CaseOverview` con stats.
- Al hacer clic en un nodo, el panel derecho muestra los detalles del nodo.

- [ ] **Step 4: Commit**

```bash
git add viewer/src/App.tsx
git commit -m "feat(viewer): integrate ProjectSidebar and canvas fade+scale transition"
```

---

## Task 11: Smoke test final y commit de cierre

- [ ] **Step 1: Build de producción**

```bash
cd viewer && npm run build
```

Resultado esperado: `✓ built in X.Xs` sin errores de TypeScript ni de Vite.

- [ ] **Step 2: Verificar flujo completo**

Con `npm run dev`:
1. Abrir `http://localhost:5173` — carga el proyecto más reciente.
2. Abrir `http://localhost:5173?case=feature-showcase` — carga ese proyecto específico.
3. En el sidebar, hacer clic en otro proyecto — transición suave, datos actualizados.
4. Colapsar y expandir el sidebar — animación de width.
5. Cambiar variante — transición en el canvas.
6. Panel derecho sin selección — muestra stats del caso.
7. Clic en un agente — muestra detalles del agente.
8. Clic en fondo del canvas — vuelve a mostrar CaseOverview.

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: project selector sidebar, case overview panel and canvas transitions"
```
