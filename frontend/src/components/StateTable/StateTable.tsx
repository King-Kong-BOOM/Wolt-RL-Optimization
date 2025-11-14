import { useMemo } from 'react';
import type { SimulationState } from '../../types';
import './StateTable.css';

interface StateTableProps {
  state: SimulationState | null;
}

export default function StateTable({ state }: StateTableProps) {
  const tableData = useMemo(() => {
    if (!state) return null;

    // Extract all state fields that can be displayed in a table
    const data: Record<string, any> = {};

    // Add timestep
    data['Timestep'] = state.timestep;

    // Add drivers if present
    if (state.drivers && Array.isArray(state.drivers)) {
      state.drivers.forEach((driver, index) => {
        Object.entries(driver).forEach(([key, value]) => {
          const displayKey = `Driver ${index + 1} - ${key.replace(/_/g, ' ')}`;
          data[displayKey] = typeof value === 'object' ? JSON.stringify(value) : value;
        });
      });
    }

    // Add tasks if present
    if (state.tasks && Array.isArray(state.tasks)) {
      state.tasks.forEach((task, index) => {
        Object.entries(task).forEach(([key, value]) => {
          const displayKey = `Task ${index + 1} - ${key.replace(/_/g, ' ')}`;
          data[displayKey] = typeof value === 'object' ? JSON.stringify(value) : value;
        });
      });
    }

    // Add rewards if present
    if (state.rewards) {
      Object.entries(state.rewards).forEach(([key, value]) => {
        const displayKey = `Reward - ${key.replace(/_/g, ' ')}`;
        data[displayKey] = typeof value === 'object' ? JSON.stringify(value) : value;
      });
    }

    // Add queues if present
    if (state.queues && Array.isArray(state.queues)) {
      state.queues.forEach((queue, index) => {
        Object.entries(queue).forEach(([key, value]) => {
          const displayKey = `Queue ${index + 1} - ${key.replace(/_/g, ' ')}`;
          data[displayKey] = typeof value === 'object' ? JSON.stringify(value) : value;
        });
      });
    }

    // Add any other top-level state fields
    Object.entries(state).forEach(([key, value]) => {
      if (
        !['timestep', 'nodes', 'edges', 'drivers', 'tasks', 'rewards', 'queues'].includes(key) &&
        typeof value !== 'object'
      ) {
        const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        data[displayKey] = value;
      }
    });

    return data;
  }, [state]);

  if (!state || !tableData) {
    return (
      <div className="state-table-container">
        <h3>Current State</h3>
        <div className="state-table-empty">No simulation data available</div>
      </div>
    );
  }

  return (
    <div className="state-table-container">
      <h3>Current State</h3>
      <div className="state-table-wrapper">
        <table className="state-table">
          <tbody>
            {Object.entries(tableData).map(([key, value]) => (
              <tr key={key}>
                <td className="state-table-key">{key}</td>
                <td className="state-table-value">{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

