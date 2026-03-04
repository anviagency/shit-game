import { MapCell, Agent, DiplomaticRelation } from '../types';

interface Props {
  cell: MapCell;
  agents: Agent[];
  diplomacy: Record<string, DiplomaticRelation>;
  onClose: () => void;
  onAgentClick: (agentId: string) => void;
}

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const TERRAIN_EMOJI: Record<string, string> = {
  plains: '🌾', forest: '🌲', mountains: '⛰', water: '🌊',
  desert: '🏜', tundra: '❄', jungle: '🌴', swamp: '🪷',
};

const TERRAIN_DESC: Record<string, string> = {
  plains: 'Flat, fertile land ideal for farming',
  forest: 'Dense woodland, good for lumber',
  mountains: 'Rocky highlands, rich in iron',
  water: 'Impassable ocean',
  desert: 'Arid wasteland, scarce resources',
  tundra: 'Frozen terrain, harsh conditions',
  jungle: 'Thick tropical vegetation',
  swamp: 'Marshy wetland, difficult terrain',
};

export function CellInspector({ cell, agents, diplomacy, onClose, onAgentClick }: Props) {
  const owner = cell.owner ? agents.find(a => a.id === cell.owner) : null;

  // Find neighbors' owners for border info
  const ownerColor = owner?.color || '#666';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, background: 'linear-gradient(180deg, #14142e 0%, #0a0a1a 100%)',
          borderRadius: 14, overflow: 'hidden',
          border: owner ? `1px solid ${hexToRgba(ownerColor, 0.4)}` : '1px solid rgba(255,255,255,0.08)',
          boxShadow: owner ? `0 0 40px ${hexToRgba(ownerColor, 0.15)}` : '0 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          background: owner ? `linear-gradient(135deg, ${hexToRgba(ownerColor, 0.15)}, transparent)` : 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{TERRAIN_EMOJI[cell.terrain] || '?'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e0e0e0', textTransform: 'capitalize' }}>
                  {cell.terrain}
                </div>
                <div style={{ fontSize: 10, color: '#666' }}>({cell.x}, {cell.y})</div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)', border: 'none', color: '#888',
                width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 700,
              }}
            >×</button>
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
            {TERRAIN_DESC[cell.terrain]}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Richness */}
          <div>
            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Resource Richness
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${cell.richness}%`, height: '100%', borderRadius: 5,
                  background: cell.richness > 60 ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                    : cell.richness > 30 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                    : 'linear-gradient(90deg, #ef4444, #dc2626)',
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{
                fontSize: 13, fontWeight: 800,
                color: cell.richness > 60 ? '#4ade80' : cell.richness > 30 ? '#fbbf24' : '#ef4444',
              }}>{Math.round(cell.richness)}%</span>
            </div>
          </div>

          {/* Owner */}
          <div>
            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Controller
            </div>
            {owner ? (
              <div
                onClick={() => onAgentClick(owner.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  background: hexToRgba(ownerColor, 0.08), borderRadius: 8,
                  border: `1px solid ${hexToRgba(ownerColor, 0.2)}`, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: ownerColor,
                  boxShadow: `0 0 8px ${hexToRgba(ownerColor, 0.5)}`,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: ownerColor, fontSize: 13, fontWeight: 800 }}>{owner.name}</div>
                  <div style={{ fontSize: 9, color: '#888' }}>
                    LV{owner.level} • {owner.provider.toUpperCase()} • Rep: {owner.reputation}
                  </div>
                </div>
                <span style={{ fontSize: 9, color: '#555' }}>click for Intel →</span>
              </div>
            ) : (
              <div style={{
                padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
                borderRadius: 8, color: '#666', fontSize: 12, fontStyle: 'italic',
              }}>
                Unclaimed territory
              </div>
            )}
          </div>

          {/* Building */}
          {cell.building && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Building
              </div>
              <div style={{
                padding: '8px 10px', background: 'rgba(255,255,255,0.04)',
                borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', textTransform: 'capitalize' }}>
                  {cell.building.type}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 10, color: '#888' }}>
                    LV <span style={{ color: '#a78bfa', fontWeight: 700 }}>{cell.building.level}</span>
                  </span>
                  <span style={{ fontSize: 10, color: '#888' }}>
                    HP <span style={{ color: '#4ade80', fontWeight: 700 }}>{cell.building.hp}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Units */}
          {cell.units > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Garrison
              </div>
              <div style={{
                padding: '8px 10px', background: 'rgba(255,255,255,0.04)',
                borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: ownerColor }}>{cell.units}</span>
                <span style={{ fontSize: 11, color: '#888' }}>units stationed</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
