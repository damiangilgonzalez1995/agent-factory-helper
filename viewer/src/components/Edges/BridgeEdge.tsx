import { getBezierPath, type EdgeProps } from 'reactflow';
import BridgeIcon from '../../lib/icons/BridgeIcon';

interface BridgeEdgeData {
  bridgeId?: string;
  route?: 'through' | 'bypass';
  hiddenLayer?: 'bridges' | 'tools';
}

/**
 * Edge custom: dibuja un único bezier source→target y superpone un icono
 * de puente (con foreignObject) en el midpoint. Click en el icono abre el
 * panel de informe del bridge — la edge sigue siendo una sola línea, así
 * la dirección queda clara por la propia flecha.
 */
export default function BridgeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
  label,
}: EdgeProps<BridgeEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      {label && (
        <text>
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
            {label}
          </textPath>
        </text>
      )}
      <foreignObject
        x={labelX - 26}
        y={labelY - 20}
        width={52}
        height={40}
        className="bridge-edge-overlay"
        requiredExtensions="http://www.w3.org/1999/xhtml"
        style={{ overflow: 'visible' }}
      >
        <div
          className="bridge-on-edge"
          data-bridge-id={data?.bridgeId ?? ''}
          title="Click para ver el análisis del bridge"
        >
          <BridgeIcon size={28} />
        </div>
      </foreignObject>
    </>
  );
}
