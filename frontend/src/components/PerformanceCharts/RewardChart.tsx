import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { HistoricalDataPoint } from './PerformanceCharts';

interface RewardChartProps {
  historicalData: HistoricalDataPoint[];
  rewardType: 'cumulative' | 'average' | 'current';
  title: string;
  color?: string;
}

interface RewardDataPoint {
  timestep: number;
  value: number;
}

export default function RewardChart({
  historicalData,
  rewardType,
  title,
  color = '#00A8E8',
}: RewardChartProps) {
  const data = useMemo(() => {
    return historicalData
      .map((point) => {
        const value = point[rewardType];
        if (value === undefined || value === null) return null;
        return {
          timestep: point.timestep,
          value: typeof value === 'number' ? value : 0,
        };
      })
      .filter((point): point is RewardDataPoint => point !== null)
      .sort((a, b) => a.timestep - b.timestep);
  }, [historicalData, rewardType]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
      <h4 style={{ color: '#fff', marginBottom: '12px', fontSize: '14px' }}>{title}</h4>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={historicalData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="timestep"
            stroke="#888"
            label={{ value: 'Timestep', position: 'insideBottom', offset: -5, fill: '#888' }}
          />
          <YAxis stroke="#888" />
          <Tooltip
            contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3 }}
            name={title}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

