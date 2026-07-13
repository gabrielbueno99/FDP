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

interface UseMultiplayerReturn {
  role: MultiplayerRole;
  myPlayerId: number | null;
  lobbyPlayers: LobbyPlayer[];
  gameState: GameState | null;
  isConnected: boolean;
  error: string | null;
  sendAction: (action: PlayerAction) => void;
  startGame: (totalPlayers: number) => void;
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

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hostGameRef = useRef<GameState | null>(null);
  const nextPlayerIdRef = useRef(1);
  const clientIdRef = useRef(Math.random().toString(36).slice(2));
  const pendingNextRoundRef = useRef<Set<number>>(new Set());
  const lobbyPlayersRef = useRef<LobbyPlayer[]>(lobbyPlayers);
  const myPlayerIdRef = useRef<number | null>(myPlayerId);

  useEffect(() => { lobbyPlayersRef.current = lobbyPlayers; }, [lobbyPlayers]);
  useEffect(() => { myPlayerIdRef.current = myPlayerId; }, [myPlayerId]);

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
      .on('broadcast', { event: 'join' }, ({ payload }) => {
        if (!isHost) return;
        const { clientId, name } = payload as { clientId: string; name: string };
        const playerId = nextPlayerIdRef.current++;
        const updated = [...lobbyPlayersRef.current, { id: playerId, name }];
        lobbyPlayersRef.current = updated;
        setLobbyPlayers(updated);
        send('welcome', { clientId, playerId });
        send('lobby', { players: updated });
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          if (!isHost) {
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
    sendAction,
    startGame,
    disconnect,
  };
}
