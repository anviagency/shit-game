import { useState } from 'react';
import { Agent, TurnDecision, DiplomaticRelation, SKILL_DEFINITIONS, SkillCategory, EmotionalState } from '../types';

interface Props {
  agent: Agent;
  territory: number;
  thinking: TurnDecision[];
  diplomacy: Record<string, DiplomaticRelation>;
  agents: Agent[];
  onClose: () => void;
}

type Tab = 'profile' | 'dna' | 'skills' | 'thinking' | 'memory' | 'diplomacy';

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function AgentDetailModal({ agent, territory, thinking, diplomacy, agents, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('profile');

  const xpForNext = Math.floor(50 * Math.pow(1.4, agent.level - 1));
  const xpPct = Math.min(100, (agent.xp / xpForNext) * 100);

  const unlockedSkills = agent.skills?.filter(s => s.level > 0).length || 0;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'dna', label: 'DNA' },
    { key: 'skills', label: `Skills (${unlockedSkills})` },
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
          {tab === 'dna' && (
            <DNATab agent={agent} />
          )}
          {tab === 'skills' && (
            <SkillsTab agent={agent} />
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

const EMOTIONAL_STATE_CONFIG: Record<EmotionalState, { label: string; color: string; icon: string }> = {
  confident: { label: 'Confident', color: '#4ade80', icon: '💪' },
  calm: { label: 'Calm', color: '#60a5fa', icon: '😌' },
  cautious: { label: 'Cautious', color: '#fbbf24', icon: '👀' },
  threatened: { label: 'Threatened', color: '#f97316', icon: '😰' },
  desperate: { label: 'Desperate', color: '#ef4444', icon: '🔥' },
};

function DNATab({ agent }: { agent: Agent }) {
  const dna = agent.dna;
  const fear = agent.fear;

  if (!dna) {
    return (
      <div style={{ color: '#666', fontSize: 11, textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>No DNA data available</div>
        <div style={{ color: '#555', fontSize: 10 }}>Restart the server to generate initial DNA for all agents.</div>
      </div>
    );
  }

  const emotionCfg = fear ? EMOTIONAL_STATE_CONFIG[fear.emotionalState] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Emotional State & Fear */}
      {fear && emotionCfg && (
        <div style={{
          background: `linear-gradient(135deg, ${emotionCfg.color}15, transparent)`,
          border: `1px solid ${emotionCfg.color}30`,
          borderRadius: 10, padding: 12,
        }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            State of Mind
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>{emotionCfg.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: emotionCfg.color }}>
              {emotionCfg.label}
            </span>
            <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>
              Fear: <span style={{
                fontWeight: 700,
                color: fear.fearLevel > 60 ? '#ef4444' : fear.fearLevel > 30 ? '#fbbf24' : '#4ade80',
              }}>{Math.round(fear.fearLevel)}/100</span>
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 10 }}>
            <FearStat label="Death Awareness" value={fear.deathAwareness} max={100} color="#ef4444" />
            <FearStat label="Threat Level" value={Math.min(100, fear.threatMultiplier * 25)} max={100} color="#f97316" />
            <FearStat label="Loss Streak" value={fear.lossStreak} max={10} color="#fbbf24" />
            <FearStat label="Starvation" value={fear.starvationTurns} max={10} color="#a16207" />
            <FearStat label="Betrayals" value={fear.betrayalCount} max={5} color="#ec4899" />
          </div>
        </div>
      )}

      {/* Identity */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            Identity
          </span>
          <span style={{ fontSize: 9, color: '#555' }}>v{dna.version}</span>
        </div>
        <div style={{
          fontSize: 12, color: '#e0e0e0', fontStyle: 'italic', lineHeight: 1.5,
          padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8,
          borderLeft: `3px solid ${agent.color}`,
        }}>
          "{dna.identity}"
        </div>
      </div>

      {/* Style */}
      <div>
        <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Ruling Style
        </div>
        <div style={{
          fontSize: 11, color: '#bbb', padding: '6px 10px',
          background: 'rgba(167,139,250,0.08)', borderRadius: 6,
        }}>
          {dna.style}
        </div>
      </div>

      {/* Priorities */}
      <div>
        <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Priorities
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {dna.priorities.map((p, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
              background: i === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
              color: i === 0 ? '#4ade80' : '#bbb',
              border: i === 0 ? '1px solid rgba(74,222,128,0.3)' : '1px solid transparent',
            }}>
              {i + 1}. {p}
            </span>
          ))}
        </div>
      </div>

      {/* Doctrine */}
      <div>
        <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Doctrine
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {dna.doctrine.map((d, i) => (
            <div key={i} style={{
              fontSize: 10, color: '#bbb', padding: '4px 8px',
              background: 'rgba(255,255,255,0.03)', borderRadius: 4,
              borderLeft: '2px solid rgba(96,165,250,0.4)',
            }}>
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Non-Negotiables */}
      {dna.nonNegotiables.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Non-Negotiables
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {dna.nonNegotiables.map((n, i) => (
              <div key={i} style={{
                fontSize: 10, color: '#f87171', padding: '4px 8px',
                background: 'rgba(239,68,68,0.08)', borderRadius: 4,
                borderLeft: '2px solid rgba(239,68,68,0.5)',
              }}>
                {n}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trauma */}
      {dna.trauma.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#f97316', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Defining Moments
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {dna.trauma.map((t, i) => (
              <div key={i} style={{
                fontSize: 10, color: '#fbbf24', padding: '4px 8px',
                background: 'rgba(251,191,36,0.06)', borderRadius: 4,
                borderLeft: '2px solid rgba(251,191,36,0.4)',
                fontStyle: 'italic',
              }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DNA Evolution Log */}
      {agent.dnaLog && agent.dnaLog.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Evolution Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...agent.dnaLog].reverse().map((patch, i) => (
              <div key={i} style={{
                fontSize: 10, padding: '6px 8px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                borderLeft: `2px solid ${agent.color}40`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: agent.color, fontWeight: 700, fontSize: 9 }}>Turn {patch.turn}</span>
                  <span style={{ color: '#666', fontSize: 9, textTransform: 'uppercase' }}>{patch.field}</span>
                </div>
                <div style={{ color: '#999', fontSize: 9, textDecoration: 'line-through', marginBottom: 1 }}>
                  {patch.oldValue}
                </div>
                <div style={{ color: '#ccc', fontSize: 10 }}>
                  {patch.newValue}
                </div>
                <div style={{ color: '#a78bfa', fontSize: 9, fontStyle: 'italic', marginTop: 2 }}>
                  "{patch.reason}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FearStat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: '#666', width: 80, fontSize: 9 }}>{label}</span>
      <div style={{
        flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color: '#888', width: 18, textAlign: 'right', fontSize: 9 }}>{Math.round(value)}</span>
    </div>
  );
}

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  military: '#ef4444',
  economy: '#fbbf24',
  diplomacy: '#a78bfa',
  knowledge: '#22d3ee',
};

const CATEGORY_ICONS: Record<SkillCategory, string> = {
  military: '⚔',
  economy: '💰',
  diplomacy: '🤝',
  knowledge: '📚',
};

function SkillsTab({ agent }: { agent: Agent }) {
  const categories: SkillCategory[] = ['military', 'economy', 'diplomacy', 'knowledge'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Skill points */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px',
      }}>
        <span style={{ fontSize: 11, color: '#888' }}>Available Skill Points</span>
        <span style={{
          fontSize: 16, fontWeight: 800,
          color: (agent.skillPoints || 0) > 0 ? '#fbbf24' : '#444',
        }}>
          {agent.skillPoints || 0}
        </span>
      </div>

      {/* Skill trees by category */}
      {categories.map(cat => {
        const catSkills = SKILL_DEFINITIONS.filter(s => s.category === cat);
        const catColor = CATEGORY_COLORS[cat];

        return (
          <div key={cat}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
              color: catColor,
            }}>
              <span>{CATEGORY_ICONS[cat]}</span>
              <span>{cat}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {catSkills.map(def => {
                const skill = agent.skills?.find(s => s.id === def.id);
                const level = skill?.level || 0;
                const isUnlocked = level > 0;
                const isMaxed = level >= def.maxLevel;
                const hasPrereq = !def.requires || (agent.skills?.find(s => s.id === def.requires)?.level || 0) > 0;

                return (
                  <div key={def.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 6,
                    background: isUnlocked
                      ? `linear-gradient(90deg, ${catColor}15, transparent)`
                      : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isUnlocked ? catColor + '30' : 'rgba(255,255,255,0.04)'}`,
                    opacity: hasPrereq ? 1 : 0.4,
                  }}>
                    {/* Skill level dots */}
                    <div style={{ display: 'flex', gap: 2, minWidth: 30 }}>
                      {Array.from({ length: def.maxLevel }).map((_, i) => (
                        <div key={i} style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: i < level ? catColor : 'rgba(255,255,255,0.08)',
                          boxShadow: i < level ? `0 0 6px ${catColor}60` : 'none',
                        }} />
                      ))}
                    </div>
                    {/* Name + description */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: isUnlocked ? '#eee' : '#666',
                      }}>
                        {def.name}
                        {isMaxed && <span style={{ color: catColor, marginLeft: 4, fontSize: 9 }}>MAX</span>}
                      </div>
                      <div style={{ fontSize: 9, color: isUnlocked ? '#aaa' : '#444' }}>
                        {def.description}
                      </div>
                    </div>
                    {/* Level indicator */}
                    <span style={{
                      fontSize: 10, fontWeight: 700, minWidth: 24, textAlign: 'right',
                      color: isUnlocked ? catColor : '#333',
                    }}>
                      {level}/{def.maxLevel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
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