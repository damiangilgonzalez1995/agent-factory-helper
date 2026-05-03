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
