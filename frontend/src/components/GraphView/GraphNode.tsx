import { memo, useState } from 'react';
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
  const [isHovered, setIsHovered] = useState(false);
  const nodeType = data.type || 'location';
  const orderProbability = data.order_probability ?? 0;
  const showProbability = data.showProbability ?? false;
  const isHighlighted = data.isHighlighted ?? false;
  const isFlashing = data.isFlashing ?? false;
  
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
        return { width: 60, height: 60 };
      case 'task':
        return { width: 50, height: 50 };
      default:
        return { width: 40, height: 40 };
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={isFlashing ? 'node-flashing' : ''}
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
        fontSize: '12px',
        fontWeight: 'bold',
        boxShadow: getBoxShadow(),
        position: 'relative',
        zIndex: isFlashing ? 20 : (isHighlighted ? 15 : 10), // Flashing nodes above all
        cursor: nodeType === 'location' ? 'pointer' : 'default',
        transition: isFlashing ? 'none' : 'box-shadow 0.3s ease, border 0.3s ease',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Center}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      {shouldShowProbability && nodeType === 'location' && orderProbability !== undefined ? (
        <div style={{ textAlign: 'center', padding: '2px' }}>
          {(orderProbability * 100).toFixed(0)}%
        </div>
      ) : data.label && (
        <div style={{ textAlign: 'center', padding: '2px' }}>
          {data.label.length > 4 ? data.label.substring(0, 4) : data.label}
        </div>
      )}
      <Handle 
        type="source" 
        position={Position.Center}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
    </div>
  );
}

export default memo(GraphNode);

