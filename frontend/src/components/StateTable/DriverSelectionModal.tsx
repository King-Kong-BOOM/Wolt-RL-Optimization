import { useState } from 'react';
import type { DriverState } from '../../types';
import './DriverSelectionModal.css';

interface DriverSelectionModalProps {
  drivers: DriverState[];
  onSelect: (driverId: string) => void;
  onCancel: () => void;
  selectedOrderId: string;
}

export default function DriverSelectionModal({ drivers, onSelect, onCancel, selectedOrderId }: DriverSelectionModalProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedDriverId) {
      onSelect(selectedDriverId);
    }
  };

  return (
    <div className="driver-selection-modal-overlay" onClick={onCancel}>
      <div className="driver-selection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="driver-selection-modal-header">
          <h3>Assign Order {selectedOrderId}</h3>
          <button className="driver-selection-modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="driver-selection-modal-content">
          <p className="driver-selection-modal-instruction">Select a driver to assign this order to:</p>
          <div className="driver-selection-list">
            {drivers.length > 0 ? (
              drivers.map((driver) => (
                <div
                  key={driver.id}
                  className={`driver-selection-item ${selectedDriverId === driver.id ? 'selected' : ''}`}
                  onClick={() => setSelectedDriverId(driver.id)}
                >
                  <div className="driver-selection-item-id">{driver.id}</div>
                  <div className="driver-selection-item-info">
                    <span>Location: {driver.location}</span>
                    <span>Status: {driver.status || 'unknown'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="driver-selection-empty">No drivers available</div>
            )}
          </div>
        </div>
        <div className="driver-selection-modal-footer">
          <button className="driver-selection-button cancel" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="driver-selection-button confirm" 
            onClick={handleConfirm}
            disabled={!selectedDriverId}
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

