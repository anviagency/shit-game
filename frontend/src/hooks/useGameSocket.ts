import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, ThinkingLogs } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function useGameSocket(
  onStateUpdate: (state: GameState) => void,
  onThinkingLogs?: (logs: ThinkingLogs) => void,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to game server');
    });

    socket.on('gameState', (state: GameState) => {
      onStateUpdate(state);
    });

    socket.on('thinkingLogs', (logs: ThinkingLogs) => {
      onThinkingLogs?.(logs);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from game server');
    });

    return () => {
      socket.disconnect();
    };
  }, [onStateUpdate, onThinkingLogs]);

  const startGame = useCallback(() => {
    socketRef.current?.emit('startGame');
  }, []);

  const pauseGame = useCallback(() => {
    socketRef.current?.emit('pauseGame');
  }, []);

  const resumeGame = useCallback(() => {
    socketRef.current?.emit('resumeGame');
  }, []);

  const setSpeed = useCallback((speed: number) => {
    socketRef.current?.emit('setSpeed', speed);
  }, []);

  const restartGame = useCallback(() => {
    socketRef.current?.emit('restartGame');
  }, []);

  return { startGame, pauseGame, resumeGame, setSpeed, restartGame };
}
