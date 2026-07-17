'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState } from '../lib/types';
import {
  advanceToNextRound,
  applyBid,
  applyCardPlay,
  getForbiddenBid,
  getActivePlayers,
  initGame,
  isLastBidder,
  lowestAllowedBid,
  startNextTrick,
  TURN_SECONDS,
  weakestCardId,
} from '../lib/game';
import { getAIBid, getAIPlay } from '../lib/ai';

const EMPTY: GameState = {
  phase: 'setup',
  players: [],
  round: 0,
  maxRounds: 0,
  dealerPlayerId: 0,
  currentBidderId: 0,
  currentPlayerId: 0,
  trickLeaderId: 0,
  vira: null,
  manilhaValue: null,
  currentTrick: [],
  roundResults: [],
  trickWinnerId: null,
  winner: null,
};

interface UseGameOptions {
  // When provided, game state is controlled externally (multiplayer guest mode)
  externalState?: GameState;
  // Called when the local player takes an action (multiplayer mode)
  onAction?: (action: { type: 'bid'; value: number } | { type: 'play'; cardId: string } | { type: 'next_round' }) => void;
  // In multiplayer, the local player's ID
  myPlayerId?: number;
  // Disable AI (for multiplayer where all players are human)
  noAI?: boolean;
}

export function useGame(options: UseGameOptions = {}) {
  const { externalState, onAction, myPlayerId, noAI } = options;
  const [internalState, setInternalState] = useState<GameState>(EMPTY);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const state = externalState ?? internalState;
  const setState = useCallback(
    (updater: (prev: GameState) => GameState) => {
      if (!externalState) {
        setInternalState(updater);
      }
    },
    [externalState]
  );

  const startGame = useCallback((playerCount: number, humanCount = 1, roundLimit?: number) => {
    setInternalState(initGame(playerCount, humanCount, roundLimit));
  }, []);

  const humanId = myPlayerId ?? state.players.find((p) => p.isHuman)?.id ?? 0;

  const placeBid = useCallback(
    (bid: number) => {
      if (state.phase !== 'bidding') return;
      if (state.currentBidderId !== humanId) return;

      if (onAction) {
        onAction({ type: 'bid', value: bid });
      } else {
        setState((prev) => applyBid(prev, humanId, bid));
      }
    },
    [state.phase, state.currentBidderId, humanId, onAction, setState]
  );

  const playCard = useCallback(
    (cardId: string) => {
      if (state.phase !== 'playing') return;
      if (state.currentPlayerId !== humanId) return;

      if (onAction) {
        onAction({ type: 'play', cardId });
      } else {
        setState((prev) => applyCardPlay(prev, humanId, cardId));
      }
    },
    [state.phase, state.currentPlayerId, humanId, onAction, setState]
  );

  const nextRound = useCallback(() => {
    if (state.phase !== 'round-end') return;

    if (onAction) {
      onAction({ type: 'next_round' });
    } else {
      setState((prev) => advanceToNextRound(prev));
    }
  }, [state.phase, onAction, setState]);

  const restart = useCallback(() => {
    setInternalState(EMPTY);
  }, []);

  // AI auto-play (only when no external state / not multiplayer)
  useEffect(() => {
    if (externalState || noAI) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    const { phase, players, currentBidderId, currentPlayerId, manilhaValue, round, currentTrick } =
      state;

    if (phase === 'bidding') {
      const bidder = players.find((p) => p.id === currentBidderId);
      if (bidder && !bidder.isHuman && !bidder.eliminated) {
        const active = getActivePlayers(players);
        const existingBids = active
          .filter((p) => p.bid !== null)
          .map((p) => p.bid!);
        const isLast = isLastBidder(state, currentBidderId);
        const bid = getAIBid(bidder.hand, manilhaValue!, existingBids, round, isLast);

        timerRef.current = setTimeout(() => {
          setInternalState((prev) => {
            if (prev.phase !== 'bidding' || prev.currentBidderId !== bidder.id)
              return prev;
            return applyBid(prev, bidder.id, bid);
          });
        }, 700);
      }
    }

    if (phase === 'playing') {
      const player = players.find((p) => p.id === currentPlayerId);
      if (player && !player.isHuman && !player.eliminated) {
        const card = getAIPlay(
          player.hand,
          currentTrick,
          manilhaValue!,
          player.bid ?? 0,
          player.tricksWon
        );

        timerRef.current = setTimeout(() => {
          setInternalState((prev) => {
            if (prev.phase !== 'playing' || prev.currentPlayerId !== player.id)
              return prev;
            return applyCardPlay(prev, player.id, card.id);
          });
        }, 900);
      }
    }

    if (phase === 'trick-end') {
      timerRef.current = setTimeout(() => {
        setInternalState((prev) => {
          if (prev.phase !== 'trick-end') return prev;
          return startNextTrick(prev);
        });
      }, 1600);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.phase, state.currentBidderId, state.currentPlayerId, externalState, noAI]);

  // Solo turn clock: if the human dawdles past TURN_SECONDS, the table plays
  // their weakest card (or lowest legal bid) so the game keeps moving.
  useEffect(() => {
    if (externalState) return; // online is enforced host-side
    const { phase, currentBidderId, currentPlayerId } = state;
    const myBid = phase === 'bidding' && currentBidderId === humanId;
    const myPlay = phase === 'playing' && currentPlayerId === humanId;
    if (!myBid && !myPlay) return;

    const t = setTimeout(() => {
      setInternalState((prev) => {
        if (prev.phase === 'bidding' && prev.currentBidderId === humanId) {
          return applyBid(prev, humanId, lowestAllowedBid(prev, humanId));
        }
        if (prev.phase === 'playing' && prev.currentPlayerId === humanId) {
          const me = prev.players.find((p) => p.id === humanId);
          const cardId = me && weakestCardId(me, prev.manilhaValue);
          if (cardId) return applyCardPlay(prev, humanId, cardId);
        }
        return prev;
      });
    }, TURN_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [state.phase, state.currentBidderId, state.currentPlayerId, humanId, externalState]);

  const forbiddenBid = state.phase === 'bidding' ? getForbiddenBid(state) : null;
  const activePlayers = getActivePlayers(state.players);
  const myPlayer = state.players.find((p) => p.id === humanId);
  const isMyTurn =
    (state.phase === 'bidding' && state.currentBidderId === humanId) ||
    (state.phase === 'playing' && state.currentPlayerId === humanId);

  return {
    state,
    startGame,
    placeBid,
    playCard,
    nextRound,
    restart,
    forbiddenBid,
    activePlayers,
    myPlayer,
    isMyTurn,
    humanId,
  };
}
