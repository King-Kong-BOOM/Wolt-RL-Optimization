import { useState, useEffect } from 'react';
import type { Hyperparameters } from '../../types';

interface HyperparametersFormProps {
  hyperparameters: Hyperparameters;
  onChange: (hyperparameters: Hyperparameters) => void;
  schema?: HyperparameterSchema; // Optional schema for dynamic form generation
}

interface HyperparameterSchema {
  [key: string]: {
    type: 'number' | 'string' | 'boolean' | 'select';
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: { value: string | number; label: string }[];
    default?: any;
  };
}

export default function HyperparametersForm({
  hyperparameters,
  onChange,
  schema,
}: HyperparametersFormProps) {
  const [localParams, setLocalParams] = useState<Hyperparameters>(hyperparameters);

  useEffect(() => {
    setLocalParams(hyperparameters);
  }, [hyperparameters]);

  const handleChange = (key: string, value: any) => {
    const updated = { ...localParams, [key]: value };
    
    // If num_nodes changed, update num_edges minimum
    if (key === 'num_nodes') {
      const numNodes = value as number;
      const minEdges = numNodes - 1;
      const currentEdges = (updated.num_edges as number) || minEdges;
      // Ensure num_edges is at least minEdges
      if (currentEdges < minEdges) {
        updated.num_edges = minEdges;
      }
    }
    
    setLocalParams(updated);
    onChange(updated);
  };

  const renderInput = (key: string, value: any, fieldSchema?: HyperparameterSchema[string]) => {
    const type = fieldSchema?.type || (typeof value === 'number' ? 'number' : typeof value);
    const label = fieldSchema?.label || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    // Calculate minimum edges for num_edges field
    const numNodes = localParams.num_nodes as number;
    const minEdges = numNodes ? numNodes - 1 : 0;

    switch (type) {
      case 'number':
        // Special handling for num_edges to show minimum requirement
        const isNumEdges = key === 'num_edges';
        const effectiveMin = isNumEdges ? minEdges : fieldSchema?.min;
        const helpText = isNumEdges ? ` (min: ${minEdges} for connected graph)` : '';
        
        return (
          <div key={key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#e0e0e0' }}>
              {label}
              {helpText && <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>{helpText}</span>}
            </label>
            <input
              type="number"
              value={value as number}
              onChange={(e) => {
                const newValue = parseFloat(e.target.value) || 0;
                handleChange(key, newValue);
              }}
              min={effectiveMin}
              max={fieldSchema?.max}
              step={fieldSchema?.step || 1}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: isNumEdges && (value as number) < minEdges ? '1px solid #ff6b6b' : '1px solid #444',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                fontSize: '14px',
              }}
            />
            {isNumEdges && (value as number) < minEdges && (
              <div style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '4px' }}>
                Must be at least {minEdges} for a connected graph
              </div>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#e0e0e0' }}>
              <input
                type="checkbox"
                checked={value as boolean}
                onChange={(e) => handleChange(key, e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              {label}
            </label>
          </div>
        );

      case 'select':
        return (
          <div key={key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#e0e0e0' }}>
              {label}
            </label>
            <select
              value={value as string}
              onChange={(e) => handleChange(key, e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                fontSize: '14px',
              }}
            >
              {fieldSchema?.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      default:
        return (
          <div key={key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#e0e0e0' }}>
              {label}
            </label>
            <input
              type="text"
              value={value as string}
              onChange={(e) => handleChange(key, e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                fontSize: '14px',
              }}
            />
          </div>
        );
    }
  };

  // If schema is provided, use it to generate form
  if (schema) {
    return (
      <div style={{ padding: '16px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', color: '#fff' }}>Hyperparameters</h3>
        {Object.entries(schema).map(([key, fieldSchema]) => {
          const value = localParams[key] !== undefined ? localParams[key] : fieldSchema.default;
          return renderInput(key, value, fieldSchema);
        })}
      </div>
    );
  }

  // Otherwise, generate form from current hyperparameters
  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '16px', color: '#fff' }}>Hyperparameters</h3>
      {Object.entries(localParams).map(([key, value]) => renderInput(key, value))}
    </div>
  );
}

