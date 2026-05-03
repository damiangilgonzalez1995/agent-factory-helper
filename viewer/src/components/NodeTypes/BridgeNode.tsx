import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { BridgeNodeData } from '../../types';
import BridgeIcon from '../../lib/icons/BridgeIcon';

/**
 * Shape: PILL HORIZONTAL (capsule larga). Icono a la izquierda, texto a la derecha.
 * Mismo icono de puente para TODOS los bridges; el kind va de badge.
 */
export default function BridgeNode({ data, selected }: NodeProps<BridgeNodeData>) {
  return (
    <div className={`bridge-node${selected ? ' selected' : ''}`}>
      <Handle id="left" type="target" position={Position.Left} />
      <div className="bridge-node-body">
        <BridgeIcon size={32} />
        <div className="bridge-text">
          <div className="bridge-name">{data.name}</div>
          <span className="bridge-kind-badge">{data.kind}</span>
        </div>
      </div>
      <Handle id="right" type="source" position={Position.Right} />
    </div>
  );
}
