import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { ToolNodeData } from '../../types';
import { ToolIconByType } from '../../lib/icons/ToolIcons';

/**
 * Shape: HEXÁGONO. Icono dentro, nombre + type debajo.
 * El hexágono se compone con clip-path: outer (color borde) + inner (fill).
 */
export default function ToolNode({ data, selected }: NodeProps<ToolNodeData>) {
  return (
    <div className={`tool-node tool-${data.type}${selected ? ' selected' : ''}`}>
      <Handle id="left" type="target" position={Position.Left} />
      <div className="tool-node-body">
        <div className="tool-node-inner">
          <ToolIconByType type={data.type} size={32} />
        </div>
      </div>
      <div className="node-label">
        <div className="tool-name">{data.name}</div>
        <span className="tool-type-badge">{data.type}</span>
      </div>
      <Handle id="right" type="source" position={Position.Right} />
    </div>
  );
}
