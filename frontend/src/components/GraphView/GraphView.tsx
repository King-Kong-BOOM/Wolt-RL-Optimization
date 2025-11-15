import { useCallback, useRef, useEffect, useMemo } from 'react';
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

function GraphViewComponent({ state, width, height, showEdgeWeights = false, showProbabilities = false }: GraphViewProps) {
  const reactFlowInstance = useRef<any>(null);

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

  const reactFlowNodes = useMemo(() => {
    return baseNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        showProbability: showProbabilities,
      },
    }));
  }, [baseNodes, showProbabilities]);

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

