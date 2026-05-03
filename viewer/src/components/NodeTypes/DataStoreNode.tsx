import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { DataStoreNodeData } from '../../types';
import { DataStoreIconByType } from '../../lib/icons/DataStoreIcons';

/**
 * Shape: CILINDRO VERTICAL (rounded rect tall). Icono dentro, nombre + type debajo.
 */
export default function DataStoreNode({ data, selected }: NodeProps<DataStoreNodeData>) {
  return (
    <div className={`ds-node ds-${data.type}${selected ? ' selected' : ''}`}>
      <Handle id="left" type="target" position={Position.Left} />
      <div className="ds-node-body">
        <DataStoreIconByType type={data.type} size={48} />
      </div>
      <div className="node-label">
        <div className="ds-name">{data.name}</div>
        <span className="ds-type-badge">{data.type}</span>
      </div>
      <Handle id="right" type="source" position={Position.Right} />
    </div>
  );
}
