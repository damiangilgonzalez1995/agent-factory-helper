import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { ApiGatewayNodeData } from '../../types';
import ApiGatewayIcon from '../../lib/icons/ApiGatewayIcon';

/**
 * Shape: HEXÁGONO HORIZONTAL (sello / endpoint).
 * Distinto de Tools (hex con clip-path normal): aquí más alargado.
 */
export default function ApiGatewayNode({ data, selected }: NodeProps<ApiGatewayNodeData>) {
  return (
    <div className={`api-node${selected ? ' selected' : ''}`}>
      <Handle id="left" type="target" position={Position.Left} />
      <div className="api-node-body">
        <div className="api-node-inner">
          <ApiGatewayIcon size={42} />
        </div>
      </div>
      <div className="node-label">
        <div className="api-name">{data.name}</div>
        <span className="api-kind-badge">{data.kind}</span>
      </div>
      <Handle id="right" type="source" position={Position.Right} />
    </div>
  );
}
