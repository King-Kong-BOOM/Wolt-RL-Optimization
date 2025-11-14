import { useState, useEffect } from 'react';
import { useSimulationAPI } from '../../hooks/useSimulationAPI';
import RewardChart from './RewardChart';
import './PerformanceCharts.css';

// Historical data storage for charts
export interface HistoricalDataPoint {
  timestep: number;
  cumulative?: number;
  average?: number;
  current?: number;
}

export default function PerformanceCharts() {
  const { state, trainingState } = useSimulationAPI();
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);

  // Update historical data only during simulation (not training)
  useEffect(() => {
    if (state && state.rewards && !trainingState.isTraining) {
      const newPoint: HistoricalDataPoint = {
        timestep: state.timestep,
        cumulative: state.rewards.cumulative,
        average: state.rewards.average,
        current: state.rewards.current,
      };

      setHistoricalData((prev) => {
        // Add or update data point
        const existingIndex = prev.findIndex((d) => d.timestep === state.timestep);

        let updated;
        if (existingIndex >= 0) {
          updated = [...prev];
          updated[existingIndex] = newPoint;
        } else {
          updated = [...prev, newPoint];
        }

        // Keep only last 1000 points to prevent memory issues
        if (updated.length > 1000) {
          return updated.slice(-1000);
        }

        return updated;
      });
    }
  }, [state, trainingState.isTraining]);

  return (
    <div className="performance-charts-container">
      <h3>Performance Metrics</h3>
      
      <div className="charts-grid">
        {/* Reward Charts - Only update during simulation, not training */}
        {state?.rewards?.cumulative !== undefined && (
          <div className="chart-item">
            <RewardChart
              historicalData={historicalData}
              rewardType="cumulative"
              title="Cumulative Reward"
              color="#00A8E8"
            />
          </div>
        )}

        {state?.rewards?.average !== undefined && (
          <div className="chart-item">
            <RewardChart
              historicalData={historicalData}
              rewardType="average"
              title="Average Reward"
              color="#4ECDC4"
            />
          </div>
        )}

        {state?.rewards?.current !== undefined && (
          <div className="chart-item">
            <RewardChart
              historicalData={historicalData}
              rewardType="current"
              title="Current Reward"
              color="#FF6B6B"
            />
          </div>
        )}

        {/* Placeholder for additional charts */}
        {/* Additional performance charts can be added here */}
        {/* Examples: Task Completion Time, Driver Utilization, etc. */}
      </div>

      {trainingState.isTraining && (
        <div className="training-notice">
          Charts paused during training. Updates will resume after training completes.
        </div>
      )}
    </div>
  );
}

