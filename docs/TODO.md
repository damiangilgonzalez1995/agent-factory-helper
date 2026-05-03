# TODO — Mejoras de visualización del viewer

Lista de cambios pendientes para el viewer. No abordados en la sesión inicial; se atacarán en sesiones futuras.

---

## 1. Layout automático left-to-right (LR) sin solapamientos

- [ ] Instalar `dagre` y `@types/dagre` en `viewer/`.
- [ ] Crear `viewer/src/lib/autoLayout.ts` con función `applyAutoLayout(nodes, edges, opts)` que ejecuta dagre con `rankdir: 'LR'`, `nodesep`, `ranksep`.
- [ ] Tamaños declarados por tipo de nodo (`agent`, `tool`, `bridge`, `datastore`) para que dagre calcule bien.
- [ ] **Distancia mínima blindada**: garantizar separación >= N px (configurable, defecto 80) entre cualquier par de nodos. Aunque el JSON traiga posiciones malas, el layout las corrige.
- [ ] Función `resolveOverlap(nodes, movedId)` que se invoca en `onNodeDragStop`: si el nodo movido solapa con otro, se desplaza iterativamente hasta dejar margen.
- [ ] Botón **"Auto-layout"** en la topbar (junto al botón de guardar). Al pulsarlo: recalcula posiciones, las persiste al JSON y añade entrada al `history` con `summary: "Auto-layout aplicado."`.
- [ ] Al cargar un JSON cuyas posiciones generan solape (caso típico: ejemplos sin posiciones bien afinadas), aplicar auto-layout silenciosamente la primera vez.

---

## 2. Formas distintas por tipo de nodo

- [ ] **Agentes → círculo**. Tamaño fijo (~140-150px). Texto y badge centrados.
- [ ] **Tools → rectángulo redondeado** con borde izquierdo coloreado por tipo.
- [ ] **Bridges → hexágono** (ya está, limpiar y unificar tamaño).
- [ ] **DataStores → cilindro** (forma clásica de base de datos: óvalo arriba + rectángulo + óvalo abajo, vía CSS o SVG).

---

## 3. Iconos / logos por nodo

- [ ] **Agentes**: icono según `executionMode`:
  - 🔁 `react_loop`
  - ⚡ `one_shot`
  - ↪ `tool_then_return`
  - 📋 `plan_then_execute`
  - ⫷⫸ `parallel_tools`
- [ ] **Tools**: icono según `type`:
  - 🔌 `mcp`
  - 🌐 `http`
  - 🗃️ `sql`
  - 🔧 `custom`
- [ ] **DataStores**: icono según `type`:
  - 🐘 `postgres`
  - 🔴 `redis`
  - 📊 `vector_db`
  - ☁️ `s3`
  - 📄 `file`
- [ ] **Bridges**: icono según `kind` (filter, transform, summarize, route, validate, persist, aggregate, compose).
- [ ] Considerar reemplazar emojis por SVG (lucide-react o iconos propios) si la consistencia visual con emoji es pobre en Windows.

---

## 4. Colores por tipo de tool

- [ ] Variables CSS por tipo:
  - `--tool-mcp`: cian
  - `--tool-http`: verde
  - `--tool-sql`: naranja
  - `--tool-custom`: morado claro
- [ ] Aplicar color al borde izquierdo y al icono del nodo Tool.

---

## 5. Agrupación visual "External Systems"

- [ ] Identificar nodos externos: tools con `type ∈ {mcp, http}` y todos los `dataStores`.
- [ ] **Posicionarlos en una banda superior** (sobre el flujo principal). Tras el auto-layout, elevar su Y a `min_y_internal - 250`.
- [ ] **Caja contenedora translúcida** etiquetada "External Systems" que las engloba. Implementar como nodo de tipo `group` en React Flow (renderizado detrás, `zIndex: -1`, no seleccionable).
- [ ] Las edges que cruzan al grupo deben verse claras (sin atravesar otros nodos).

---

## 6. Edges: handles estrictos y curvas bezier

- [ ] **Handles fijos**:
  - `target` siempre en `Position.Left` (con `id: 'left'`).
  - `source` siempre en `Position.Right` (con `id: 'right'`).
  - Aplicar a TODOS los node types (Agent, Tool, Bridge, DataStore).
- [ ] **Edges con `sourceHandle: 'right'` y `targetHandle: 'left'` explícitos** para evitar que React Flow elija el handle "más cercano".
- [ ] **Edges curvas bezier**: cambiar `type` de `'smoothstep'` a `'default'` (o `'simplebezier'`) en `jsonToFlow.ts`.
- [ ] Verificar visualmente que **ninguna flecha entra por la derecha o sale por la izquierda** en el viewer.

---

## 7. Color de edges por semántica

- [ ] **`delegation`** (agente → agente): azul accent.
- [ ] **`tool_call`** (agente → tool): naranja.
- [ ] **`data_read` / `data_write`**: gris.
- [ ] **`event`**: morado.
- [ ] **`handoff`**: verde.
- [ ] Comprobar contraste sobre fondo oscuro.
- [ ] Etiqueta legible sobre la edge sin saturar.

---

## 8. Polish

- [ ] El badge de `executionMode` en el AgentNode debería integrarse en el círculo (no romper el layout).
- [ ] Considerar mini-leyenda en la esquina del canvas (opcional, toggle) que explique colores/formas.
- [ ] Comprobar que con `feature-showcase` activo (variante avanzada, ~30 nodos, ~28 edges) el layout es legible **de un vistazo**, sin solapamientos.

---

## Criterio de aceptación global

> En la variante avanzada del `feature-showcase`, **debo entender el flujo en 5 segundos**: agentes redondos en línea LR, tools y dataStores externos arriba en su caja, bridges como hexágonos en el medio, edges curvas con color por semántica entrando por la izquierda y saliendo por la derecha. Cero solapamientos. Cero confusión.
