import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Agent } from '../types';
import { TerritorySnapshot } from '../hooks/useGameState';

interface Props {
  data: TerritorySnapshot[];
  agents: Agent[];
}

export function StatsChart({ data, agents }: Props) {
  const sampled = data.length > 100
    ? data.filter((_, i) => i % Math.ceil(data.length / 100) === 0 || i === data.length - 1)
    : data;

  return (
    <div style={{
      background: 'rgba(18,18,35,0.9)',
      borderRadius: 10,
      padding: 14,
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <h3 style={{
        margin: '0 0 10px', fontSize: 11, color: '#888',
        textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600,
      }}>Territory Control</h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={sampled}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="turn" stroke="#444" fontSize={9} />
          <YAxis stroke="#444" fontSize={9} />
          <Tooltip
            contentStyle={{
              background: 'rgba(10,10,26,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 10,
              backdropFilter: 'blur(8px)',
            }}
          />
          {agents.map(agent => (
            <Line
              key={agent.id}
              type="monotone"
              dataKey={agent.id}
              stroke={agent.color}
              dot={false}
              strokeWidth={1.5}
              name={agent.name}
              strokeOpacity={agent.isAlive ? 1 : 0.3}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
