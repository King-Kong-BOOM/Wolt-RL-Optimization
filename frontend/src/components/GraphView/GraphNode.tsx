import { memo, useRef, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import './GraphNode.css';

interface CustomNodeData {
  label?: string;
  type?: 'location' | 'task' | 'driver';
  order_probability?: number;
  showProbability?: boolean;
  isHighlighted?: boolean;
  isFlashing?: boolean;
  [key: string]: any;
}

// Helper function to darken a hex color based on probability
function darkenColor(hex: string, probability: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Darken based on probability (higher probability = darker)
  // Use a factor between 0.3 (lightest) and 1.0 (darkest)
  const darkeningFactor = 0.3 + (probability * 0.7);
  
  const newR = Math.floor(r * darkeningFactor);
  const newG = Math.floor(g * darkeningFactor);
  const newB = Math.floor(b * darkeningFactor);
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

function GraphNode({ data, selected }: NodeProps<CustomNodeData>) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nodeType = data.type || 'location';
  const orderProbability = data.order_probability ?? 0;
  const showProbability = data.showProbability ?? false;
  const isHighlighted = data.isHighlighted ?? false;
  const isFlashing = data.isFlashing ?? false;
  
  // Use a more stable hover detection that doesn't get reset by re-renders
  useEffect(() => {
    const element = nodeRef.current;
    if (!element) return;
    
    const handleMouseEnter = () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setIsHovered(true);
    };
    
    const handleMouseLeave = () => {
      // Small delay to prevent flickering
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
        hoverTimeoutRef.current = null;
      }, 50);
    };
    
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);
  
  const getNodeColor = () => {
    const baseColor = (() => {
      switch (nodeType) {
        case 'driver':
          return '#00A8E8'; // Blue for drivers
        case 'task':
          return '#FF6B6B'; // Red for tasks
        default:
          return '#4ECDC4'; // Teal for locations
      }
    })();
    
    // Darken location nodes based on probability
    if (nodeType === 'location' && orderProbability > 0) {
      return darkenColor(baseColor, orderProbability);
    }
    
    return baseColor;
  };

  const getNodeSize = () => {
    switch (nodeType) {
      case 'driver':
        return { width: 45, height: 45 };
      case 'task':
        return { width: 35, height: 35 };
      default:
        return { width: 30, height: 30 };
    }
  };

  const { width, height } = getNodeSize();
  const color = getNodeColor();

  // Determine if we should show probability (toggle on OR hover)
  const shouldShowProbability = showProbability || (isHovered && nodeType === 'location' && orderProbability !== undefined);

  // Determine border style: flashing > highlighted > selected > default
  const getBorderStyle = () => {
    if (isFlashing && nodeType === 'location') {
      return '3px solid #FF4444'; // Red border for flashing (new order)
    }
    if (isHighlighted && nodeType === 'location') {
      return '3px solid #FFD93D'; // Yellow border for highlighted driver/order location
    }
    if (selected) {
      return '3px solid #FFD93D';
    }
    return '2px solid #fff';
  };

  // Add glow effect for highlighted and flashing nodes
  const getBoxShadow = () => {
    if (isFlashing && nodeType === 'location') {
      return '0 0 20px rgba(255, 68, 68, 0.8), 0 2px 8px rgba(0,0,0,0.2)';
    }
    if (isHighlighted && nodeType === 'location') {
      return '0 0 15px rgba(255, 217, 61, 0.6), 0 2px 8px rgba(0,0,0,0.2)';
    }
    return '0 2px 8px rgba(0,0,0,0.2)';
  };

  return (
    <div
      ref={nodeRef}
      className={`graph-node ${isFlashing ? 'node-flashing' : ''} ${nodeType === 'location' ? 'node-location' : ''}`}
      data-show-probability={showProbability ? 'true' : 'false'}
      data-has-probability={nodeType === 'location' && orderProbability !== undefined ? 'true' : 'false'}
      data-is-hovered={isHovered ? 'true' : 'false'}
      style={{
        width,
        height,
        borderRadius: '50%',
        backgroundColor: color,
        border: getBorderStyle(),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '10px',
        fontWeight: 'bold',
        boxShadow: getBoxShadow(),
        position: 'relative',
        zIndex: isFlashing ? 20 : (isHighlighted ? 15 : 10), // Flashing nodes above all
        cursor: nodeType === 'location' ? 'pointer' : 'default',
        transition: isFlashing ? 'none' : 'box-shadow 0.3s ease, border 0.3s ease',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Center}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <div className="node-content-wrapper">
        {/* Label - shown by default, hidden on hover when probability exists */}
        <div className="node-label">
          {data.label || ''}
        </div>
        {/* Probability - shown on toggle or hover (via CSS) */}
        {nodeType === 'location' && orderProbability !== undefined && (
          <div className="node-probability">
            {(orderProbability * 100).toFixed(0)}%
          </div>
        )}
      </div>
      <Handle 
        type="source" 
        position={Position.Center}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

// Custom comparison function for memo to prevent unnecessary re-renders
export default memo(GraphNode, (prevProps, nextProps) => {
  // Only re-render if data or selected state actually changes
  return (
    prevProps.data?.label === nextProps.data?.label &&
    prevProps.data?.type === nextProps.data?.type &&
    prevProps.data?.order_probability === nextProps.data?.order_probability &&
    prevProps.data?.showProbability === nextProps.data?.showProbability &&
    prevProps.data?.isHighlighted === nextProps.data?.isHighlighted &&
    prevProps.data?.isFlashing === nextProps.data?.isFlashing &&
    prevProps.selected === nextProps.selected
  );
});

