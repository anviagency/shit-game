import { Agent } from '../types';

interface Props {
  agent: Agent;
  territory: number;
  isSelected: boolean;
  onClick: () => void;
  onDetail: () => void;
}

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function AgentPanel({ agent, territory, isSelected, onClick, onDetail }: Props) {
  const dead = !agent.isAlive;

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected
          ? `linear-gradient(135deg, ${hexToRgba(agent.color, 0.15)}, rgba(20,20,40,0.95))`
          : 'rgba(18,18,35,0.85)',
        borderRadius: 8,
        padding: '8px 10px',
        borderLeft: `3px solid ${dead ? '#444' : agent.color}`,
        opacity: dead ? 0.35 : 1,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(4px)',
        border: isSelected ? `1px solid ${hexToRgba(agent.color, 0.3)}` : '1px solid transparent',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Colored dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: agent.color,
            boxShadow: `0 0 6px ${hexToRgba(agent.color, 0.5)}`,
          }} />
          <span style={{ color: agent.color, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
            {agent.name}
          </span>
          <span style={{
            fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.15)',
            padding: '1px 5px', borderRadius: 3, fontWeight: 700,
          }}>LV{agent.level}</span>
          {dead && <span style={{ color: '#ef4444', fontSize: 9, fontWeight: 700 }}>ELIMINATED</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={e => { e.stopPropagation(); onDetail(); }}
            style={{
              background: 'rgba(255,255,255,0.06)', border: 'none', color: '#888',
              borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
              fontSize: 9, fontWeight: 700, transition: 'all 0.15s',
            }}
            title="View details"
          >
            RPG
          </button>
          <span style={{
            fontSize: 8, color: '#666', background: '#1a1a30', padding: '1px 5px',
            borderRadius: 3, textTransform: 'uppercase', letterSpacing: 0.5,
          }}>{agent.provider}</span>
        </div>
      </div>

      {agent.personality && (
        <div style={{
          fontSize: 9, color: '#a78bfa', fontStyle: 'italic', marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          "{agent.personality}"
        </div>
      )}

      <div style={{
        display: 'flex', gap: 6, fontSize: 10, color: '#bbb', marginTop: 5,
        flexWrap: 'wrap',
      }}>
        <Stat label="Territory" value={territory} color="#4ade80" />
        <Stat label="Units" value={agent.totalUnits} color="#60a5fa" />
        <Stat label="Rep" value={agent.reputation} color={agent.reputation > 40 ? '#fbbf24' : '#ef4444'} />
      </div>

      {isSelected && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Resources bar */}
          <div style={{ display: 'flex', gap: 4, fontSize: 9, flexWrap: 'wrap' }}>
            <ResIcon icon="G" value={agent.resources.gold} color="#fbbf24" />
            <ResIcon icon="F" value={agent.resources.food} color="#4ade80" />
            <ResIcon icon="W" value={agent.resources.wood} color="#a16207" />
            <ResIcon icon="I" value={agent.resources.iron} color="#94a3b8" />
            <ResIcon icon="K" value={agent.resources.knowledge} color="#a78bfa" />
          </div>

          {/* Attribute bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', marginTop: 5 }}>
            <AttrBar label="STR" value={agent.attributes.strength} color="#ef4444" />
            <AttrBar label="WIS" value={agent.attributes.wisdom} color="#a78bfa" />
            <AttrBar label="AGI" value={agent.attributes.agility} color="#22d3ee" />
            <AttrBar label="ENG" value={agent.attributes.engineering} color="#fbbf24" />
            <AttrBar label="CHA" value={agent.attributes.charisma} color="#ec4899" />
            <AttrBar label="HP" value={agent.attributes.hp} max={200} color="#4ade80" />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span>
      <span style={{ color: '#666', fontSize: 9 }}>{label} </span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </span>
  );
}

function ResIcon({ icon, value, color }: { icon: string; value: number; color: string }) {
  return (
    <span style={{
      background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '1px 4px',
      display: 'inline-flex', alignItems: 'center', gap: 2,
    }}>
      <span style={{ color, fontWeight: 700, fontSize: 8 }}>{icon}</span>
      <span style={{ color: '#ccc', fontSize: 9 }}>{value}</span>
    </span>
  );
}

function AttrBar({ label, value, color, max = 30 }: { label: string; value: number; color: string; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8 }}>
      <span style={{ color: '#666', width: 22 }}>{label}</span>
      <div style={{
        flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color: '#999', width: 16, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
