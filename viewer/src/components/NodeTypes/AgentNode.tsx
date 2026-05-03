import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { AgentNodeData } from '../../types';
import AgentIcon from '../../lib/icons/AgentIcon';

/**
 * Agent node.
 * - subtype: 'router' → rombo cyan
 * - data._isSubAgent → mezcla agent + tool-custom (anillo fucsia exterior)
 *   indica que este agente es usado como herramienta de otro
 */
export default function AgentNode({
  data,
  selected,
}: NodeProps<AgentNodeData & { _isSubAgent?: boolean }>) {
  const isRouter = data.subtype === 'router';
  const isSubAgent = data._isSubAgent === true;
  return (
    <div
      className={`agent-node${isRouter ? ' agent-router' : ''}${isSubAgent ? ' agent-sub-agent' : ''}${selected ? ' selected' : ''}`}
    >
      <Handle id="left" type="target" position={Position.Left} />
      <div className="agent-node-body">
        <AgentIcon size={48} variant={data.subtype} />
      </div>
      <div className="node-label">
        <div className="agent-name">{data.name}</div>
        <span className="agent-mode-badge">
          {isRouter ? 'router · ' : ''}
          {isSubAgent && !isRouter ? 'sub-agent · ' : ''}
          {data.executionMode.replace(/_/g, ' ')}
        </span>
      </div>
      <Handle id="right" type="source" position={Position.Right} />
    </div>
  );
}
