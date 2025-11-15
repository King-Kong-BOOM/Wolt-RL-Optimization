import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import type { SimulationState } from '../../types';
import GraphNode from './GraphNode';
import GraphEdge from './GraphEdge';

interface GraphViewProps {
  state: SimulationState | null;
  width: number;
  height: number;
  showEdgeWeights?: boolean;
  showProbabilities?: boolean;
  selectedDriverId?: string | null;
  selectedOrderId?: string | null;
}

const nodeTypes: NodeTypes = {
  default: GraphNode,
  location: GraphNode,
  task: GraphNode,
  driver: GraphNode,
};

const edgeTypes: EdgeTypes = {
  default: GraphEdge,
  smoothstep: GraphEdge,
};

function GraphViewComponent({ state, width, height, showEdgeWeights = false, showProbabilities = false, selectedDriverId = null, selectedOrderId = null }: GraphViewProps) {
  const reactFlowInstance = useRef<any>(null);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const [flashingNodes, setFlashingNodes] = useState<Set<string>>(new Set());

  const { reactFlowNodes: baseNodes, reactFlowEdges: baseEdges } = useGraphLayout(
    state?.nodes || [],
    state?.edges || [],
    { width, height, iterations: 100 }
  );

  // Add showWeight property to edges and showProbability to nodes
  const reactFlowEdges = useMemo(() => {
    return baseEdges.map(edge => ({
      ...edge,
      data: {
        ...edge.data,
        showWeight: showEdgeWeights,
      },
    }));
  }, [baseEdges, showEdgeWeights]);

  // Find the location node ID for the selected driver
  const selectedDriverLocationNodeId = useMemo(() => {
    if (!selectedDriverId || !state?.drivers) return null;
    const driver = state.drivers.find(d => d.id === selectedDriverId);
    return driver?.location || null;
  }, [selectedDriverId, state?.drivers]);

  // Find the location node ID for the selected order
  const selectedOrderLocationNodeId = useMemo(() => {
    if (!selectedOrderId || !state?.tasks) return null;
    const order = state.tasks.find(t => t.id === selectedOrderId);
    if (!order) return null;
    
    // Determine which node to highlight based on order status
    if (order.status === 'delivered') {
      return order.dropoff_node || null;
    } else if (order.status === 'in_transit') {
      // In transit - highlight pickup node (or could use driver location if available)
      return order.pickup_node || order.location || null;
    } else {
      // pending - highlight pickup node
      return order.pickup_node || order.location || null;
    }
  }, [selectedOrderId, state?.tasks]);

  // Detect new orders and trigger flash animation
  useEffect(() => {
    if (!state?.tasks) return;

    const currentOrderIds = new Set(state.tasks.map(task => task.id));
    const previousOrderIds = previousOrderIdsRef.current;

    // Find new orders (orders that exist now but didn't exist before)
    const newOrders = state.tasks.filter(task => 
      !previousOrderIds.has(task.id) && task.status === 'pending'
    );

    if (newOrders.length > 0) {
      // Get pickup nodes for new orders
      const newFlashNodes = new Set<string>();
      newOrders.forEach(order => {
        const pickupNode = order.pickup_node || order.location;
        if (pickupNode) {
          newFlashNodes.add(pickupNode);
        }
      });

      // Add new flashing nodes
      setFlashingNodes(prev => {
        const updated = new Set(prev);
        newFlashNodes.forEach(nodeId => updated.add(nodeId));
        return updated;
      });

      // Remove flash after animation completes (2 seconds)
      setTimeout(() => {
        setFlashingNodes(prev => {
          const updated = new Set(prev);
          newFlashNodes.forEach(nodeId => updated.delete(nodeId));
          return updated;
        });
      }, 2000);
    }

    // Update previous order IDs
    previousOrderIdsRef.current = currentOrderIds;
  }, [state?.tasks, state?.timestep]);

  const reactFlowNodes = useMemo(() => {
    return baseNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        showProbability: showProbabilities,
        isHighlighted: selectedDriverLocationNodeId === node.id || selectedOrderLocationNodeId === node.id,
        isFlashing: flashingNodes.has(node.id),
      },
    }));
  }, [baseNodes, showProbabilities, selectedDriverLocationNodeId, selectedOrderLocationNodeId, flashingNodes]);

  const onInit = useCallback((instance: any) => {
    reactFlowInstance.current = instance;
  }, []);

  // Fit view when new graph is loaded
  useEffect(() => {
    if (reactFlowInstance.current && reactFlowNodes.length > 0) {
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2, duration: 500 });
      }, 100);
    }
  }, [reactFlowNodes.length, state?.timestep]);

  // Center view on selected driver or order node when selected
  useEffect(() => {
    const nodeIdToCenter = selectedDriverLocationNodeId || selectedOrderLocationNodeId;
    if (reactFlowInstance.current && nodeIdToCenter) {
      const node = reactFlowInstance.current.getNode(nodeIdToCenter);
      if (node) {
        setTimeout(() => {
          reactFlowInstance.current?.setCenter(node.position.x, node.position.y, { duration: 500, zoom: 1.2 });
        }, 100);
      }
    }
  }, [selectedDriverLocationNodeId, selectedOrderLocationNodeId]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        fitView
        attributionPosition="bottom-left"
        style={{ background: '#1a1a1a' }}
      >
        <Background color="#2a2a2a" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const type = node.data?.type || 'location';
            switch (type) {
              case 'driver':
                return '#00A8E8';
              case 'task':
                return '#FF6B6B';
              default:
                return '#4ECDC4';
            }
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
        />
      </ReactFlow>
    </div>
  );
}

export default function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphViewComponent {...props} />
    </ReactFlowProvider>
  );
}

