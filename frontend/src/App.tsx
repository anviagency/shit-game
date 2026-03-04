import { useCallback, useMemo, useState } from 'react';
import { MapCell } from './types';
import { GameMap } from './components/GameMap';
import { AgentPanel } from './components/AgentPanel';
import { TurnLog } from './components/TurnLog';
import { GameControls } from './components/GameControls';
import { StatsChart } from './components/StatsChart';
import { AgentDetailModal } from './components/AgentDetailModal';
import { CellInspector } from './components/CellInspector';
import { useGameSocket } from './hooks/useGameSocket';
import { useGameState } from './hooks/useGameState';

export default function App() {
  const { gameState, territoryHistory, thinkingLogs, handleStateUpdate, handleThinkingLogs } = useGameState();
  const stableCallback = useCallback(handleStateUpdate, [handleStateUpdate]);
  const stableThinkingCallback = useCallback(handleThinkingLogs, [handleThinkingLogs]);
  const { startGame, pauseGame, resumeGame, setSpeed, restartGame } = useGameSocket(stableCallback, stableThinkingCallback);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [detailAgent, setDetailAgent] = useState<string | null>(null);
  const [inspectedCell, setInspectedCell] = useState<MapCell | null>(null);

  // Pre-compute territory counts to avoid repeated map.flat().filter()
  const territoryCounts = useMemo(() => {
    if (!gameState) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const row of gameState.map) {
      for (const cell of row) {
        if (cell.owner) {
          counts.set(cell.owner, (counts.get(cell.owner) || 0) + 1);
        }
      }
    }
    return counts;
  }, [gameState]);

  const sortedAgents = useMemo(() => {
    if (!gameState) return [];
    return gameState.agents.slice().sort((a, b) => {
      if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
      return (territoryCounts.get(b.id) || 0) - (territoryCounts.get(a.id) || 0);
    });
  }, [gameState, territoryCounts]);

  return (
    <div style={{
      height: '100vh',
      background: 'linear-gradient(180deg, #080818 0%, #0a0a1a 50%, #0c0c20 100%)',
      color: '#e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: 8,
    }}>
      {/* Header */}
      <GameControls
        gameState={gameState}
        onStart={startGame}
        onPause={pauseGame}
        onResume={resumeGame}
        onRestart={restartGame}
        onSetSpeed={setSpeed}
      />

      {/* Main 3-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr 240px',
        gap: 8,
        marginTop: 8,
        flex: 1,
        minHeight: 0,
      }}>
        {/* Left sidebar: Stats + Log */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflowY: 'auto',
          minHeight: 0,
        }}>
          {gameState && territoryHistory.length > 1 && (
            <StatsChart data={territoryHistory} agents={gameState.agents} />
          )}
          {gameState && (
            <TurnLog log={gameState.turnLog} agents={gameState.agents} />
          )}
        </div>

        {/* Center: Map */}
        <div style={{ minHeight: 0, minWidth: 0 }}>
          {gameState ? (
            <GameMap
              map={gameState.map}
              agents={gameState.agents}
              diplomacy={gameState.diplomacy}
              onCellClick={cell => setInspectedCell(cell)}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'radial-gradient(ellipse at center, rgba(30,30,60,0.5) 0%, rgba(10,10,26,0.9) 70%)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 16,
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, color: '#e0e0e0' }}>
                AI World Strategy
              </div>
              <div style={{ color: '#888', fontSize: 14 }}>
                10 AI civilizations. 1 world. No rules.
              </div>
              <div style={{ color: '#555', fontSize: 12, maxWidth: 450, textAlign: 'center', lineHeight: 1.6 }}>
                Resources deplete. Agents develop their own personality. Alliances form and break.
                Some will trade. Some will betray. All will adapt.
              </div>
              <div style={{
                marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
              }}>
                {['Plains', 'Forest', 'Mountains', 'Water', 'Desert', 'Tundra', 'Jungle', 'Swamp'].map(t => (
                  <span key={t} style={{
                    fontSize: 10, color: '#666', background: 'rgba(255,255,255,0.04)',
                    padding: '2px 8px', borderRadius: 4,
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar: Agent Panels */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          overflowY: 'auto', minHeight: 0,
          paddingRight: 4,
        }}>
          {sortedAgents.map(agent => (
            <AgentPanel
              key={agent.id}
              agent={agent}
              territory={territoryCounts.get(agent.id) || 0}
              isSelected={selectedAgent === agent.id}
              onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
              onDetail={() => setDetailAgent(agent.id)}
            />
          ))}
        </div>
      </div>

      {/* Cell Inspector Modal */}
      {inspectedCell && gameState && (
        <CellInspector
          cell={inspectedCell}
          agents={gameState.agents}
          diplomacy={gameState.diplomacy}
          onClose={() => setInspectedCell(null)}
          onAgentClick={(id) => { setInspectedCell(null); setDetailAgent(id); }}
        />
      )}

      {/* Agent Detail Modal */}
      {detailAgent && gameState && (() => {
        const agent = gameState.agents.find(a => a.id === detailAgent);
        if (!agent) return null;
        return (
          <AgentDetailModal
            agent={agent}
            territory={territoryCounts.get(agent.id) || 0}
            thinking={thinkingLogs[agent.id] || []}
            diplomacy={gameState.diplomacy}
            agents={gameState.agents}
            onClose={() => setDetailAgent(null)}
          />
        );
      })()}
    </div>
  );
}
