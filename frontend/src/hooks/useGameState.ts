import { useState, useCallback, useRef } from 'react';
import { GameState, ThinkingLogs } from '../types';

export interface TerritorySnapshot {
  turn: number;
  [agentId: string]: number;
}

export function useGameState() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [territoryHistory, setTerritoryHistory] = useState<TerritorySnapshot[]>([]);
  const [thinkingLogs, setThinkingLogs] = useState<ThinkingLogs>({});
  const lastTurnRef = useRef(-1);

  const handleStateUpdate = useCallback((state: GameState) => {
    setGameState(state);

    // Track territory over time (deduplicate by turn)
    if (state.turn > lastTurnRef.current) {
      lastTurnRef.current = state.turn;
      const snapshot: TerritorySnapshot = { turn: state.turn };
      for (const agent of state.agents) {
        snapshot[agent.id] = state.map.flat().filter(c => c.owner === agent.id).length;
      }
      setTerritoryHistory(prev => [...prev, snapshot]);
    }
  }, []);

  const handleThinkingLogs = useCallback((logs: ThinkingLogs) => {
    setThinkingLogs(logs);
  }, []);

  return { gameState, territoryHistory, thinkingLogs, handleStateUpdate, handleThinkingLogs };
}
