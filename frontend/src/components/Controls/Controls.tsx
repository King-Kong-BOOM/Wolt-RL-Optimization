import { useState } from 'react';
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
  } = useSimulationAPI();

  const [hyperparameters, setHyperparameters] = useState<Hyperparameters>({
    num_nodes: 10,
    num_drivers: 3,
    num_edges: 12,
    task_arrival_rate: 0.5,
  });

  const [trainTimesteps, setTrainTimesteps] = useState<number>(100);

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

      <HyperparametersForm
        hyperparameters={hyperparameters}
        onChange={setHyperparameters}
      />
    </div>
  );
}

