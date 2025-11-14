import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface CustomNodeData {
  label?: string;
  type?: 'location' | 'task' | 'driver';
  [key: string]: any;
}

function GraphNode({ data, selected }: NodeProps<CustomNodeData>) {
  const nodeType = data.type || 'location';
  
  const getNodeColor = () => {
    switch (nodeType) {
      case 'driver':
        return '#00A8E8'; // Blue for drivers
      case 'task':
        return '#FF6B6B'; // Red for tasks
      default:
        return '#4ECDC4'; // Teal for locations
    }
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

  return (
    <div
      style={{
        width,
        height,
        borderRadius: '50%',
        backgroundColor: color,
        border: selected ? '3px solid #FFD93D' : '2px solid #fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '12px',
        fontWeight: 'bold',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} />
      {data.label && (
        <div style={{ textAlign: 'center', padding: '2px' }}>
          {data.label.length > 4 ? data.label.substring(0, 4) : data.label}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(GraphNode);

