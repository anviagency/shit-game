import { useState } from 'react';
import { GameState } from '../types';

interface Props {
  gameState: GameState | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onSetSpeed: (ms: number) => void;
}

const SPEEDS = [
  { label: '0.5x', ms: 4000 },
  { label: '1x', ms: 2000 },
  { label: '2x', ms: 1000 },
  { label: '5x', ms: 400 },
  { label: '10x', ms: 200 },
  { label: '20x', ms: 100 },
];

export function GameControls({ gameState, onStart, onPause, onResume, onRestart, onSetSpeed }: Props) {
  const phase = gameState?.phase || 'waiting';
  const alive = gameState?.agents.filter(a => a.isAlive).length || 0;
  const [activeSpeed, setActiveSpeed] = useState('1x');

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(18,18,38,0.95), rgba(12,12,28,0.98))',
      borderRadius: 12,
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
      border: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Title / Turn */}
      <div>
        {gameState ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0', letterSpacing: -0.5 }}>
              Turn {gameState.turn}
            </span>
            <span style={{ fontSize: 11, color: '#666' }}>/ {gameState.maxTurns}</span>
            <span style={{
              fontSize: 10, color: alive > 5 ? '#4ade80' : alive > 2 ? '#fbbf24' : '#ef4444',
              background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 10,
            }}>
              {alive} alive
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 16, fontWeight: 800, color: '#e0e0e0', letterSpacing: -0.5 }}>
            AI World Strategy
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        {phase === 'waiting' && (
          <ActionBtn onClick={onStart} color="#22c55e" label="Start Game" />
        )}
        {phase === 'running' && (
          <ActionBtn onClick={onPause} color="#eab308" label="Pause" />
        )}
        {phase === 'paused' && (
          <>
            <ActionBtn onClick={onResume} color="#22c55e" label="Resume" />
            <ActionBtn onClick={onRestart} color="#3b82f6" label="Restart" />
          </>
        )}
        {phase === 'finished' && (
          <ActionBtn onClick={onRestart} color="#3b82f6" label="New Game" />
        )}
      </div>

      {/* Speed selector */}
      <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', alignItems: 'center' }}>
        <span style={{ color: '#555', fontSize: 10, marginRight: 4 }}>SPEED</span>
        {SPEEDS.map(s => (
          <button
            key={s.label}
            onClick={() => { onSetSpeed(s.ms); setActiveSpeed(s.label); }}
            style={{
              background: activeSpeed === s.label ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)',
              color: activeSpeed === s.label ? '#818cf8' : '#666',
              border: activeSpeed === s.label ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
              borderRadius: 5,
              padding: '3px 7px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 10,
              transition: 'all 0.15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Winner announcement */}
      {gameState?.gameOver && gameState.winner && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
          border: '1px solid rgba(34,197,94,0.4)',
          borderRadius: 8,
          padding: '6px 16px',
          fontSize: 13,
          fontWeight: 800,
          color: '#4ade80',
          letterSpacing: 0.5,
        }}>
          {gameState.agents.find(a => a.id === gameState.winner)?.name || gameState.winner} WINS
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, color, label }: { onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '7px 18px',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 0.3,
        boxShadow: `0 2px 12px ${color}44`,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}
