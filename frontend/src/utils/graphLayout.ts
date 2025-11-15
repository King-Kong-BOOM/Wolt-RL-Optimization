import type { GraphNode, GraphEdge } from '../types';

interface Point {
  x: number;
  y: number;
}

interface LineSegment {
  start: Point;
  end: Point;
}

/**
 * Calculate the distance between two points
 */
function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Check if a point is inside a circle (node)
 */
function pointInCircle(point: Point, center: Point, radius: number): boolean {
  return distance(point, center) <= radius;
}

/**
 * Check if a line segment intersects with a circle
 */
function lineCircleIntersection(
  line: LineSegment,
  center: Point,
  radius: number
): boolean {
  // Vector from line start to end
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  
  // Vector from line start to circle center
  const fx = line.start.x - center.x;
  const fy = line.start.y - center.y;
  
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  
  const discriminant = b * b - 4 * a * c;
  
  if (discriminant < 0) {
    return false; // No intersection
  }
  
  const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
  const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
  
  // Check if intersection point is on the line segment
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

/**
 * Check if two line segments intersect
 */
function lineSegmentIntersection(
  line1: LineSegment,
  line2: LineSegment
): boolean {
  const { start: p1, end: p2 } = line1;
  const { start: p3, end: p4 } = line2;
  
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  
  if (denom === 0) {
    return false; // Lines are parallel
  }
  
  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
  
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Calculate force-directed layout with constraints to minimize overlaps
 */
export function calculateForceDirectedLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations: number = 100
): GraphNode[] {
  if (nodes.length === 0) return nodes;
  
  const nodeRadius = 30; // Approximate node radius for collision detection
  const k = Math.sqrt((width * height) / nodes.length); // Optimal distance
  const temperature = Math.min(width, height) / 10;
  let currentTemp = temperature;
  
  // Check if nodes have valid positions from backend
  const hasValidPositions = nodes.length > 0 && nodes.some(node => 
    node.position && (node.position.x !== 0 || node.position.y !== 0)
  );
  
  // If positions are provided from backend, scale them to canvas dimensions
  let positionedNodes: GraphNode[];
  if (hasValidPositions) {
    // Scale positions from backend coordinates (800x600) to actual canvas size
    // Apply spacing factor (1.3x) to spread nodes further apart
    const spacingFactor = 1.3;
    const baseScaleX = width / 800;
    const baseScaleY = height / 600;
    const scaleX = baseScaleX * spacingFactor;
    const scaleY = baseScaleY * spacingFactor;
    
    // Calculate center offset to keep nodes centered after scaling
    // After scaling by spacingFactor, we need to shift back to center
    const centerOffsetX = (width - 800 * scaleX) / 2;
    const centerOffsetY = (height - 600 * scaleY) / 2;
    
    positionedNodes = nodes.map((node) => {
      if (node.position && (node.position.x !== 0 || node.position.y !== 0)) {
        return {
          ...node,
          position: {
            x: node.position.x * scaleX + centerOffsetX,
            y: node.position.y * scaleY + centerOffsetY,
          },
        };
      }
      // Fallback for nodes without positions
      const angle = (2 * Math.PI * parseInt(node.id)) / nodes.length;
      return {
        ...node,
        position: {
          x: width / 2 + (Math.min(width, height) / 3) * Math.cos(angle),
          y: height / 2 + (Math.min(width, height) / 3) * Math.sin(angle),
        },
      };
    });
    
    // Return nodes with scaled positions (skip force-directed layout)
    return positionedNodes;
  }
  
  // Initialize positions if not set (fallback to force-directed layout)
  positionedNodes = nodes.map((node, i) => {
    if (!node.position || (node.position.x === 0 && node.position.y === 0)) {
      // Distribute nodes in a circle initially
      const angle = (2 * Math.PI * i) / nodes.length;
      return {
        ...node,
        position: {
          x: width / 2 + (Math.min(width, height) / 3) * Math.cos(angle),
          y: height / 2 + (Math.min(width, height) / 3) * Math.sin(angle),
        },
      };
    }
    return node;
  });
  
  // Create node map for quick lookup
  const nodeMap = new Map<string, GraphNode>();
  positionedNodes.forEach((node) => {
    nodeMap.set(node.id, node);
  });
  
  // Force-directed layout iterations
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, Point>();
    
    // Initialize forces
    positionedNodes.forEach((node) => {
      forces.set(node.id, { x: 0, y: 0 });
    });
    
    // Repulsion forces between all nodes
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const node1 = positionedNodes[i];
        const node2 = positionedNodes[j];
        const dist = distance(node1.position, node2.position);
        
        if (dist > 0) {
          const force = k * k / dist;
          const dx = (node2.position.x - node1.position.x) / dist;
          const dy = (node2.position.y - node1.position.y) / dist;
          
          const force1 = forces.get(node1.id)!;
          const force2 = forces.get(node2.id)!;
          
          force1.x -= force * dx;
          force1.y -= force * dy;
          force2.x += force * dx;
          force2.y += force * dy;
        }
      }
    }
    
    // Attraction forces along edges
    edges.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      
      if (source && target) {
        const dist = distance(source.position, target.position);
        
        if (dist > 0) {
          const force = dist * dist / k;
          const dx = (target.position.x - source.position.x) / dist;
          const dy = (target.position.y - source.position.y) / dist;
          
          const forceSource = forces.get(source.id)!;
          const forceTarget = forces.get(target.id)!;
          
          forceSource.x += force * dx;
          forceSource.y += force * dy;
          forceTarget.x -= force * dx;
          forceTarget.y -= force * dy;
        }
      }
    });
    
    // Apply forces with temperature (cooling)
    positionedNodes.forEach((node) => {
      const force = forces.get(node.id)!;
      const forceMagnitude = Math.sqrt(force.x * force.x + force.y * force.y);
      
      if (forceMagnitude > 0) {
        const limitedForce = Math.min(forceMagnitude, currentTemp);
        const scale = limitedForce / forceMagnitude;
        
        node.position.x += force.x * scale;
        node.position.y += force.y * scale;
        
        // Keep nodes within bounds
        node.position.x = Math.max(nodeRadius, Math.min(width - nodeRadius, node.position.x));
        node.position.y = Math.max(nodeRadius, Math.min(height - nodeRadius, node.position.y));
      }
    });
    
    // Cool down
    currentTemp *= 0.95;
  }
  
  // Post-processing: minimize edge-vertex intersections
  return minimizeEdgeVertexIntersections(positionedNodes, edges, nodeRadius);
}

/**
 * Adjust node positions to minimize edge-vertex intersections
 */
function minimizeEdgeVertexIntersections(
  nodes: GraphNode[],
  edges: GraphEdge[],
  nodeRadius: number
): GraphNode[] {
  const adjustedNodes = [...nodes];
  const maxAdjustments = 5;
  
  for (let adjustment = 0; adjustment < maxAdjustments; adjustment++) {
    let hasIntersections = false;
    
    edges.forEach((edge) => {
      const source = adjustedNodes.find((n) => n.id === edge.source);
      const target = adjustedNodes.find((n) => n.id === edge.target);
      
      if (!source || !target) return;
      
      const edgeLine: LineSegment = {
        start: source.position,
        end: target.position,
      };
      
      // Check for intersections with other nodes
      adjustedNodes.forEach((node) => {
        if (node.id === edge.source || node.id === edge.target) return;
        
        if (lineCircleIntersection(edgeLine, node.position, nodeRadius * 1.5)) {
          hasIntersections = true;
          
          // Push node away from the edge
          const edgeVec = {
            x: target.position.x - source.position.x,
            y: target.position.y - source.position.y,
          };
          const edgeLen = Math.sqrt(edgeVec.x * edgeVec.x + edgeVec.y * edgeVec.y);
          
          if (edgeLen > 0) {
            const toNode = {
              x: node.position.x - source.position.x,
              y: node.position.y - source.position.y,
            };
            
            // Project node onto edge
            const t = Math.max(0, Math.min(1, (toNode.x * edgeVec.x + toNode.y * edgeVec.y) / (edgeLen * edgeLen)));
            const projection = {
              x: source.position.x + t * edgeVec.x,
              y: source.position.y + t * edgeVec.y,
            };
            
            // Push node perpendicular to edge
            const pushDistance = nodeRadius * 2;
            const perpVec = {
              x: -(edgeVec.y / edgeLen),
              y: edgeVec.x / edgeLen,
            };
            
            const distToEdge = distance(node.position, projection);
            if (distToEdge < nodeRadius * 2) {
              node.position.x += perpVec.x * (pushDistance - distToEdge) * 0.1;
              node.position.y += perpVec.y * (pushDistance - distToEdge) * 0.1;
            }
          }
        }
      });
    });
    
    if (!hasIntersections) break;
  }
  
  return adjustedNodes;
}

/**
 * Convert simulation state to React Flow format
 */
export function convertToReactFlowFormat(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { nodes: any[]; edges: any[] } {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: {
        label: node.data.label || node.id,
        ...node.data,
      },
      type: node.data.type || 'default',
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: edge.data,
      type: 'smoothstep', // Use smoothstep to reduce overlaps
      animated: false,
    })),
  };
}

