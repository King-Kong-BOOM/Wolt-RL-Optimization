import { useMemo } from 'react';
import { calculateForceDirectedLayout, convertToReactFlowFormat } from '../utils/graphLayout';
import type { GraphNode, GraphEdge } from '../types';

interface UseGraphLayoutOptions {
  width: number;
  height: number;
  iterations?: number;
}

export function useGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: UseGraphLayoutOptions
) {
  const { width, height, iterations = 100 } = options;

  const layoutedNodes = useMemo(() => {
    if (nodes.length === 0) return nodes;
    return calculateForceDirectedLayout(nodes, edges, width, height, iterations);
  }, [nodes, edges, width, height, iterations]);

  const reactFlowData = useMemo(() => {
    return convertToReactFlowFormat(layoutedNodes, edges);
  }, [layoutedNodes, edges]);

  return {
    nodes: layoutedNodes,
    reactFlowNodes: reactFlowData.nodes,
    reactFlowEdges: reactFlowData.edges,
  };
}

