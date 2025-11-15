import { memo } from 'react';
import type { DriverState } from '../../types';

interface DriverDotProps {
  driver: DriverState;
  x: number;
  y: number;
}

function DriverDotComponent({ driver, x, y }: DriverDotProps) {
  // Small red dot to represent driver position
  const radius = 8;
  const color = '#FF4444'; // Red color for driver
  
  return (
    <circle
      cx={x}
      cy={y}
      r={radius}
      fill={color}
      stroke="#fff"
      strokeWidth="1.5"
      style={{
        pointerEvents: 'none',
        zIndex: 12, // Above edges but below nodes
      }}
    />
  );
}

export default memo(DriverDotComponent);

