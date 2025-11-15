import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
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
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000/ws';

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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
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
          console.error('Error parsing WebSocket message:', err);
          setError('Failed to parse server message');
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`);
            connectWebSocket();
          }, delay);
        } else {
          setError('Failed to connect to server. Please refresh the page.');
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [state?.timestep, trainingState.isTraining]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
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

