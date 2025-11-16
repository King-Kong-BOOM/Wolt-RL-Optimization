import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import type { SimulationState } from '../../types';
import GraphNode from './GraphNode';
import GraphEdge from './GraphEdge';
import DriverDot from './DriverDot';

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

function GraphViewComponentInner({ state, width, height, showEdgeWeights = false, showProbabilities = false, selectedDriverId = null, selectedOrderId = null }: GraphViewProps) {
  const reactFlowInstance = useRef<any>(null);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const [flashingNodes, setFlashingNodes] = useState<Set<string>>(new Set());
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isOverInteractiveElement, setIsOverInteractiveElement] = useState(false);
  const { getNode } = useReactFlow();

  // Defensive check: ensure state has nodes before passing to layout
  const nodes = state?.nodes || [];
  const edges = state?.edges || [];
  
  // Log warning if nodes disappear
  const previousNodesRef = useRef<number>(nodes.length);
  useEffect(() => {
    if (previousNodesRef.current > 0 && nodes.length === 0) {
      console.warn('State nodes array became empty. Previous count:', previousNodesRef.current, 'State:', state);
    }
    previousNodesRef.current = nodes.length;
  }, [nodes.length, state]);
  
  const { reactFlowNodes: baseNodes, reactFlowEdges: baseEdges } = useGraphLayout(
    nodes,
    edges,
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
    // Defensive check: ensure baseNodes is valid
    if (!baseNodes || baseNodes.length === 0) {
      console.warn('No base nodes available for rendering. baseNodes:', baseNodes, 'state?.nodes:', state?.nodes);
      return [];
    }
    return baseNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        showProbability: showProbabilities,
        isHighlighted: selectedDriverLocationNodeId === node.id || selectedOrderLocationNodeId === node.id,
        isFlashing: flashingNodes.has(node.id),
      },
    }));
  }, [baseNodes, showProbabilities, selectedDriverLocationNodeId, selectedOrderLocationNodeId, flashingNodes, state?.nodes]);

  const onInit = useCallback((instance: any) => {
    reactFlowInstance.current = instance;
    // Initialize viewport
    if (instance) {
      const vp = instance.getViewport();
      setViewport(vp);
    }
  }, []);

  // Track viewport changes for driver dot positioning
  useEffect(() => {
    if (reactFlowInstance.current) {
      const updateViewport = () => {
        const vp = reactFlowInstance.current?.getViewport();
        if (vp) {
          setViewport(vp);
        }
      };
      
      // Update viewport periodically to catch zoom/pan changes
      const interval = setInterval(updateViewport, 16); // ~60fps
      
      return () => clearInterval(interval);
    }
  }, [reactFlowInstance.current]);

  const onMove = useCallback((_event: any, viewport: any) => {
    setViewport(viewport);
  }, []);

  const onMoveStart = useCallback((_event: any, viewport: any) => {
    setViewport(viewport);
  }, []);

  const onMoveEnd = useCallback((_event: any, viewport: any) => {
    setViewport(viewport);
  }, []);

  const onViewportChange = useCallback((viewport: any) => {
    setViewport(viewport);
  }, []);

  // Fit view when new graph is loaded (only when node count changes from 0 to >0, not on every timestep)
  const previousNodeCountRef = useRef<number>(0);
  const hasFittedViewRef = useRef<boolean>(false);
  useEffect(() => {
    const currentNodeCount = reactFlowNodes.length;
    // Only fit view when nodes first appear (0 -> N) or when count increases significantly
    // Don't fit view if nodes disappear (N -> 0) as this might be a temporary state issue
    if (reactFlowInstance.current && currentNodeCount > 0) {
      if (previousNodeCountRef.current === 0 || (currentNodeCount > previousNodeCountRef.current && !hasFittedViewRef.current)) {
        previousNodeCountRef.current = currentNodeCount;
        hasFittedViewRef.current = true;
        setTimeout(() => {
          reactFlowInstance.current?.fitView({ padding: 0.2, duration: 500 });
        }, 100);
      }
    } else if (currentNodeCount === 0 && previousNodeCountRef.current > 0) {
      // Nodes disappeared - reset flags but don't fit view
      console.warn('Nodes disappeared from view. Previous count:', previousNodeCountRef.current);
      hasFittedViewRef.current = false;
      previousNodeCountRef.current = 0;
    }
  }, [reactFlowNodes.length]); // Only depend on length, not state changes

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

  // Calculate driver positions for rendering
  const driverPositions = useMemo(() => {
    if (!state?.drivers || !getNode) return [];
    
    return state.drivers.map(driver => {
      const currentNodeId = driver.location;
      const currentNode = getNode(currentNodeId);
      
      if (!currentNode) return null;
      
      // Get node center position
      const getNodeCenter = (node: any) => {
        const nodeWidth = node.measured?.width || node.width || 
          (node.data?.type === 'driver' ? 45 : node.data?.type === 'task' ? 35 : 30);
        const nodeHeight = node.measured?.height || node.height || 
          (node.data?.type === 'driver' ? 45 : node.data?.type === 'task' ? 35 : 30);
        return {
          x: node.position.x + nodeWidth / 2,
          y: node.position.y + nodeHeight / 2
        };
      };
      
      const currentPos = getNodeCenter(currentNode);
      
      // If driver is idle (delay === 0) or has no next_node, show at current node
      if (driver.delay === 0 || !driver.next_node || driver.progress === null || driver.progress === undefined) {
        return {
          driver,
          x: currentPos.x,
          y: currentPos.y
        };
      }
      
      // Driver is moving along an edge
      const nextNode = getNode(driver.next_node);
      if (!nextNode) {
        // Fallback to current node if next node not found
        return {
          driver,
          x: currentPos.x,
          y: currentPos.y
        };
      }
      
      const nextPos = getNodeCenter(nextNode);
      
      // Calculate position along edge based on progress
      // Progress: 0 = at current node, 1 = at next node
      const edgeVectorX = nextPos.x - currentPos.x;
      const edgeVectorY = nextPos.y - currentPos.y;
      
      // Apply progress to edge vector
      const driverX = currentPos.x + edgeVectorX * driver.progress;
      const driverY = currentPos.y + edgeVectorY * driver.progress;
      
      return {
        driver,
        x: driverX,
        y: driverY
      };
    }).filter((pos): pos is { driver: any; x: number; y: number } => pos !== null);
  }, [state?.drivers, getNode, state?.timestep]);

  // Track hover timeout to prevent flickering
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Handlers to track when mouse is over nodes/edges to disable panning
  const handleNodeMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsOverInteractiveElement(true);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    // Small delay to prevent flickering when moving between nodes/edges
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOverInteractiveElement(false);
      hoverTimeoutRef.current = null;
    }, 50);
  }, []);

  const handleEdgeMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsOverInteractiveElement(true);
  }, []);

  const handleEdgeMouseLeave = useCallback(() => {
    // Small delay to prevent flickering when moving between edges/nodes
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOverInteractiveElement(false);
      hoverTimeoutRef.current = null;
    }, 50);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        onMove={onMove}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        onViewportChange={onViewportChange}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onEdgeMouseEnter={handleEdgeMouseEnter}
        onEdgeMouseLeave={handleEdgeMouseLeave}
        panOnDrag={!isOverInteractiveElement}
        panOnScroll={true}
        fitView={false}
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
        {/* Render driver dots as SVG overlay */}
        {driverPositions.length > 0 && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 12,
              overflow: 'visible',
            }}
          >
            <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
              {driverPositions.map(({ driver, x, y }) => (
                <DriverDot key={driver.id} driver={driver} x={x} y={y} />
              ))}
            </g>
          </svg>
        )}
      </ReactFlow>
    </div>
  );
}

export default function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphViewComponentInner {...props} />
    </ReactFlowProvider>
  );
}

