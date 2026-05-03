export type ExecutionMode =
  | 'react_loop'
  | 'one_shot'
  | 'tool_then_return'
  | 'plan_then_execute'
  | 'parallel_tools';

export type ContextStrategy = 'stateless' | 'windowed' | 'summarized' | 'full_history' | 'rag';

export type StateModel =
  | 'message_passing'
  | 'shared_blackboard'
  | 'scoped_state'
  | 'external_store';

export type BridgeKind =
  | 'filter'
  | 'transform'
  | 'summarize'
  | 'route'
  | 'validate'
  | 'persist'
  | 'aggregate'
  | 'compose';

export type BridgeImpl = 'code' | 'code_with_tool' | 'llm_micro';

export type EdgeKind =
  | 'delegation'
  | 'tool_call'
  | 'data_read'
  | 'data_write'
  | 'event'
  | 'handoff';

export type VariantKey = 'basic' | 'intermediate' | 'advanced';

export interface Position {
  x: number;
  y: number;
}

export type AgentSubtype = 'router';

export interface AgentNodeData {
  id: string;
  name: string;
  role: string;
  model: string;
  systemPromptSummary: string;
  tools: string[];
  executionMode: ExecutionMode;
  executionModeRationale: string;
  contextStrategy: ContextStrategy;
  stateReads: string[];
  stateWrites: string[];
  position: Position;
  /**
   * Subtipo opcional. Por ejemplo `'router'` marca un agente especializado
   * en enrutar la conversación a otros agentes. Se renderiza con el mismo
   * icono base + un overlay distintivo.
   */
  subtype?: AgentSubtype;
}

export interface ToolNodeData {
  id: string;
  name: string;
  type: string;
  description: string;
  consumedBy: string[];
  idempotent?: boolean;
  sideEffect?: 'read' | 'write' | 'irreversible';
  position: Position;
  /**
   * Si vale `'delegation'`, esta tool es solo un puente entre agentes
   * (p.ej. `delegate_to_extractor`). El viewer la oculta como nodo y
   * la sustituye por una edge directa agente→agente, marcando al agente
   * origen como "delegador".
   */
  mode?: 'delegation';
}

export interface BridgeNodeData {
  id: string;
  name: string;
  kind: BridgeKind;
  implementation: BridgeImpl;
  description: string;
  inputSchema?: string;
  outputSchema?: string;
  position: Position;
}

export interface DataStoreNodeData {
  id: string;
  name: string;
  type: string;
  position: Position;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: EdgeKind;
  via?: string | null;
}

export interface Variant {
  stateModel: StateModel;
  agents: AgentNodeData[];
  tools: ToolNodeData[];
  bridges: BridgeNodeData[];
  dataStores: DataStoreNodeData[];
  apiGateways?: ApiGatewayNodeData[];
  edges: ArchEdge[];
  rationale: string;
  patterns?: string[];
}

export interface Complexity {
  domain: number;
  task: number;
  context: number;
  tools: number;
  flow: number;
  total: number;
  verdict: string;
  recommendedPatterns: string[];
  rationale: string;
}

export interface Case {
  slug: string;
  title: string;
  description: string;
  constraints: string[];
  inputs?: string[];
  outputs?: string[];
  actors?: string[];
  volume?: string;
  createdAt: string;
  complexity?: Complexity;
}

export interface HistoryEntry {
  timestamp: string;
  variant: VariantKey;
  summary: string;
  /**
   * Copia profunda de las 3 variantes en el momento del cambio.
   * Puede venir parcial en JSON antiguos o de ejemplo; los nuevos snapshots
   * (creados por el viewer o subagentes) deben venir completos.
   */
  snapshot: Partial<Record<VariantKey, Variant>>;
}

export interface Architecture {
  case: Case;
  variants: Record<VariantKey, Variant>;
  activeVariant: VariantKey;
  history: HistoryEntry[];
}

export type SelectedNodeKind = 'agent' | 'tool' | 'bridge' | 'datastore' | 'api';

export interface SelectedNode {
  kind: SelectedNodeKind;
  id: string;
}

/**
 * Capas toggleables. Los agentes siempre visibles (no aparecen como flag).
 * Las demás categorías cada una en su capa, granulares.
 */
export type LayerKey = 'api' | 'tools' | 'bridges' | 'datastores';

export interface LayerState {
  api: boolean;
  tools: boolean;
  bridges: boolean;
  datastores: boolean;
}

/**
 * API Gateway: punto de entrada del grafo. Representa la API que envuelve
 * la red de agentes (REST / GraphQL / gRPC / WebSocket).
 */
export type ApiGatewayKind = 'rest' | 'graphql' | 'rpc' | 'websocket';

export interface ApiGatewayNodeData {
  id: string;
  name: string;
  kind: ApiGatewayKind;
  position: Position;
  description?: string;
}
