import { TurnLogEntry, Agent } from '../types';

interface Props {
  log: TurnLogEntry[];
  agents: Agent[];
}

const ACTION_ICONS: Record<string, string> = {
  gather: 'G', build: 'B', train: 'T', clone: 'C', move: 'M',
  attack: '!', research: 'R', fortify: 'F',
  propose_peace: 'P', propose_alliance: 'A', break_treaty: 'X',
};

export function TurnLog({ log, agents }: Props) {
  const agentColorMap = new Map(agents.map(a => [a.id, a.color]));
  const recentLog = log.slice(-60).reverse();

  return (
    <div style={{
      background: 'rgba(18,18,35,0.9)',
      borderRadius: 10,
      padding: 12,
      maxHeight: 280,
      overflowY: 'auto',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <h3 style={{
        margin: '0 0 8px', fontSize: 11, color: '#888',
        textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600,
      }}>Events</h3>
      {recentLog.length === 0 && (
        <div style={{ color: '#444', fontSize: 11, fontStyle: 'italic' }}>Awaiting first turn...</div>
      )}
      {recentLog.map((entry, i) => {
        const color = agentColorMap.get(entry.agentId) || '#888';
        const isAttack = entry.action.type === 'attack';
        const isDiplomacy = ['propose_peace', 'propose_alliance', 'break_treaty'].includes(entry.action.type);

        return (
          <div key={i} style={{
            fontSize: 10,
            padding: '3px 0',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            color: entry.success ? '#bbb' : '#ef4444',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 5,
          }}>
            <span style={{ color: '#444', fontSize: 9, minWidth: 22 }}>T{entry.turn}</span>
            <span style={{
              display: 'inline-block', width: 14, height: 14, lineHeight: '14px',
              textAlign: 'center', borderRadius: 3, fontSize: 8, fontWeight: 700,
              background: isAttack ? 'rgba(239,68,68,0.2)'
                : isDiplomacy ? 'rgba(167,139,250,0.2)'
                : 'rgba(255,255,255,0.05)',
              color: isAttack ? '#ef4444' : isDiplomacy ? '#a78bfa' : '#666',
            }}>
              {ACTION_ICONS[entry.action.type] || '?'}
            </span>
            <span style={{ color, fontWeight: 700, fontSize: 10 }}>
              {entry.agentName}
            </span>
            <span style={{ color: '#888', flex: 1 }}>{entry.result}</span>
          </div>
        );
      })}
    </div>
  );
}
