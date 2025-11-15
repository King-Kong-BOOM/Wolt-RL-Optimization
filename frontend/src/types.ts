// Type definitions for the Wolt RL Optimization frontend

export interface GraphNode {
  id: string;
  position: { x: number; y: number };
  data: {
    label?: string;
    type?: 'location' | 'task' | 'driver';
    [key: string]: any; // Allow additional properties
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  data?: {
    label?: string;
    [key: string]: any; // Allow additional properties
  };
}

export interface Hyperparameters {
  [key: string]: string | number | boolean; // Flexible key-value structure
}

export interface SimulationState {
  timestep: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  drivers?: DriverState[];
  tasks?: TaskState[];
  rewards?: RewardState;
  queues?: QueueState[];
  [key: string]: any; // Allow any additional state fields
}

export interface DriverState {
  id: string;
  location: string; // node ID
  status?: string;
  delay?: number;
  next_node?: string | null; // Next node ID if moving, null if idle
  target_node?: string | null; // Final destination node ID if has order
  edge_weight?: number | null; // Weight of current edge being traversed
  progress?: number | null; // Progress ratio (0-1) along current edge
  [key: string]: any; // Allow additional driver properties
}

export interface TaskState {
  id: string;
  status: string;
  location?: string;
  [key: string]: any; // Allow additional task properties
}

export interface RewardState {
  cumulative?: number;
  average?: number;
  current?: number;
  [key: string]: any; // Allow additional reward properties
}

export interface QueueState {
  id: string;
  length: number;
  [key: string]: any; // Allow additional queue properties
}

export interface WebSocketMessage {
  type: 'state_update' | 'training_start' | 'training_end' | 'error';
  data?: SimulationState;
  mode?: 'simulation' | 'training';
  timestep?: number;
  [key: string]: any; // Allow additional message properties
}

export interface APIResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export interface TrainingRequest {
  timesteps: number;
}

export interface CreateSimulationRequest {
  hyperparameters: Hyperparameters;
}

export interface TrainingState {
  isTraining: boolean;
  startTimestep?: number;
  endTimestep?: number;
}

