import type { NodeProps } from 'reactflow';

interface GroupData {
  label: string;
}

export default function GroupNode({ data }: NodeProps<GroupData>) {
  return (
    <div className="node-group">
      <div className="node-group-label">{data.label}</div>
    </div>
  );
}
