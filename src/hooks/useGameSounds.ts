'use client';
import { useEffect, useRef } from 'react';
import { GameState } from '../lib/types';
import { playSound } from '../lib/sounds';

// Plays sound cues off game-state transitions. Kept out of render so a busy
// board never double-fires a cue.
export function useGameSounds(state: GameState, humanId: number, isMyTurn: boolean) {
  const prevTurn = useRef(false);
  const prevPhase = useRef<GameState['phase']>(state.phase);
  const prevTrickCount = useRef(0);
  const endPlayed = useRef(false);

  useEffect(() => {
    // Your move just came up.
    if (isMyTurn && !prevTurn.current && (state.phase === 'playing' || state.phase === 'bidding')) {
      playSound('turn');
    }
    prevTurn.current = isMyTurn;
  }, [isMyTurn, state.phase]);

  useEffect(() => {
    const trickLen = state.currentTrick.length;

    // A card landed on the felt (count grew within the same trick).
    if (state.phase === 'playing' && trickLen > prevTrickCount.current) {
      playSound('play');
    }
    prevTrickCount.current = trickLen;

    // You took the vaza.
    if (
      state.phase === 'trick-end' &&
      prevPhase.current !== 'trick-end' &&
      state.trickWinnerId === humanId
    ) {
      playSound('trickWin');
    }

    // Match over — win or bust (fires once).
    if (state.phase === 'game-end' && !endPlayed.current) {
      endPlayed.current = true;
      playSound(state.winner?.id === humanId ? 'victory' : 'defeat');
    }
    if (state.phase !== 'game-end') endPlayed.current = false;

    prevPhase.current = state.phase;
  }, [state.phase, state.currentTrick.length, state.trickWinnerId, state.winner, humanId]);
}
