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
    setLocalParams(updated);
    onChange(updated);
  };

  const renderInput = (key: string, value: any, fieldSchema?: HyperparameterSchema[string]) => {
    const type = fieldSchema?.type || (typeof value === 'number' ? 'number' : typeof value);
    const label = fieldSchema?.label || key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    switch (type) {
      case 'number':
        return (
          <div key={key} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#e0e0e0' }}>
              {label}
            </label>
            <input
              type="number"
              value={value as number}
              onChange={(e) => handleChange(key, parseFloat(e.target.value) || 0)}
              min={fieldSchema?.min}
              max={fieldSchema?.max}
              step={fieldSchema?.step || 1}
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

