import { useState, useEffect } from 'react';
import { useSimulationAPI } from '../../hooks/useSimulationAPI';
import type { Hyperparameters } from '../../types';
import HyperparametersForm from './HyperparametersForm';
import './Controls.css';

interface ControlsProps {
  showEdgeWeights?: boolean;
  onToggleEdgeWeights?: (show: boolean) => void;
  showProbabilities?: boolean;
  onToggleProbabilities?: (show: boolean) => void;
}

export default function Controls({ 
  showEdgeWeights = false, 
  onToggleEdgeWeights,
  showProbabilities = false,
  onToggleProbabilities
}: ControlsProps) {
  const {
    createSimulation,
    trainAgent,
    pauseSimulation,
    resumeSimulation,
    isPaused,
    isConnected,
    trainingState,
    error,
    clearError,
    speed,
    setSpeed,
  } = useSimulationAPI();

  const [hyperparameters, setHyperparameters] = useState<Hyperparameters>({
    num_nodes: 10,
    num_drivers: 3,
    num_edges: 12,
    task_arrival_rate: 0.5,
  });

  const [trainTimesteps, setTrainTimesteps] = useState<number>(100);
  const [speedInput, setSpeedInput] = useState<number>(1.0);

  const handleCreateGraph = async () => {
    // Validate that num_edges >= num_nodes - 1 (minimum for connected graph)
    const minEdges = (hyperparameters.num_nodes as number) - 1;
    const currentEdges = (hyperparameters.num_edges as number) || minEdges;
    
    if (currentEdges < minEdges) {
      alert(`Number of edges must be at least ${minEdges} (num_nodes - 1) for a connected graph.`);
      return;
    }
    
    await createSimulation(hyperparameters);
  };

  const handlePauseResume = async () => {
    if (isPaused) {
      await resumeSimulation();
    } else {
      await pauseSimulation();
    }
  };

  const handleTrain = async () => {
    await trainAgent(trainTimesteps);
  };

  // Sync speed input with current speed when it changes
  useEffect(() => {
    setSpeedInput(speed);
  }, [speed]);

  return (
    <div className="controls-container">
      <div className="controls-header">
        <h2>Simulation Controls</h2>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={clearError} className="error-close">×</button>
        </div>
      )}

      <div className="controls-buttons">
        <button
          onClick={handleCreateGraph}
          disabled={trainingState.isTraining}
          className="control-button primary"
        >
          Create New Graph
        </button>

        <button
          onClick={handlePauseResume}
          disabled={!isConnected || trainingState.isTraining}
          className="control-button"
        >
          {isPaused ? '▶ Continue' : '⏸ Pause'}
        </button>

        <button
          onClick={() => onToggleEdgeWeights?.(!showEdgeWeights)}
          className={`control-button ${showEdgeWeights ? 'active' : ''}`}
          title="Toggle edge weight labels"
        >
          {showEdgeWeights ? '✓' : ''} Show Edge Weights
        </button>

        <button
          onClick={() => onToggleProbabilities?.(!showProbabilities)}
          className={`control-button ${showProbabilities ? 'active' : ''}`}
          title="Toggle node probability display"
        >
          {showProbabilities ? '✓' : ''} Show Probabilities
        </button>

        <div className="train-section">
          <input
            type="number"
            value={trainTimesteps}
            onChange={(e) => setTrainTimesteps(parseInt(e.target.value) || 100)}
            min={1}
            max={10000}
            disabled={trainingState.isTraining}
            className="train-input"
          />
          <button
            onClick={handleTrain}
            disabled={!isConnected || trainingState.isTraining}
            className="control-button"
          >
            {trainingState.isTraining ? 'Training...' : 'Train for T timesteps'}
          </button>
        </div>
      </div>

      {trainingState.isTraining && (
        <div className="training-indicator">
          Training in progress... (Timesteps: {trainingState.startTimestep || 'N/A'})
        </div>
      )}

      <div className="speed-control-section">
        <label htmlFor="speed-input">Simulation Speed (timesteps/sec):</label>
        <div className="speed-control">
          <input
            id="speed-input"
            type="number"
            value={speedInput}
            onChange={(e) => setSpeedInput(parseFloat(e.target.value) || 1.0)}
            min={0.1}
            max={10}
            step={0.1}
            disabled={trainingState.isTraining}
            className="speed-input"
          />
          <button
            onClick={() => setSpeed(speedInput)}
            disabled={!isConnected || trainingState.isTraining}
            className="control-button"
          >
            Set Speed
          </button>
        </div>
        <div className="speed-display">
          Current: {speed.toFixed(1)} timesteps/sec
        </div>
      </div>

      <HyperparametersForm
        hyperparameters={hyperparameters}
        onChange={setHyperparameters}
      />
    </div>
  );
}

