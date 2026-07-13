'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState, PlayerAction } from '../lib/types';
import { supabase } from '../lib/supabase';
import {
  advanceToNextRound,
  applyBid,
  applyCardPlay,
  getActivePlayers,
  initGame,
  startNextTrick,
} from '../lib/game';

export type MultiplayerRole = 'host' | 'guest' | 'connecting';

export interface LobbyPlayer {
  id: number;
  name: string;
}

export interface DisconnectedPlayer {
  id: number;
  name: string;
}

interface UseMultiplayerReturn {
  role: MultiplayerRole;
  myPlayerId: number | null;
  lobbyPlayers: LobbyPlayer[];
  gameState: GameState | null;
  isConnected: boolean;
  error: string | null;
  disconnectedPlayer: DisconnectedPlayer | null;
  sendAction: (action: PlayerAction) => void;
  startGame: (totalPlayers: number) => void;
  removeDisconnectedPlayer: () => void;
  disconnect: () => void;
}

export function useMultiplayer(
  roomCode: string,
  playerName: string | null,
  isHost: boolean
): UseMultiplayerReturn {
  const [myPlayerId, setMyPlayerId] = useState<number | null>(isHost ? 0 : null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>(
    isHost && playerName ? [{ id: 0, name: playerName }] : []
  );
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<DisconnectedPlayer | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hostGameRef = useRef<GameState | null>(null);
  const nextPlayerIdRef = useRef(1);
  const clientIdRef = useRef(Math.random().toString(36).slice(2));
  const pendingNextRoundRef = useRef<Set<number>>(new Set());
  const lobbyPlayersRef = useRef<LobbyPlayer[]>(lobbyPlayers);
  const myPlayerIdRef = useRef<number | null>(myPlayerId);
  const disconnectedPlayerRef = useRef<DisconnectedPlayer | null>(null);

  useEffect(() => { lobbyPlayersRef.current = lobbyPlayers; }, [lobbyPlayers]);
  useEffect(() => { myPlayerIdRef.current = myPlayerId; }, [myPlayerId]);
  useEffect(() => { disconnectedPlayerRef.current = disconnectedPlayer; }, [disconnectedPlayer]);

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  }, []);

  const broadcastState = useCallback((gs: GameState) => {
    send('game_state', { state: gs });
  }, [send]);

  const applyHostAction = useCallback((action: PlayerAction, fromPlayerId: number) => {
    let gs = hostGameRef.current;
    if (!gs) return;

    if (action.type === 'bid') {
      gs = applyBid(gs, fromPlayerId, action.value);
    } else if (action.type === 'play') {
      gs = applyCardPlay(gs, fromPlayerId, action.cardId);
      if (gs.phase === 'trick-end') {
        setTimeout(() => {
          if (!hostGameRef.current || hostGameRef.current.phase !== 'trick-end') return;
          const next = startNextTrick(hostGameRef.current);
          hostGameRef.current = next;
          setGameState(next);
          broadcastState(next);
        }, 1600);
      }
    } else if (action.type === 'next_round') {
      pendingNextRoundRef.current.add(fromPlayerId);
      const active = getActivePlayers(gs.players);
      if (pendingNextRoundRef.current.size >= active.length) {
        pendingNextRoundRef.current.clear();
        gs = advanceToNextRound(gs);
      } else {
        return;
      }
    }

    hostGameRef.current = gs;
    setGameState(gs);
    broadcastState(gs);
  }, [broadcastState]);

  useEffect(() => {
    if (!playerName) return;

    const channel = supabase.channel(`fdp-${roomCode}`);
    channelRef.current = channel;
    let retryInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    channel
      // ── Game messages ──────────────────────────────────────────────
      .on('broadcast', { event: 'join' }, ({ payload }) => {
        if (!isHost) return;
        const { clientId, name } = payload as { clientId: string; name: string };

        const dp = disconnectedPlayerRef.current;
        let playerId: number;

        if (dp && dp.name === name) {
          // Player is reconnecting — restore their old ID
          playerId = dp.id;
          disconnectedPlayerRef.current = null;
          setDisconnectedPlayer(null);
          send('player_reconnected', { playerId });
        } else {
          playerId = nextPlayerIdRef.current++;
          const updated = [...lobbyPlayersRef.current, { id: playerId, name }];
          lobbyPlayersRef.current = updated;
          setLobbyPlayers(updated);
          send('lobby', { players: updated });
        }

        send('welcome', { clientId, playerId });
        if (hostGameRef.current) {
          send('game_state', { state: hostGameRef.current });
        }
      })
      .on('broadcast', { event: 'welcome' }, ({ payload }) => {
        if (isHost) return;
        const { clientId, playerId } = payload as { clientId: string; playerId: number };
        if (clientId === clientIdRef.current) {
          myPlayerIdRef.current = playerId;
          setMyPlayerId(playerId);
          if (retryInterval) clearInterval(retryInterval);
          if (timeoutId) clearTimeout(timeoutId);
          // Start tracking presence now that we have our ID
          channel.track({ playerId, name: playerName });
        }
      })
      .on('broadcast', { event: 'lobby' }, ({ payload }) => {
        if (isHost) return;
        setLobbyPlayers((payload as { players: LobbyPlayer[] }).players);
      })
      .on('broadcast', { event: 'game_state' }, ({ payload }) => {
        if (isHost) return;
        setGameState((payload as { state: GameState }).state);
      })
      .on('broadcast', { event: 'action' }, ({ payload }) => {
        if (!isHost) return;
        const { action, fromPlayerId } = payload as { action: PlayerAction; fromPlayerId: number };
        applyHostAction(action, fromPlayerId);
      })
      // ── Disconnect events (broadcast so all players see the pause) ──
      .on('broadcast', { event: 'player_disconnected' }, ({ payload }) => {
        if (isHost) return;
        const { playerId, name } = payload as { playerId: number; name: string };
        setDisconnectedPlayer({ id: playerId, name });
      })
      .on('broadcast', { event: 'player_reconnected' }, () => {
        if (isHost) return;
        setDisconnectedPlayer(null);
      })
      // ── Presence: detect crashes / unexpected disconnects ───────────
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (!isHost) return;
        const gs = hostGameRef.current;
        if (!gs || gs.phase === 'game-end' || gs.phase === 'setup') return;

        for (const p of leftPresences) {
          const { playerId, name } = p as unknown as { playerId: number; name: string };
          if (playerId === 0) continue; // host themselves
          const player = gs.players.find(pl => pl.id === playerId && !pl.eliminated);
          if (player) {
            const dp = { id: playerId, name: player.name ?? name };
            disconnectedPlayerRef.current = dp;
            setDisconnectedPlayer(dp);
            send('player_disconnected', dp);
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);

          if (isHost) {
            channel.track({ playerId: 0, name: playerName });
          } else {
            const sendJoin = () => {
              if (myPlayerIdRef.current !== null) return;
              send('join', { clientId: clientIdRef.current, name: playerName });
            };
            sendJoin();
            retryInterval = setInterval(sendJoin, 2000);
            timeoutId = setTimeout(() => {
              if (retryInterval) clearInterval(retryInterval);
              if (myPlayerIdRef.current === null) {
                setError('Não foi possível entrar na sala. Verifique se o código está correto e o host está online.');
              }
            }, 30000);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Erro de conexão. Verifique sua internet e tente recarregar.');
        }
      });

    return () => {
      if (retryInterval) clearInterval(retryInterval);
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [roomCode, playerName, isHost, send, applyHostAction]);

  const sendAction = useCallback((action: PlayerAction) => {
    if (isHost) {
      applyHostAction(action, 0);
    } else {
      send('action', { action, fromPlayerId: myPlayerIdRef.current ?? 0 });
    }
  }, [isHost, applyHostAction, send]);

  const startGame = useCallback((totalPlayers: number) => {
    if (!isHost) return;
    const realCount = Math.min(lobbyPlayersRef.current.length, totalPlayers);
    const gs = initGame(totalPlayers, realCount);
    const namedGs: GameState = {
      ...gs,
      players: gs.players.map((p) => ({
        ...p,
        name: lobbyPlayersRef.current[p.id]?.name ?? p.name,
      })),
    };
    hostGameRef.current = namedGs;
    setGameState(namedGs);
    broadcastState(namedGs);
  }, [isHost, broadcastState]);

  const removeDisconnectedPlayer = useCallback(() => {
    if (!isHost) return;
    const dp = disconnectedPlayerRef.current;
    if (!dp) return;

    const { id: playerId } = dp;
    let gs = hostGameRef.current;
    if (!gs) return;

    // If game is waiting for the disconnected player, auto-act for them
    if (gs.phase === 'bidding' && gs.currentBidderId === playerId) {
      gs = applyBid(gs, playerId, 0);
    } else if (gs.phase === 'playing' && gs.currentPlayerId === playerId) {
      const player = gs.players.find(p => p.id === playerId);
      if (player?.hand.length) {
        const afterPlay = applyCardPlay(gs, playerId, player.hand[0].id);
        gs = afterPlay;
        if (afterPlay.phase === 'trick-end') {
          setTimeout(() => {
            if (!hostGameRef.current || hostGameRef.current.phase !== 'trick-end') return;
            const next = startNextTrick(hostGameRef.current);
            hostGameRef.current = next;
            setGameState(next);
            broadcastState(next);
          }, 1600);
        }
      }
    }

    // Eliminate the player
    gs = {
      ...gs,
      players: gs.players.map(p =>
        p.id === playerId ? { ...p, eliminated: true, hand: [] } : p
      ),
    };

    // End game if only one player remains
    const remaining = getActivePlayers(gs.players);
    if (remaining.length <= 1) {
      const winner = remaining[0] ?? [...gs.players].sort((a, b) => b.points - a.points)[0] ?? null;
      gs = { ...gs, phase: 'game-end', winner };
    }

    hostGameRef.current = gs;
    setGameState(gs);
    broadcastState(gs);

    disconnectedPlayerRef.current = null;
    setDisconnectedPlayer(null);
    send('player_reconnected', {});
  }, [isHost, broadcastState, send]);

  const disconnect = useCallback(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  }, []);

  return {
    role: isHost ? 'host' : (myPlayerId !== null ? 'guest' : 'connecting'),
    myPlayerId,
    lobbyPlayers,
    gameState,
    isConnected,
    error,
    disconnectedPlayer,
    sendAction,
    startGame,
    removeDisconnectedPlayer,
    disconnect,
  };
}
