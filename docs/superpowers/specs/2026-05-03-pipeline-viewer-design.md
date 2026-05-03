# Multi-Agent Studio — Pipeline & Viewer Enhancements

**Fecha:** 2026-05-03  
**Estado:** Aprobado

---

## Resumen

Dos áreas de trabajo paralelas:

1. **Pipeline de diseño**: configurar el modelo por defecto, documentar el flujo de 9 subagentes en CLAUDE.md y añadir un subagente `case-saver` que empaqueta la conversación en un JSON con nombre de proyecto.
2. **Viewer**: selector de proyectos lateral colapsable, panel derecho con stats del caso cuando no hay nodo seleccionado, y transición fade+scale al cambiar de proyecto o variante.

---

## 1. Config y pipeline

### 1.1 Modelo por defecto

Crear `.claude/settings.json`:

```json
{
  "model": "claude-sonnet-4-6"
}
```

Afecta a todos los subagentes invocados en este proyecto.

### 1.2 CLAUDE.md — nueva sección "Flujo de trabajo"

Añadir una sección que documente:

- El orden canónico de los 9 subagentes (ya existe en el CLAUDE.md pero no está suficientemente explícito como flujo paso a paso).
- Qué recoge cada subagente del usuario (preguntas clave).
- Cómo terminar: invocar el subagente `case-saver` con el nombre del proyecto, que escribe `architectures/<slug>.json`.

### 1.3 Nuevo subagente `case-saver`

Archivo: `.claude/agents/case-saver.md`

**Responsabilidad:** Al final del pipeline de interrogación, leer el estado de la conversación (lo que han producido los subagentes anteriores) y escribir el JSON completo en `architectures/<slug>.json` siguiendo el schema de `types.ts`.

**Inputs que necesita (pasados explícitamente en el prompt al invocar el subagente):**
- `slug` del proyecto (nombre del archivo, sin espacios, kebab-case). Si no se proporciona, el subagente lo pregunta.
- El JSON de las 3 variantes producido por `architecture-synthesizer` (pegado en la conversación o referenciado).
- El veredicto de `complexity-assessor` (score + verdict + rationale).
- El caso normalizado de `case-intake` (title, description, constraints, inputs, outputs).

**Output:** Archivo `architectures/<slug>.json` válido según el schema + entrada en `history` con `summary: "Caso creado por pipeline de subagentes"`.

**Espíritu socrático:** Si le falta algún campo obligatorio (por ejemplo, el `slug` no se ha dado), pregunta antes de escribir. No inventa datos.

---

## 2. Viewer — ProjectSidebar

### 2.1 Hook `useProjectList`

Archivo: `viewer/src/hooks/useProjectList.ts`

- Llama a `GET /api/cases` al montar. Devuelve `Array<{ slug: string; mtime: number }>` ordenado por `mtime` descendente.
- Se suscribe al evento HMR `architecture-changed` para refrescar la lista cuando se crea un nuevo JSON en `architectures/`.

```ts
interface ProjectEntry { slug: string; mtime: number; }
function useProjectList(): ProjectEntry[]
```

### 2.2 Componente `ProjectSidebar`

Archivo: `viewer/src/components/ProjectSidebar.tsx`

**Props:**
```ts
interface Props {
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}
```

**Estados:**
- `collapsed: boolean` — por defecto `false`.

**Layout expandido (240px ancho):**
- Header: icono de pantalla/proyectos + texto "Proyectos" + botón de colapsar (chevron doble izquierda).
- Lista: un `div` por proyecto. El activo con borde `--agent` (#6c8ef5) y punto glow. Los inactivos con hover `#171c2e`.
- Cada fila muestra: punto de color, nombre del slug, tiempo relativo (`hace 2h`, `ayer`, `3 días`) calculado con una función `formatRelativeTime(mtime: number): string`, y número de agentes + tools de la variante activa. Los dos últimos datos se obtienen leyendo el JSON — el hook `useProjectList` no los tiene, así que se añade un campo opcional `summary` al endpoint `/api/cases` (ver sección 2.5).
- Footer: texto explicativo "Para crear un caso usa `case-intake` en Claude Code".

**Layout colapsado (40px ancho):**
- Solo el icono de proyectos (tooltip "Proyectos") y el punto glow del proyecto activo.

**Animación de colapso:** `transition: width 250ms var(--ease-out-quart)`.

### 2.3 Integración en `App.tsx`

- `App.tsx` gestiona `slug` como estado (ya lo hace parcialmente vía `useArchitectureFile`).
- Se extrae el `slug` a estado propio en `App`, se pasa a `ProjectSidebar.onSelect`.
- Al seleccionar un proyecto: disparar transición de canvas (sección 3) y actualizar `?case=<slug>` en la URL con `history.replaceState`.

**Layout de la app** (CSS grid, sin cambios en el canvas ni en el side panel):

```
[ProjectSidebar 40-240px] | [Canvas flex:1] | [SidePanel 280px]
```

La topbar sigue spanning full width (`grid-column: 1 / -1`).

### 2.4 Posición en el CSS grid

`App.tsx` actualmente usa:
```css
.app { display: grid; grid-template-columns: 1fr 280px; }
```

Pasa a:
```css
.app { display: grid; grid-template-columns: auto 1fr 280px; }
```

El `ProjectSidebar` tiene ancho fijo con transición propia:
```css
.project-sidebar          { width: 240px; transition: width 250ms var(--ease-out-quart); overflow: hidden; }
.project-sidebar.collapsed { width: 40px; }
```

El grid usa `auto` para la primera columna, que se adapta al ancho del sidebar sin necesidad de JS.

### 2.5 Extensión del endpoint `/api/cases`

El endpoint `GET /api/cases` en `vite.config.ts` añade un campo `summary` a cada entrada:

```ts
interface CaseEntry {
  slug: string;
  mtime: number;
  title: string;       // arch.case.title
  agentCount: number;  // variant activa
  toolCount: number;
}
```

Esto evita que el sidebar tenga que hacer un fetch por cada proyecto.

---

## 3. Viewer — CaseOverviewPanel

### 3.1 Cambio en `SidePanel.tsx`

Cuando `selected === null`, en lugar del estado vacío actual, renderiza `<CaseOverview arch={arch} variantKey={variantKey} />`.

### 3.2 Componente `CaseOverview`

Archivo: `viewer/src/components/CaseOverview.tsx`

**Secciones (de arriba abajo):**

1. **Cabecera del caso**
   - Label "Caso activo" (muted uppercase)
   - Título (`arch.case.title`) en `text-md` bold
   - Descripción (`arch.case.description`) en `text-sm` color `--text-1`, máx. 3 líneas con `line-clamp`

2. **Grid de estadísticas** (2×2 o 1×4)
   - Agentes: count + color `--agent`
   - Tools: count + color `--tool`
   - Bridges: count + color `--bridge`
   - Complejidad: score total (`arch.case.complexity?.total ?? '—'`) + color `--warning`

3. **Restricciones** (`arch.case.constraints`)
   - Chips `background: --bg-3`, texto `--text-1`, `font-size: --text-xs`
   - Máximo 6 chips visibles; si hay más, "+N más" al final

4. **Veredicto KISS** (solo si existe `arch.case.complexity`)
   - Label "Veredicto KISS" muted
   - Valor: `complexity.verdict` en color `--success` si es multi-agent, `--info` si es single-agent

5. **Hint** al pie
   - "Haz clic en un nodo para ver su detalle →" en `--text-2`

---

## 4. Transición fade + scale

### 4.1 CSS

```css
.canvas-area {
  transition: opacity 200ms var(--ease-out-quart),
              transform 200ms var(--ease-out-quart);
}
.canvas-exit {
  opacity: 0;
  transform: scale(0.97);
  pointer-events: none;
}
.canvas-enter {
  opacity: 0;
  transform: scale(0.97);
}
```

### 4.2 Lógica en `App.tsx`

```
slug cambia (proyecto o variante)
  → añadir clase canvas-exit
  → esperar 200ms
  → actualizar slug/variantKey (React re-render)
  → reemplazar canvas-exit con canvas-enter
  → requestAnimationFrame → quitar canvas-enter
```

Se implementa con un `useTransition` propio (no React 18 `useTransition`) usando `setTimeout` + `classList`. Sin librerías.

**La transición aplica a:**
- Cambio de proyecto (clic en `ProjectSidebar`)
- Cambio de variante (clic en `VariantSwitcher`)

---

## 5. Archivos creados / modificados

| Archivo | Operación |
|---|---|
| `.claude/settings.json` | Crear |
| `CLAUDE.md` | Modificar — nueva sección "Flujo de trabajo" |
| `.claude/agents/case-saver.md` | Crear |
| `viewer/src/hooks/useProjectList.ts` | Crear |
| `viewer/src/components/ProjectSidebar.tsx` | Crear |
| `viewer/src/components/CaseOverview.tsx` | Crear |
| `viewer/src/lib/formatRelativeTime.ts` | Crear — utilidad de tiempo relativo |
| `viewer/src/App.tsx` | Modificar — integrar sidebar, transición, grid |
| `viewer/src/styles.css` | Modificar — grid columns, transición, sidebar styles |
| `viewer/vite.config.ts` | Modificar — enriquecer `/api/cases` con title/counts |

---

## 6. Lo que NO se hace

- No se toca el canvas ni React Flow.
- No se modifica `ArchitectureCanvas.tsx`.
- No se añade router (la URL se gestiona con `history.replaceState` directamente).
- No se añade autenticación ni backend.
- No se implementa búsqueda de proyectos en el sidebar.
- El mini-grafo en el panel derecho queda descartado — solo estadísticas de texto.
