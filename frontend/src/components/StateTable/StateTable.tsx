import { useMemo, useState, useEffect } from 'react';
import type { SimulationState, DriverState } from '../../types';
import './StateTable.css';

interface StateTableProps {
  state: SimulationState | null;
  selectedDriverId?: string | null;
  onDriverSelect?: (driverId: string | null) => void;
  selectedOrderId?: string | null;
  onOrderSelect?: (orderId: string | null) => void;
}

export default function StateTable({ state, selectedDriverId, onDriverSelect, selectedOrderId, onOrderSelect }: StateTableProps) {
  const [internalSelectedDriverId, setInternalSelectedDriverId] = useState<string | null>(null);
  const [internalSelectedOrderId, setInternalSelectedOrderId] = useState<string | null>(null);
  const [showDriverDetails, setShowDriverDetails] = useState<boolean>(false);
  const [showOrderDetails, setShowOrderDetails] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'drivers' | 'orders'>('drivers');

  // Use prop if provided, otherwise use internal state
  const currentSelectedDriverId = selectedDriverId !== undefined ? selectedDriverId : internalSelectedDriverId;
  const currentSelectedOrderId = selectedOrderId !== undefined ? selectedOrderId : internalSelectedOrderId;

  // Auto-select first driver if none selected and drivers are available
  useEffect(() => {
    if (state?.drivers && state.drivers.length > 0 && !currentSelectedDriverId) {
      const firstDriverId = state.drivers[0].id;
      if (onDriverSelect) {
        onDriverSelect(firstDriverId);
      } else {
        setInternalSelectedDriverId(firstDriverId);
      }
    }
  }, [state?.drivers, currentSelectedDriverId, onDriverSelect]);

  const handleDriverClick = (driverId: string) => {
    if (onDriverSelect) {
      onDriverSelect(driverId);
    } else {
      setInternalSelectedDriverId(driverId);
    }
    setShowDriverDetails(true);
  };

  const handleBackClick = () => {
    if (activeTab === 'drivers') {
      setShowDriverDetails(false);
    } else {
      setShowOrderDetails(false);
    }
  };

  const handleOrderClick = (orderId: string) => {
    if (onOrderSelect) {
      onOrderSelect(orderId);
    } else {
      setInternalSelectedOrderId(orderId);
    }
    setShowOrderDetails(true);
  };

  const selectedDriver = useMemo(() => {
    if (!state?.drivers || !currentSelectedDriverId) return null;
    return state.drivers.find(driver => driver.id === currentSelectedDriverId) || null;
  }, [state?.drivers, currentSelectedDriverId]);

  const selectedOrder = useMemo(() => {
    if (!state?.tasks || !currentSelectedOrderId) return null;
    return state.tasks.find(task => task.id === currentSelectedOrderId) || null;
  }, [state?.tasks, currentSelectedOrderId]);

  if (!state) {
    return (
      <div className="state-table-container">
        <div className="state-table-header">
          <h3>Current State</h3>
          <span className="state-table-timestep">-</span>
        </div>
        <div className="state-table-empty">No simulation data available</div>
      </div>
    );
  }

  return (
    <div className="state-table-container">
      <div className="state-table-header">
        <h3>Current State</h3>
        <span className="state-table-timestep">Timestep: {state.timestep}</span>
      </div>

      <div className="state-table-tabs">
        <button
          className={`state-table-tab ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('drivers');
            setShowDriverDetails(false);
            setShowOrderDetails(false);
          }}
        >
          Drivers
        </button>
        <button
          className={`state-table-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('orders');
            setShowDriverDetails(false);
            setShowOrderDetails(false);
          }}
        >
          Orders
        </button>
      </div>

      {activeTab === 'drivers' && !showDriverDetails && (
        <div className="state-table-driver-list">
          <div className="state-table-driver-list-scrollable">
            {state.drivers && state.drivers.length > 0 ? (
              state.drivers.map((driver) => (
                <div
                  key={driver.id}
                  className={`state-table-driver-item ${currentSelectedDriverId === driver.id ? 'selected' : ''}`}
                  onClick={() => handleDriverClick(driver.id)}
                >
                  <div className="driver-item-id">{driver.id}</div>
                  <div className="driver-item-info">
                    <span className="driver-item-location">Location: {driver.location}</span>
                    <span className="driver-item-status">Status: {driver.status || 'unknown'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="state-table-empty">No drivers available</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'drivers' && showDriverDetails && (
        <div className="state-table-driver-details">
          {selectedDriver ? (
            <div className="driver-details-content">
              <div className="driver-details-header">
                <button className="driver-details-back-button" onClick={handleBackClick} title="Back to driver list">
                  ←
                </button>
                <span>Driver Details</span>
              </div>
              <div className="state-table-wrapper">
                <table className="state-table">
                  <tbody>
                    {Object.entries(selectedDriver).map(([key, value]) => (
                      <tr key={key}>
                        <td className="state-table-key">{key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</td>
                        <td className="state-table-value">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="state-table-empty">Select a driver to view details</div>
          )}
        </div>
      )}

      {activeTab === 'orders' && !showOrderDetails && (
        <div className="state-table-driver-list">
          <div className="state-table-driver-list-scrollable">
            {state.tasks && state.tasks.length > 0 ? (
              state.tasks.map((order) => (
                <div
                  key={order.id}
                  className={`state-table-driver-item ${currentSelectedOrderId === order.id ? 'selected' : ''}`}
                  onClick={() => handleOrderClick(order.id)}
                >
                  <div className="driver-item-id">{order.id}</div>
                  <div className="driver-item-info">
                    <span className="driver-item-location">Status: {order.status || 'unknown'}</span>
                    <span className="driver-item-status">
                      {order.pickup_node && order.dropoff_node 
                        ? `From: ${order.pickup_node} → To: ${order.dropoff_node}`
                        : `Location: ${order.location || 'N/A'}`}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="state-table-empty">No orders available</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'orders' && showOrderDetails && (
        <div className="state-table-driver-details">
          {selectedOrder ? (
            <div className="driver-details-content">
              <div className="driver-details-header">
                <button className="driver-details-back-button" onClick={handleBackClick} title="Back to orders list">
                  ←
                </button>
                <span>Order Details</span>
              </div>
              <div className="state-table-wrapper">
                <table className="state-table">
                  <tbody>
                    {Object.entries(selectedOrder).map(([key, value]) => (
                      <tr key={key}>
                        <td className="state-table-key">{key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</td>
                        <td className="state-table-value">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="state-table-empty">Select an order to view details</div>
          )}
        </div>
      )}
    </div>
  );
}

