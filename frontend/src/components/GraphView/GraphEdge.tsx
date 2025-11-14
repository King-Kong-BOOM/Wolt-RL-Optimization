import { memo } from 'react';
import { EdgeProps } from 'reactflow';

function GraphEdge({ id, sourceX, sourceY, targetX, targetY, selected, markerEnd }: EdgeProps) {
  return (
    <g>
      <path
        id={id}
        d={`M ${sourceX} ${sourceY} Q ${(sourceX + targetX) / 2} ${(sourceY + targetY) / 2 - 20} ${targetX} ${targetY}`}
        fill="none"
        stroke={selected ? '#FFD93D' : '#94A3B8'}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={selected ? '5,5' : '0'}
        markerEnd={markerEnd}
      />
    </g>
  );
}

export default memo(GraphEdge);

