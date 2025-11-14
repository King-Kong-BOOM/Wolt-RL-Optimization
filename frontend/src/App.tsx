import { useState, useEffect } from 'react';
import { useSimulationAPI } from './hooks/useSimulationAPI';
import GraphView from './components/GraphView/GraphView';
import Controls from './components/Controls/Controls';
import StateTable from './components/StateTable/StateTable';
import PerformanceCharts from './components/PerformanceCharts/PerformanceCharts';
import './App.css';

function App() {
  const { state } = useSimulationAPI();
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    // Calculate graph dimensions based on viewport
    const updateDimensions = () => {
      const controlsWidth = 300; // Approximate width of controls panel
      const metricsWidth = 350; // Approximate width of metrics panel
      const padding = 40;
      const width = window.innerWidth - controlsWidth - metricsWidth - padding;
      const height = window.innerHeight - 100; // Account for some padding
      setGraphDimensions({ width: Math.max(400, width), height: Math.max(300, height) });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Wolt RL Optimization Dashboard</h1>
      </header>
      
      <div className="app-content">
        {/* Left Panel: Controls */}
        <aside className="controls-panel">
          <Controls />
        </aside>

        {/* Center Panel: Graph Visualization */}
        <main className="graph-panel">
          <GraphView
            state={state}
            width={graphDimensions.width}
            height={graphDimensions.height}
          />
        </main>

        {/* Right Panel: State Table and Performance Charts */}
        <aside className="metrics-panel">
          <div className="metrics-content">
            <div className="state-section">
              <StateTable state={state} />
            </div>
            <div className="charts-section">
              <PerformanceCharts />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;

