import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import type {
  SimulationState,
  WebSocketMessage,
  APIResponse,
  TrainingRequest,
  CreateSimulationRequest,
  TrainingState,
  Hyperparameters,
} from '../types';

// Use relative URLs to leverage Vite proxy, or fall back to direct URL if VITE_API_URL is set
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
// Socket.IO will automatically append /socket.io/ to the base URL
// Use relative URL to leverage Vite proxy, or direct URL as fallback
const WS_URL = import.meta.env.VITE_WS_URL || (import.meta.env.DEV ? '' : 'http://localhost:5000');

interface UseSimulationAPIResult {
  state: SimulationState | null;
  isConnected: boolean;
  isPaused: boolean;
  trainingState: TrainingState;
  error: string | null;
  createSimulation: (hyperparameters: Hyperparameters) => Promise<void>;
  trainAgent: (timesteps: number) => Promise<void>;
  pauseSimulation: () => Promise<void>;
  resumeSimulation: () => Promise<void>;
  clearError: () => void;
  fetchInitialRenderData: () => Promise<void>;
}

export function useSimulationAPI(): UseSimulationAPIResult {
  const [state, setState] = useState<SimulationState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [trainingState, setTrainingState] = useState<TrainingState>({
    isTraining: false,
  });
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connectWebSocket = useCallback(() => {
    try {
      // Disconnect existing socket if any
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Create Socket.IO connection
      const socket = io(WS_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });
      
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Socket.IO connected');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        
        // Request initial state
        socket.emit('request_state');
      });

      socket.on('state_update', (message: WebSocketMessage) => {
        try {
          if (message.type === 'state_update') {
            if (message.mode === 'simulation' && !trainingState.isTraining) {
              // Only update state during simulation, not during training
              if (message.data) {
                setState(message.data);
              }
            }
          } else if (message.type === 'training_start') {
            setTrainingState({
              isTraining: true,
              startTimestep: message.timestep || state?.timestep,
            });
          } else if (message.type === 'training_end') {
            setTrainingState((prev) => ({
              isTraining: false,
              startTimestep: prev.startTimestep,
              endTimestep: message.timestep || state?.timestep,
            }));
            // Resume state updates after training
            if (message.data) {
              setState(message.data);
            }
          } else if (message.type === 'error') {
            setError(message.data?.message || 'An error occurred');
          }
        } catch (err) {
          console.error('Error processing Socket.IO message:', err);
          setError('Failed to process server message');
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket.IO disconnected:', reason);
        setIsConnected(false);
        
        // Only attempt manual reconnection if it wasn't intentional
        if (reason === 'io server disconnect') {
          // Server disconnected, don't reconnect automatically
          setError('Server disconnected. Please refresh the page.');
        } else if (reason === 'io client disconnect') {
          // Client disconnected intentionally, don't reconnect
          socketRef.current = null;
        } else {
          // Connection lost, Socket.IO will attempt to reconnect automatically
          // But we can track it here
          socketRef.current = null;
        }
      });

      socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err);
        setError('Failed to connect to server');
      });
    } catch (err) {
      console.error('Error creating Socket.IO connection:', err);
      setError('Failed to create Socket.IO connection');
    }
  }, [state?.timestep, trainingState.isTraining]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  const fetchInitialRenderData = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get<APIResponse>(
        `${API_BASE_URL}/api/simulation/render-data`
      );

      if (response.data.success && response.data.data) {
        setState(response.data.data as SimulationState);
      } else {
        setError(response.data.message || 'Failed to fetch initial render data');
      }
    } catch (err) {
      console.error('Error fetching initial render data:', err);
      setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch initial render data');
    }
  }, []);

  const createSimulation = useCallback(async (hyperparameters: Hyperparameters) => {
    try {
      setError(null);
      const response = await axios.post<APIResponse>(
        `${API_BASE_URL}/api/simulation/create`,
        { hyperparameters } as CreateSimulationRequest
      );

      if (response.data.success) {
        // Reset state
        setState(null);
        setTrainingState({ isTraining: false });
        // Fetch initial render data
        await fetchInitialRenderData();
        // The new state will come through WebSocket during simulation
      } else {
        setError(response.data.message || 'Failed to create simulation');
      }
    } catch (err) {
      console.error('Error creating simulation:', err);
      setError(axios.isAxiosError(err) ? err.message : 'Failed to create simulation');
    }
  }, [fetchInitialRenderData]);

  const trainAgent = useCallback(async (timesteps: number) => {
    try {
      setError(null);
      setTrainingState({ isTraining: true });
      
      const response = await axios.post<APIResponse>(
        `${API_BASE_URL}/api/simulation/train`,
        { timesteps } as TrainingRequest
      );

      if (!response.data.success) {
        setError(response.data.message || 'Failed to train agent');
        setTrainingState({ isTraining: false });
      }
      // Training end will be signaled via WebSocket
    } catch (err) {
      console.error('Error training agent:', err);
      setError(axios.isAxiosError(err) ? err.message : 'Failed to train agent');
      setTrainingState({ isTraining: false });
    }
  }, []);

  const pauseSimulation = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.post<APIResponse>(
        `${API_BASE_URL}/api/simulation/pause`
      );

      if (response.data.success) {
        setIsPaused(true);
      } else {
        setError(response.data.message || 'Failed to pause simulation');
      }
    } catch (err) {
      console.error('Error pausing simulation:', err);
      setError(axios.isAxiosError(err) ? err.message : 'Failed to pause simulation');
    }
  }, []);

  const resumeSimulation = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.post<APIResponse>(
        `${API_BASE_URL}/api/simulation/resume`
      );

      if (response.data.success) {
        setIsPaused(false);
      } else {
        setError(response.data.message || 'Failed to resume simulation');
      }
    } catch (err) {
      console.error('Error resuming simulation:', err);
      setError(axios.isAxiosError(err) ? err.message : 'Failed to resume simulation');
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch initial render data on mount
  useEffect(() => {
    fetchInitialRenderData();
  }, [fetchInitialRenderData]);

  return {
    state,
    isConnected,
    isPaused,
    trainingState,
    error,
    createSimulation,
    trainAgent,
    pauseSimulation,
    resumeSimulation,
    clearError,
    fetchInitialRenderData,
  };
}

