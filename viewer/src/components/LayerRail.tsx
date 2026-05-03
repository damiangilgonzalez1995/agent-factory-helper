import { useState } from 'react';
import type { LayerKey, LayerState } from '../types';
import AgentIcon from '../lib/icons/AgentIcon';
import { ToolGeneric } from '../lib/icons/ToolIcons';
import BridgeIcon from '../lib/icons/BridgeIcon';
import { DataStorePostgres } from '../lib/icons/DataStoreIcons';
import ApiGatewayIcon from '../lib/icons/ApiGatewayIcon';

interface Props {
  layers: LayerState;
  onToggle: (key: LayerKey) => void;
  counts: {
    agents: number;
    tools: number;
    bridges: number;
    dataStores: number;
    apiGateways: number;
  };
}

export default function LayerRail({ layers, onToggle, counts }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        className="layer-rail-pill"
        onClick={() => setCollapsed(false)}
        aria-label="Mostrar capas"
        title="Mostrar capas"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        Capas
      </button>
    );
  }

  return (
    <aside className="layer-rail-floating" aria-label="Capas del diagrama">
      <header className="rail-head">
        <div className="rail-head-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          <span>Capas</span>
        </div>
        <button
          className="rail-collapse"
          onClick={() => setCollapsed(true)}
          aria-label="Colapsar capas"
          title="Colapsar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>
      </header>

      <div className="rail-rows">
        {/* Agentes (siempre visibles, sin badge) */}
        <div className="layer-row anchored">
          <div className="layer-thumb thumb-agent" aria-hidden="true">
            <AgentIcon size={26} />
          </div>
          <div className="layer-info">
            <div className="layer-name">Agentes</div>
            <div className="layer-count">{counts.agents} en el flujo</div>
          </div>
        </div>

        {/* API */}
        <ToggleRow
          label="API"
          count={`${counts.apiGateways} gateways`}
          on={layers.api}
          onClick={() => onToggle('api')}
          colorClass="on-api"
          thumb={
            <div className="layer-thumb thumb-api" aria-hidden="true">
              <ApiGatewayIcon size={24} />
            </div>
          }
        />

        {/* Herramientas */}
        <ToggleRow
          label="Herramientas"
          count={`${counts.tools} tools`}
          on={layers.tools}
          onClick={() => onToggle('tools')}
          colorClass="on-tool"
          thumb={
            <div className="layer-thumb thumb-tool" aria-hidden="true">
              <ToolGeneric size={26} />
            </div>
          }
        />

        {/* Bridges */}
        <ToggleRow
          label="Bridges"
          count={`${counts.bridges} bridges`}
          on={layers.bridges}
          onClick={() => onToggle('bridges')}
          colorClass="on-bridge"
          thumb={
            <div className="layer-thumb thumb-bridge" aria-hidden="true">
              <BridgeIcon size={24} />
            </div>
          }
        />

        {/* Datos */}
        <ToggleRow
          label="Datos"
          count={`${counts.dataStores} stores`}
          on={layers.datastores}
          onClick={() => onToggle('datastores')}
          colorClass="on-data"
          thumb={
            <div className="layer-thumb thumb-data" aria-hidden="true">
              <DataStorePostgres size={26} />
            </div>
          }
        />
      </div>

      <p className="rail-foot">
        Los agentes nunca se mueven al alternar capas.
      </p>
    </aside>
  );
}

interface ToggleRowProps {
  label: string;
  count: string;
  on: boolean;
  onClick: () => void;
  colorClass: string;
  thumb: React.ReactNode;
}

function ToggleRow({ label, count, on, onClick, colorClass, thumb }: ToggleRowProps) {
  return (
    <div
      className={`layer-row${on ? ' on' : ' off'}`}
      role="button"
      tabIndex={0}
      aria-pressed={on}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {thumb}
      <div className="layer-info">
        <div className="layer-name">{label}</div>
        <div className="layer-count">{count}</div>
      </div>
      <span
        className={`layer-toggle${on ? ` ${colorClass}` : ''}`}
        role="switch"
        aria-checked={on}
      />
    </div>
  );
}
