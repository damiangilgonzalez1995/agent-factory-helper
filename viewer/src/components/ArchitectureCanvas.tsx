import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  applyNodeChanges,
  type NodeChange,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from 'reactflow';
import type { Architecture, LayerKey, LayerState, SelectedNode, VariantKey } from '../types';
import { variantToFlow } from '../lib/jsonToFlow';
import { applyAutoLayout, hasOverlaps, resolveOverlap } from '../lib/autoLayout';
import AgentNode from './NodeTypes/AgentNode';
import ToolNode from './NodeTypes/ToolNode';
import DataStoreNode from './NodeTypes/DataStoreNode';
import ApiGatewayNode from './NodeTypes/ApiGatewayNode';
import BridgeEdge from './Edges/BridgeEdge';
import LayerRail from './LayerRail';
import BridgeReportPanel from './BridgeReportPanel';

interface Props {
  arch: Architecture;
  variantKey: VariantKey;
  visibleLayers: LayerState;
  onToggleLayer: (key: LayerKey) => void;
  layerCounts: {
    agents: number;
    tools: number;
    bridges: number;
    dataStores: number;
    apiGateways: number;
  };
  onSelect: (n: SelectedNode | null) => void;
  onLayoutDirty: (dirty: boolean) => void;
  collectPositions: (collector: () => Map<string, { x: number; y: number }>) => void;
  registerAutoLayout: (run: () => void) => void;
}

const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  datastore: DataStoreNode,
  api: ApiGatewayNode,
};

const edgeTypes = {
  'bridge-edge': BridgeEdge,
};

const minimapColor = (n: Node): string => {
  switch (n.type) {
    case 'agent':
      return '#6c8ef5';
    case 'tool':
      return '#f59e3a';
    case 'bridge':
      return '#10d9a0';
    case 'datastore':
      return '#c084fc';
    case 'api':
      return '#22d3ee';
    default:
      return 'transparent';
  }
};

/**
 * Devuelve true si el nodo debe ocultarse según el estado de capas activo.
 * Los agentes están siempre visibles.
 */
function isHiddenByLayer(nodeType: string | undefined, layers: LayerState): boolean {
  if (nodeType === 'tool') return !layers.tools;
  if (nodeType === 'datastore') return !layers.datastores;
  if (nodeType === 'api') return !layers.api;
  return false;
}

export default function ArchitectureCanvas({
  arch,
  variantKey,
  visibleLayers,
  onToggleLayer,
  layerCounts,
  onSelect,
  onLayoutDirty,
  collectPositions,
  registerAutoLayout,
}: Props) {
  const variant = arch.variants[variantKey];
  const initialFlow = useMemo(() => variantToFlow(variant), [variant]);

  const [nodes, setNodes] = useState<Node[]>(initialFlow.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialFlow.edges);

  // Reset cuando cambia la variante o llega un JSON nuevo.
  // Si las posiciones del JSON generan solapes, aplicar auto-layout silenciosamente.
  useEffect(() => {
    let next = initialFlow.nodes;
    if (hasOverlaps(next)) {
      next = applyAutoLayout(next, initialFlow.edges, {
        externalIds: initialFlow.externalIds,
      });
    }
    setNodes(next);
    setEdges(initialFlow.edges);
    onLayoutDirty(false);
  }, [initialFlow, onLayoutDirty]);

  // Aplicar visibilidad de capas: actualizar `hidden` SIN reemplazar posiciones.
  // Para edges con `data.route === 'bypass'`: invisibles cuando state ON
  //   (porque la ruta a través del bridge toma el relevo).
  // Para edges normales o through-bridge: hidden si cualquier endpoint está oculto.
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        const hidden = isHiddenByLayer(n.type, visibleLayers);
        return n.hidden === hidden ? n : { ...n, hidden };
      }),
    );
    setEdges((prev) => {
      const nodeTypeById = new Map(initialFlow.nodes.map((n) => [n.id, n.type]));
      return prev.map((e) => {
        const data = e.data as
          | { route?: 'through' | 'bypass'; hiddenLayer?: 'bridges' | 'tools' }
          | undefined;
        const isBypass = data?.route === 'bypass';

        if (isBypass) {
          // Bypass visible solo cuando su capa está OFF (la ruta original
          // a través del intermediario está oculta).
          const layer = data?.hiddenLayer;
          const layerOn = layer === 'bridges' ? visibleLayers.bridges : visibleLayers.tools;
          const hidden = layerOn;
          return e.hidden === hidden ? e : { ...e, hidden };
        }

        const sHidden = isHiddenByLayer(nodeTypeById.get(e.source), visibleLayers);
        const tHidden = isHiddenByLayer(nodeTypeById.get(e.target), visibleLayers);
        const hidden = sHidden || tHidden;
        return e.hidden === hidden ? e : { ...e, hidden };
      });
    });
  }, [visibleLayers, initialFlow.nodes]);

  // Expose position collector to parent
  useEffect(() => {
    collectPositions(() => {
      const map = new Map<string, { x: number; y: number }>();
      for (const n of nodes) {
        if (n.type === 'group') continue;
        map.set(n.id, { x: n.position.x, y: n.position.y });
      }
      return map;
    });
  }, [nodes, collectPositions]);

  // Expose auto-layout trigger to parent (botón de la topbar)
  useEffect(() => {
    registerAutoLayout(() => {
      setNodes((current) =>
        applyAutoLayout(current, edges, { externalIds: initialFlow.externalIds }),
      );
      onLayoutDirty(true);
    });
  }, [registerAutoLayout, edges, initialFlow.externalIds, onLayoutDirty]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        // Tras soltar un nodo, resolver solape contra el resto
        for (const c of changes) {
          if (c.type === 'position' && c.dragging === false && c.id) {
            return resolveOverlap(updated, c.id);
          }
        }
        return updated;
      });
      if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
        onLayoutDirty(true);
      }
    },
    [onLayoutDirty],
  );

  const [selectedBridgeId, setSelectedBridgeId] = useState<string | null>(null);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const kind = node.type as SelectedNode['kind'] | undefined;
      if (kind && (kind === 'agent' || kind === 'tool' || kind === 'datastore' || kind === 'api')) {
        onSelect({ kind, id: node.id });
        setSelectedBridgeId(null);
      }
    },
    [onSelect],
  );

  const onEdgeClick = useCallback(
    (_: unknown, edge: Edge) => {
      const data = edge.data as { bridgeId?: string } | undefined;
      if (data?.bridgeId) {
        setSelectedBridgeId(data.bridgeId);
        onSelect({ kind: 'bridge', id: data.bridgeId });
      }
    },
    [onSelect],
  );

  const onPaneClick = useCallback(() => {
    onSelect(null);
    setSelectedBridgeId(null);
  }, [onSelect]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: false }}
      className={`layer-bridges-${visibleLayers.bridges ? 'on' : 'off'}`}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#30363d" />
      <Controls showInteractive={false} />
      <MiniMap nodeColor={minimapColor} maskColor="rgba(13, 17, 23, 0.6)" pannable zoomable />
      <Panel position="top-left">
        <LayerRail layers={visibleLayers} onToggle={onToggleLayer} counts={layerCounts} />
      </Panel>
      {selectedBridgeId && (
        <Panel position="top-right">
          <BridgeReportPanel
            bridgeId={selectedBridgeId}
            variant={variant}
            onClose={() => setSelectedBridgeId(null)}
          />
        </Panel>
      )}
    </ReactFlow>
  );
}
