import { memo, useState } from 'react';
import { EdgeProps, useReactFlow } from 'reactflow';

interface CustomEdgeData {
  weight?: number;
  showWeight?: boolean;
  [key: string]: any;
}

function GraphEdgeComponent({ id, sourceX, sourceY, targetX, targetY, selected, markerEnd, source, target, data }: EdgeProps<CustomEdgeData>) {
  const [isHovered, setIsHovered] = useState(false);
  // Get node data to calculate actual center positions
  const { getNode } = useReactFlow();
  const sourceNode = getNode(source);
  const targetNode = getNode(target);
  
  // ReactFlow's sourceX/sourceY should be center coordinates when handles are Position.Center
  // But if they're not, we'll calculate from node positions
  let centerSourceX = sourceX;
  let centerSourceY = sourceY;
  let centerTargetX = targetX;
  let centerTargetY = targetY;
  
  // Calculate center from node position if node data is available
  // ReactFlow stores position at top-left, so we need to add half the node dimensions
  if (sourceNode) {
    // Try to get actual measured dimensions, fallback to default sizes
    const nodeWidth = sourceNode.measured?.width || sourceNode.width || 
      (sourceNode.data?.type === 'driver' ? 60 : sourceNode.data?.type === 'task' ? 50 : 40);
    const nodeHeight = sourceNode.measured?.height || sourceNode.height || 
      (sourceNode.data?.type === 'driver' ? 60 : sourceNode.data?.type === 'task' ? 50 : 40);
    
    centerSourceX = sourceNode.position.x + nodeWidth / 2;
    centerSourceY = sourceNode.position.y + nodeHeight / 2;
  }
  
  if (targetNode) {
    const nodeWidth = targetNode.measured?.width || targetNode.width || 
      (targetNode.data?.type === 'driver' ? 60 : targetNode.data?.type === 'task' ? 50 : 40);
    const nodeHeight = targetNode.measured?.height || targetNode.height || 
      (targetNode.data?.type === 'driver' ? 60 : targetNode.data?.type === 'task' ? 50 : 40);
    
    centerTargetX = targetNode.position.x + nodeWidth / 2;
    centerTargetY = targetNode.position.y + nodeHeight / 2;
  }
  
  // Calculate direction vector from source center to target center
  const dx = centerTargetX - centerSourceX;
  const dy = centerTargetY - centerSourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Node radius offset (average of typical node sizes: 20-30px radius)
  // Using 25px as a reasonable average to ensure edges don't overlap nodes
  const nodeRadius = 25;
  
  // Calculate offset points on node boundaries
  // Only offset if distance is greater than 2 * radius (nodes don't overlap)
  let startX = centerSourceX;
  let startY = centerSourceY;
  let endX = centerTargetX;
  let endY = centerTargetY;
  let controlX = (startX + endX) / 2;
  let controlY = (startY + endY) / 2;
  
  if (distance > nodeRadius * 2 && distance > 0) {
    // Normalize direction vector
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    // Offset start and end points by node radius
    startX = centerSourceX + unitX * nodeRadius;
    startY = centerSourceY + unitY * nodeRadius;
    endX = centerTargetX - unitX * nodeRadius;
    endY = centerTargetY - unitY * nodeRadius;
    
    // Calculate control point for quadratic bezier curve (slightly offset for curve)
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Perpendicular offset for curve (perpendicular to the line direction)
    const perpX = -dy / distance * 20; // 20px perpendicular offset
    const perpY = dx / distance * 20;
    controlX = midX + perpX;
    controlY = midY + perpY;
  }
  
  const weight = data?.weight;
  const showWeight = data?.showWeight || false;
  const shouldShowWeight = showWeight || isHovered;
  
  // Calculate position for weight label (midpoint of the curve)
  const labelX = (startX + endX) / 2 + (controlX - (startX + endX) / 2) * 0.5;
  const labelY = (startY + endY) / 2 + (controlY - (startY + endY) / 2) * 0.5;

  return (
    <g
      style={{ cursor: 'pointer' }}
    >
      {/* Invisible wider path for easier hovering - positioned behind visible edge */}
      <path
        d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ pointerEvents: 'all' }}
      />
      {/* Visible edge path */}
      <path
        id={id}
        d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
        fill="none"
        stroke={selected ? '#FFD93D' : '#94A3B8'}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={selected ? '5,5' : '0'}
        markerEnd={markerEnd}
        style={{ pointerEvents: 'none' }}
      />
      {shouldShowWeight && weight !== undefined && (
        <g>
          {/* Background circle for weight label */}
          <circle
            cx={labelX}
            cy={labelY}
            r="12"
            fill="#1a1a1a"
            stroke={selected ? '#FFD93D' : '#94A3B8'}
            strokeWidth="1"
            opacity="0.9"
          />
          {/* Weight text */}
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={selected ? '#FFD93D' : '#FFFFFF'}
            fontSize="11"
            fontWeight="600"
            pointerEvents="none"
          >
            {weight}
          </text>
        </g>
      )}
    </g>
  );
}

// Wrap in memo but ensure it can use hooks
const GraphEdge = memo(GraphEdgeComponent);

export default GraphEdge;

