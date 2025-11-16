import { memo, useState, useRef, useEffect } from 'react';
import { EdgeProps, useReactFlow } from 'reactflow';
import './GraphEdge.css';

interface CustomEdgeData {
  weight?: number;
  showWeight?: boolean;
  [key: string]: any;
}

function GraphEdgeComponent({ id, sourceX, sourceY, targetX, targetY, selected, markerEnd, source, target, data }: EdgeProps<CustomEdgeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverPathRef = useRef<SVGPathElement>(null);
  const isHoveredRef = useRef(false);
  
  // Get node data to calculate actual center positions
  const { getNode } = useReactFlow();
  
  // Use a more stable hover detection on the invisible hover path
  // Use mouseover/mouseout for SVG elements as they're more reliable
  useEffect(() => {
    const pathElement = hoverPathRef.current;
    if (!pathElement) return;
    
    const handleMouseOver = (e: MouseEvent) => {
      e.stopPropagation();
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      isHoveredRef.current = true;
      setIsHovered(true);
    };
    
    const handleMouseOut = (e: MouseEvent) => {
      e.stopPropagation();
      // Check if we're actually leaving the edge area
      const relatedTarget = e.relatedTarget as Node;
      // If relatedTarget is null or not a child of the path, we're leaving
      if (!relatedTarget || !pathElement.contains(relatedTarget)) {
        // Small delay to prevent flickering
        hoverTimeoutRef.current = setTimeout(() => {
          // Double-check we're still not hovering
          if (!isHoveredRef.current) {
            setIsHovered(false);
          }
          hoverTimeoutRef.current = null;
        }, 150);
      }
    };
    
    // Also handle mouseleave for additional stability
    const handleMouseLeave = (e: MouseEvent) => {
      e.stopPropagation();
      hoverTimeoutRef.current = setTimeout(() => {
        isHoveredRef.current = false;
        setIsHovered(false);
        hoverTimeoutRef.current = null;
      }, 150);
    };
    
    pathElement.addEventListener('mouseover', handleMouseOver);
    pathElement.addEventListener('mouseout', handleMouseOut);
    pathElement.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      pathElement.removeEventListener('mouseover', handleMouseOver);
      pathElement.removeEventListener('mouseout', handleMouseOut);
      pathElement.removeEventListener('mouseleave', handleMouseLeave);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);
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
      (sourceNode.data?.type === 'driver' ? 45 : sourceNode.data?.type === 'task' ? 35 : 30);
    const nodeHeight = sourceNode.measured?.height || sourceNode.height || 
      (sourceNode.data?.type === 'driver' ? 45 : sourceNode.data?.type === 'task' ? 35 : 30);
    
    centerSourceX = sourceNode.position.x + nodeWidth / 2;
    centerSourceY = sourceNode.position.y + nodeHeight / 2;
  }
  
  if (targetNode) {
    const nodeWidth = targetNode.measured?.width || targetNode.width || 
      (targetNode.data?.type === 'driver' ? 45 : targetNode.data?.type === 'task' ? 35 : 30);
    const nodeHeight = targetNode.measured?.height || targetNode.height || 
      (targetNode.data?.type === 'driver' ? 45 : targetNode.data?.type === 'task' ? 35 : 30);
    
    centerTargetX = targetNode.position.x + nodeWidth / 2;
    centerTargetY = targetNode.position.y + nodeHeight / 2;
  }
  
  // Calculate direction vector from source center to target center
  const dx = centerTargetX - centerSourceX;
  const dy = centerTargetY - centerSourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Node radius offset (average of typical node sizes: 15-22px radius)
  // Using 18px as a reasonable average to ensure edges don't overlap nodes
  const nodeRadius = 18;
  
  // Calculate offset points on node boundaries
  // Only offset if distance is greater than 2 * radius (nodes don't overlap)
  let startX = centerSourceX;
  let startY = centerSourceY;
  let endX = centerTargetX;
  let endY = centerTargetY;
  
  if (distance > nodeRadius * 2 && distance > 0) {
    // Normalize direction vector
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    // Offset start and end points by node radius
    startX = centerSourceX + unitX * nodeRadius;
    startY = centerSourceY + unitY * nodeRadius;
    endX = centerTargetX - unitX * nodeRadius;
    endY = centerTargetY - unitY * nodeRadius;
  }
  
  const weight = data?.weight;
  const showWeight = data?.showWeight || false;
  
  // Calculate position for weight label (midpoint of the straight line)
  const labelX = (startX + endX) / 2;
  const labelY = (startY + endY) / 2;

  const shouldShowWeight = showWeight || isHovered;
  
  return (
    <g
      className="graph-edge"
      data-show-weight={showWeight ? 'true' : 'false'}
      data-is-hovered={isHovered ? 'true' : 'false'}
      style={{ cursor: 'pointer' }}
    >
      {/* Invisible wider path for easier hovering - positioned behind visible edge */}
      <path
        ref={hoverPathRef}
        d={`M ${startX} ${startY} L ${endX} ${endY}`}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        style={{ pointerEvents: 'all', cursor: 'pointer' }}
      />
      {/* Visible edge path - straight line */}
      <path
        id={id}
        d={`M ${startX} ${startY} L ${endX} ${endY}`}
        fill="none"
        stroke={selected ? '#FFD93D' : '#94A3B8'}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={selected ? '5,5' : '0'}
        markerEnd={markerEnd}
        style={{ pointerEvents: 'none' }}
      />
      {weight !== undefined && shouldShowWeight && (
        <g 
          className="edge-weight-label"
          pointerEvents="none"
        >
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

// Custom comparison function for memo to prevent unnecessary re-renders
// Note: We don't compare sourceX/sourceY/targetX/targetY because ReactFlow updates these
// frequently, but we still want to prevent re-renders when only hover state changes internally
const GraphEdge = memo(GraphEdgeComponent, (prevProps, nextProps) => {
  // Only re-render if essential data changes
  // Hover state is internal and shouldn't trigger parent re-renders
  return (
    prevProps.id === nextProps.id &&
    prevProps.source === nextProps.source &&
    prevProps.target === nextProps.target &&
    prevProps.data?.weight === nextProps.data?.weight &&
    prevProps.data?.showWeight === nextProps.data?.showWeight &&
    prevProps.selected === nextProps.selected
  );
});

export default GraphEdge;

