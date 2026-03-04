import { useState } from 'react';
import { Agent, TurnDecision, DiplomaticRelation } from '../types';

interface Props {
  agent: Agent;
  territory: number;
  thinking: TurnDecision[];
  diplomacy: Record<string, DiplomaticRelation>;
  agents: Agent[];
  onClose: () => void;
}

type Tab = 'profile' | 'thinking' | 'memory' | 'diplomacy';

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function AgentDetailModal({ agent, territory, thinking, diplomacy, agents, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('profile');

  const xpForNext = Math.floor(50 * Math.pow(1.4, agent.level - 1));
  const xpPct = Math.min(100, (agent.xp / xpForNext) * 100);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'thinking', label: 'Thinking' },
    { key: 'memory', label: 'Memory' },
    { key: 'diplomacy', label: 'Diplomacy' },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 580, maxHeight: '85vh', overflow: 'hidden',
          background: 'linear-gradient(180deg, #12122a 0%, #0a0a1a 100%)',
          borderRadius: 16,
          border: `1px solid ${hexToRgba(agent.color, 0.3)}`,
          boxShadow: `0 0 60px ${hexToRgba(agent.color, 0.15)}`,
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${hexToRgba(agent.color, 0.15)}`,
          background: `linear-gradient(135deg, ${hexToRgba(agent.color, 0.12)}, transparent)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', background: agent.color,
                boxShadow: `0 0 12px ${hexToRgba(agent.color, 0.6)}`,
              }} />
              <span style={{ color: agent.color, fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>
                {agent.name}
              </span>
              <span style={{
                fontSize: 11, color: '#888', background: 'rgba(255,255,255,0.06)',
                padding: '2px 8px', borderRadius: 4,
              }}>
                LV {agent.level}
              </span>
              {!agent.isAlive && (
                <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>ELIMINATED</span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)', border: 'none', color: '#888',
                width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
          {agent.personality && (
            <div style={{ fontSize: 11, color: '#a78bfa', fontStyle: 'italic', marginTop: 4 }}>
              "{agent.personality}"
            </div>
          )}
          <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>
            {agent.provider.toUpperCase()} • {agent.isAlive ? 'Active' : 'Eliminated'}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                background: tab === t.key ? hexToRgba(agent.color, 0.1) : 'transparent',
                color: tab === t.key ? agent.color : '#666',
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                borderBottom: tab === t.key ? `2px solid ${agent.color}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {tab === 'profile' && (
            <ProfileTab agent={agent} territory={territory} xpPct={xpPct} xpForNext={xpForNext} />
          )}
          {tab === 'thinking' && (
            <ThinkingTab thinking={thinking} color={agent.color} />
          )}
          {tab === 'memory' && (
            <MemoryTab memory={agent.memory} color={agent.color} />
          )}
          {tab === 'diplomacy' && (
            <DiplomacyTab agent={agent} diplomacy={diplomacy} agents={agents} />
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ agent, territory, xpPct, xpForNext }: {
  agent: Agent; territory: number; xpPct: number; xpForNext: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* XP Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', marginBottom: 4 }}>
          <span>Level {agent.level}</span>
          <span>{agent.xp} / {xpForNext} XP</span>
        </div>
        <div style={{
          height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden',
        }}>
          <div style={{
            width: `${xpPct}%`, height: '100%', borderRadius: 4,
            background: `linear-gradient(90deg, ${agent.color}, ${agent.color}88)`,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <StatBox label="Territory" value={territory} icon="🏔" color="#4ade80" />
        <StatBox label="Peak" value={agent.peakTerritory} icon="⬆" color="#22d3ee" />
        <StatBox label="Units" value={agent.totalUnits} icon="⚔" color="#60a5fa" />
        <StatBox label="Kills" value={agent.kills} icon="💀" color="#ef4444" />
        <StatBox label="Won" value={agent.battlesWon} icon="✓" color="#4ade80" />
        <StatBox label="Lost" value={agent.battlesLost} icon="✗" color="#fbbf24" />
        <StatBox label="Treaties" value={agent.treatiesMade} icon="🤝" color="#a78bfa" />
        <StatBox label="Broken" value={agent.treatiesBroken} icon="💔" color="#ef4444" />
        <StatBox label="Rep" value={agent.reputation} icon="★" color={agent.reputation > 40 ? '#fbbf24' : '#ef4444'} />
      </div>

      {/* Attributes */}
      <div>
        <div style={{ fontSize: 10, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          Attributes
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <AttrRow label="STR" value={agent.attributes.strength} color="#ef4444" />
          <AttrRow label="WIS" value={agent.attributes.wisdom} color="#a78bfa" />
          <AttrRow label="AGI" value={agent.attributes.agility} color="#22d3ee" />
          <AttrRow label="ENG" value={agent.attributes.engineering} color="#fbbf24" />
          <AttrRow label="CHA" value={agent.attributes.charisma} color="#ec4899" />
          <AttrRow label="HP" value={agent.attributes.hp} max={300} color="#4ade80" />
        </div>
      </div>

      {/* Resources */}
      <div>
        <div style={{ fontSize: 10, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          Resources
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ResBox icon="G" label="Gold" value={agent.resources.gold} color="#fbbf24" />
          <ResBox icon="F" label="Food" value={agent.resources.food} color="#4ade80" />
          <ResBox icon="W" label="Wood" value={agent.resources.wood} color="#a16207" />
          <ResBox icon="I" label="Iron" value={agent.resources.iron} color="#94a3b8" />
          <ResBox icon="K" label="Knowledge" value={agent.resources.knowledge} color="#a78bfa" />
        </div>
      </div>
    </div>
  );
}

function ThinkingTab({ thinking, color }: { thinking: TurnDecision[]; color: string }) {
  const reversed = [...thinking].reverse();

  if (reversed.length === 0) {
    return (
      <div style={{ color: '#444', fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
        No thinking data yet. Start the game to see agent reasoning.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {reversed.map((t, i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10,
          borderLeft: `3px solid ${hexToRgba(color, 0.4)}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color, fontWeight: 700 }}>Turn {t.turn}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {t.actions.map((a, j) => (
                <span key={j} style={{
                  fontSize: 9, background: 'rgba(255,255,255,0.06)', color: '#bbb',
                  padding: '1px 6px', borderRadius: 3,
                }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5 }}>
            {t.reasoning}
          </div>
          {t.personalityNote && (
            <div style={{ fontSize: 9, color: '#a78bfa', fontStyle: 'italic', marginTop: 4 }}>
              "{t.personalityNote}"
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MemoryTab({ memory, color }: { memory: string[]; color: string }) {
  const reversed = [...memory].reverse();

  if (reversed.length === 0) {
    return (
      <div style={{ color: '#444', fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
        No memories yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {reversed.map((m, i) => (
        <div key={i} style={{
          fontSize: 11, color: '#bbb', padding: '4px 8px',
          background: 'rgba(255,255,255,0.03)', borderRadius: 4,
          borderLeft: `2px solid ${hexToRgba(color, 0.3)}`,
        }}>
          {m}
        </div>
      ))}
    </div>
  );
}

function DiplomacyTab({ agent, diplomacy, agents }: {
  agent: Agent; diplomacy: Record<string, DiplomaticRelation>; agents: Agent[];
}) {
  const relations = agents
    .filter(a => a.id !== agent.id)
    .map(other => {
      const key = [agent.id, other.id].sort().join('-');
      const rel = diplomacy[key];
      return { agent: other, relation: rel };
    })
    .sort((a, b) => {
      const order = { alliance: 0, peace: 1, neutral: 2, war: 3 };
      return (order[a.relation?.type || 'neutral'] || 2) - (order[b.relation?.type || 'neutral'] || 2);
    });

  const relColors: Record<string, string> = {
    alliance: '#a78bfa', peace: '#4ade80', neutral: '#888', war: '#ef4444',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {relations.map(({ agent: other, relation }) => (
        <div key={other.id} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
          background: 'rgba(255,255,255,0.03)', borderRadius: 6,
          opacity: other.isAlive ? 1 : 0.4,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: other.color,
          }} />
          <span style={{ color: other.color, fontSize: 11, fontWeight: 700, flex: 1 }}>
            {other.name}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            color: relColors[relation?.type || 'neutral'],
            background: `${relColors[relation?.type || 'neutral']}15`,
            padding: '2px 8px', borderRadius: 4,
          }}>
            {relation?.type || 'neutral'}
          </span>
          {relation && relation.turnsRemaining > 0 && (
            <span style={{ fontSize: 9, color: '#666' }}>
              {relation.turnsRemaining}t
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// Helper components
function StatBox({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 9, color: '#666' }}>{label}</div>
    </div>
  );
}

function AttrRow({ label, value, color, max = 40 }: { label: string; value: number; color: string; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
      <span style={{ color: '#666', width: 28, fontWeight: 700 }}>{label}</span>
      <div style={{
        flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
        }} />
      </div>
      <span style={{ color: '#bbb', width: 22, textAlign: 'right', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function ResBox({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '4px 10px',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ color, fontWeight: 800, fontSize: 10 }}>{icon}</span>
      <span style={{ color: '#bbb', fontSize: 11, fontWeight: 600 }}>{value}</span>
      <span style={{ color: '#555', fontSize: 9 }}>{label}</span>
    </div>
  );
}

function hexToRgbaLocal(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
