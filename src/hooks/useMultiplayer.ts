'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState, NetworkMessage, PlayerAction } from '../lib/types';
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

const PEER_PREFIX = 'fdp-room-';

export function useMultiplayer(
  roomCode: string,
  playerName: string
): UseMultiplayerReturn {
  const [role, setRole] = useState<MultiplayerRole>('connecting');
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Host-only state
  const hostGameRef = useRef<GameState | null>(null);
  const connectionsRef = useRef<Map<number, unknown>>(new Map());
  const nextPlayerIdRef = useRef(1); // host is always 0
  const pendingNextRoundRef = useRef<Set<number>>(new Set());

  const peerRef = useRef<unknown>(null);

  const broadcast = useCallback((msg: NetworkMessage) => {
    connectionsRef.current.forEach((conn) => {
      (conn as { send: (data: unknown) => void }).send(msg);
    });
  }, []);

  const broadcastState = useCallback(
    (gs: GameState) => {
      broadcast({ type: 'game_state', state: gs });
    },
    [broadcast]
  );

  const applyHostAction = useCallback(
    (action: PlayerAction, fromPlayerId: number) => {
      let gs = hostGameRef.current;
      if (!gs) return;

      if (action.type === 'bid') {
        gs = applyBid(gs, fromPlayerId, action.value);
      } else if (action.type === 'play') {
        gs = applyCardPlay(gs, fromPlayerId, action.cardId);
        // Auto-advance trick-end after delay
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
          return; // wait for all players
        }
      }

      hostGameRef.current = gs;
      setGameState(gs);
      broadcastState(gs);
    },
    [broadcastState]
  );

  useEffect(() => {
    let destroyed = false;

    const init = async () => {
      const { default: Peer } = await import('peerjs');
      const roomPeerId = `${PEER_PREFIX}${roomCode}`;

      // Try to become host first
      const tryHost = () => {
        const peer = new Peer(roomPeerId);
        peerRef.current = peer;

        peer.on('open', () => {
          if (destroyed) return;
          setRole('host');
          setIsConnected(true);
          setMyPlayerId(0);
          setLobbyPlayers([{ id: 0, name: playerName }]);
        });

        peer.on('connection', (conn) => {
          if (destroyed) return;

          conn.on('open', () => {
            const playerId = nextPlayerIdRef.current++;
            connectionsRef.current.set(playerId, conn);

            conn.send({ type: 'welcome', playerId } satisfies NetworkMessage);

            setLobbyPlayers((prev) => {
              const updated = [...prev, { id: playerId, name: `Jogador ${playerId + 1}` }];
              broadcast({ type: 'lobby', players: updated } satisfies NetworkMessage);
              return updated;
            });

            if (hostGameRef.current) {
              conn.send({ type: 'game_state', state: hostGameRef.current } satisfies NetworkMessage);
            }
          });

          conn.on('data', (raw) => {
            const msg = raw as NetworkMessage;
            if (msg.type === 'join') {
              setLobbyPlayers((prev) => {
                const updated = prev.map((p) => {
                  const [, conn2] = [...connectionsRef.current.entries()].find(
                    ([, c]) => c === conn
                  ) ?? [];
                  return conn2 === conn ? { ...p, name: msg.name } : p;
                });
                broadcast({ type: 'lobby', players: updated } satisfies NetworkMessage);
                return updated;
              });
            }
            if (msg.type === 'action') {
              applyHostAction(msg.action, msg.fromPlayerId);
            }
          });

          conn.on('close', () => {
            connectionsRef.current.delete(
              [...connectionsRef.current.entries()].find(([, c]) => c === conn)?.[0] ?? -1
            );
          });
        });

        peer.on('error', (err) => {
          if (destroyed) return;
          const e = err as { type: string };
          if (e.type === 'unavailable-id') {
            peer.destroy();
            becomeGuest();
          } else {
            setError(`Erro de conexão: ${e.type}`);
          }
        });
      };

      const becomeGuest = () => {
        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', () => {
          if (destroyed) return;
          const conn = peer.connect(roomPeerId, { reliable: true });

          conn.on('open', () => {
            if (destroyed) return;
            setRole('guest');
            setIsConnected(true);
            conn.send({ type: 'join', name: playerName } satisfies NetworkMessage);
          });

          conn.on('data', (raw) => {
            const msg = raw as NetworkMessage;
            if (msg.type === 'welcome') {
              setMyPlayerId(msg.playerId);
            }
            if (msg.type === 'lobby') {
              setLobbyPlayers(msg.players);
            }
            if (msg.type === 'game_state') {
              setGameState(msg.state);
            }
          });

          conn.on('close', () => {
            if (!destroyed) setError('Conexão com a sala perdida.');
          });

          conn.on('error', () => {
            if (!destroyed) setError('Não foi possível conectar à sala.');
          });
        });

        peer.on('error', () => {
          if (!destroyed) setError('Sala não encontrada ou indisponível.');
        });
      };

      tryHost();
    };

    init();

    return () => {
      destroyed = true;
      if (peerRef.current) {
        (peerRef.current as { destroy: () => void }).destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const sendAction = useCallback(
    (action: PlayerAction) => {
      if (role === 'host') {
        applyHostAction(action, 0);
      } else {
        // Find guest connection (single connection to host)
        const peer = peerRef.current as { connections: Record<string, unknown[]> } | null;
        if (!peer) return;
        const conns = Object.values(peer.connections).flat();
        if (conns.length > 0) {
          (conns[0] as { send: (d: unknown) => void }).send({
            type: 'action',
            action,
            fromPlayerId: myPlayerId ?? 0,
          } satisfies NetworkMessage);
        }
      }
    },
    [role, applyHostAction, myPlayerId]
  );

  const startGame = useCallback(
    (totalPlayers: number) => {
      if (role !== 'host') return;

      // Build player list: real connected players + bots for remaining slots
      const realCount = Math.min(lobbyPlayers.length, totalPlayers);

      const gs: GameState = initGame(totalPlayers, realCount);

      // Rename players to match lobby names
      const namedGs: GameState = {
        ...gs,
        players: gs.players.map((p) => ({
          ...p,
          name: lobbyPlayers[p.id]?.name ?? p.name,
        })),
      };

      hostGameRef.current = namedGs;
      setGameState(namedGs);
      broadcastState(namedGs);
    },
    [role, lobbyPlayers, broadcastState]
  );

  const disconnect = useCallback(() => {
    if (peerRef.current) {
      (peerRef.current as { destroy: () => void }).destroy();
    }
  }, []);

  return {
    role,
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
