'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, ChatMessage, GameState, PlayerAction } from '../lib/types';
import { supabase } from '../lib/supabase';
import {
  advanceToNextRound,
  applyBid,
  applyCardPlay,
  dealRound,
  getActivePlayers,
  initGame,
  isLastBidder,
  lowestAllowedBid,
  normalizeTurn,
  seatNewcomers,
  startNextTrick,
  TURN_SECONDS,
  weakestCardId,
} from '../lib/game';
import { getAIBid, getAIPlay } from '../lib/ai';

export type MultiplayerRole = 'host' | 'guest' | 'connecting';

export interface LobbyPlayer {
  id: number;
  name: string;
}

export interface DisconnectedPlayer {
  id: number;
  name: string;
}

/** Someone knocking on a game already in progress, waiting on the host. */
export interface PendingJoin {
  clientId: string;
  name: string;
}

interface UseMultiplayerReturn {
  role: MultiplayerRole;
  myPlayerId: number | null;
  lobbyPlayers: LobbyPlayer[];
  gameState: GameState | null;
  isConnected: boolean;
  error: string | null;
  wasKicked: boolean;
  disconnectedPlayer: DisconnectedPlayer | null;
  chatMessages: ChatMessage[];
  /** Host: people asking to join a game already running. */
  pendingJoins: PendingJoin[];
  /** Guest: host hasn't decided on my entry yet. */
  awaitingApproval: boolean;
  /** Guest: host said no. */
  joinRejected: boolean;
  /** Guest: approved, but only deals in from the next round. */
  seatedNextRound: boolean;
  /** Whether *this* client is currently running the table (can change mid-game). */
  isHost: boolean;
  /** Player id of the current host, so everyone agrees who is in charge. */
  hostId: number;
  /** Set when this client was promoted to host after the old one dropped. */
  becameHost: boolean;
  sendAction: (action: PlayerAction) => void;
  sendChat: (text: string) => void;
  startGame: (roundLimit?: number) => void;
  removeDisconnectedPlayer: () => void;
  kickPlayer: (playerId: number) => void;
  approveJoin: (clientId: string) => void;
  rejectJoin: (clientId: string) => void;
  leaveLobby: () => void;
  disconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
// Presence flaps on flaky mobile connections; only pause the game if the
// player stays gone for this long.
const DISCONNECT_GRACE_MS = 5000;

// Placeholder card used when hiding a hand from a client. Real ids encode the
// card (e.g. "A-clubs"), so redacted cards must carry opaque ids too.
function hiddenCard(id: string): Card {
  return { id, suit: 'spades', value: '4' };
}

// The host holds the full game state; each guest only receives what they are
// allowed to see. Round 1 is blind (you see everyone's card except your own),
// so the target's own hand is stripped in round 1 — with `blind-{index}` ids
// preserved so playing a face-down card still works. From round 2 on, other
// players' hands are stripped instead.
function redactStateFor(gs: GameState, targetId: number): GameState {
  return {
    ...gs,
    players: gs.players.map((p) => {
      if (p.id === targetId) {
        if (gs.round === 1) {
          return { ...p, hand: p.hand.map((_, i) => hiddenCard(`blind-${i}`)) };
        }
        return p;
      }
      if (gs.round === 1) return p;
      return { ...p, hand: p.hand.map((_, i) => hiddenCard(`hidden-${p.id}-${i}`)) };
    }),
  };
}

export function useMultiplayer(
  roomCode: string,
  playerName: string | null,
  initialIsHost: boolean
): UseMultiplayerReturn {
  // Who runs the table can change mid-game: if the host walks out, the next
  // player by join order takes over. Handlers read the refs so a promotion
  // never has to tear the channel down and rebuild it.
  const [isHost, setIsHost] = useState(initialIsHost);
  const isHostRef = useRef(initialIsHost);
  const [hostId, setHostId] = useState(0);
  const hostIdRef = useRef(0);
  const [becameHost, setBecameHost] = useState(false);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { hostIdRef.current = hostId; }, [hostId]);

  const pidKey = `fdp-pid-${roomCode}`;
  const hostStateKey = `fdp-host-state-${roomCode}`;
  const hostLobbyKey = `fdp-host-lobby-${roomCode}`;

  // Guests remember their seat across reloads, so refreshing the page
  // rejoins the same game instead of creating a new player.
  const [myPlayerId, setMyPlayerId] = useState<number | null>(() => {
    if (isHost) return 0;
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(pidKey);
      if (saved !== null && !Number.isNaN(Number(saved))) return Number(saved);
    }
    return null;
  });

  // The host restores a game in progress after a page reload, so an F5 (or a
  // crashed tab reopened) doesn't kill the table for everyone.
  const [restoredHost] = useState(() => {
    const empty = { game: null as GameState | null, lobby: null as LobbyPlayer[] | null, nextPlayerId: 1 };
    if (!isHost || typeof window === 'undefined') return empty;
    try {
      const savedGame = sessionStorage.getItem(hostStateKey);
      const savedLobby = sessionStorage.getItem(hostLobbyKey);
      const meta = savedLobby
        ? (JSON.parse(savedLobby) as { lobby: LobbyPlayer[]; nextPlayerId: number })
        : null;
      return {
        game: savedGame ? (JSON.parse(savedGame) as GameState) : null,
        lobby: meta?.lobby ?? null,
        nextPlayerId: meta?.nextPlayerId ?? 1,
      };
    } catch {
      return empty;
    }
  });

  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>(
    restoredHost.lobby ?? (isHost && playerName ? [{ id: 0, name: playerName }] : [])
  );
  const [gameState, setGameState] = useState<GameState | null>(restoredHost.game);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasKicked, setWasKicked] = useState(false);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<DisconnectedPlayer | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingJoins, setPendingJoins] = useState<PendingJoin[]>([]);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [joinRejected, setJoinRejected] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hostGameRef = useRef<GameState | null>(restoredHost.game);
  const nextPlayerIdRef = useRef(restoredHost.nextPlayerId);
  const [clientId] = useState(() => Math.random().toString(36).slice(2));
  const clientIdRef = useRef(clientId);
  const pendingNextRoundRef = useRef<Set<number>>(new Set());
  const lobbyPlayersRef = useRef<LobbyPlayer[]>(lobbyPlayers);
  const myPlayerIdRef = useRef<number | null>(myPlayerId);
  const disconnectedPlayerRef = useRef<DisconnectedPlayer | null>(null);
  const isConnectedRef = useRef(false);

  // Track clientId → playerId so duplicate `join` retries don't create new players
  const clientPlayerMapRef = useRef<Map<string, number>>(new Map());
  // Sequence counter so out-of-order lobby broadcasts don't overwrite newer state
  const lobbySeqRef = useRef(0);
  const lastLobbySeqRef = useRef(0);

  // Heartbeat interval keeps the channel alive and lets reconnecting guests recover
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Bot turn timer (host only)
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleBotRef = useRef<(gs: GameState) => void>(() => {});
  // Grace timers before a presence-leave counts as a real disconnect
  const disconnectTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Host: pending entries + seats approved but not dealt in yet
  const pendingJoinsRef = useRef<PendingJoin[]>([]);
  const pendingSeatsRef = useRef<{ id: number; name: string }[]>([]);
  // Guest: don't time out the join while the host is still deciding
  const awaitingApprovalRef = useRef(false);
  // Host migration: latest state we saw (guests only ever hold a redacted one)
  const gameStateRef = useRef<GameState | null>(restoredHost.game);
  const maybePromoteSelfRef = useRef<(goneHostId: number) => void>(() => {});
  const promotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  useEffect(() => { pendingJoinsRef.current = pendingJoins; }, [pendingJoins]);
  useEffect(() => { awaitingApprovalRef.current = awaitingApproval; }, [awaitingApproval]);

  useEffect(() => { lobbyPlayersRef.current = lobbyPlayers; }, [lobbyPlayers]);
  useEffect(() => { myPlayerIdRef.current = myPlayerId; }, [myPlayerId]);
  useEffect(() => { disconnectedPlayerRef.current = disconnectedPlayer; }, [disconnectedPlayer]);
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  }, []);

  // Host → guests: one redacted copy of the state per guest, never the full state.
  const broadcastState = useCallback((gs: GameState) => {
    for (const lp of lobbyPlayersRef.current) {
      if (lp.id === hostIdRef.current) continue;
      send('game_state', { state: redactStateFor(gs, lp.id), target: lp.id });
    }
  }, [send]);

  // Sends the full lobby with the current sequence number
  const broadcastLobby = useCallback((players: LobbyPlayer[]) => {
    send('lobby', { players, seq: lobbySeqRef.current });
  }, [send]);

  const persistHostLobby = useCallback(() => {
    try {
      sessionStorage.setItem(hostLobbyKey, JSON.stringify({
        lobby: lobbyPlayersRef.current,
        nextPlayerId: nextPlayerIdRef.current,
      }));
    } catch { /* storage full/unavailable — persistence is best-effort */ }
  }, [hostLobbyKey]);

  // Commit a new authoritative state on the host: store, render, broadcast,
  // persist (so the host surviving a reload doesn't kill the game), and let
  // bots take their turn if it's one.
  const commitHostState = useCallback((gs: GameState) => {
    hostGameRef.current = gs;
    setGameState(gs);
    broadcastState(gs);
    try {
      if (gs.phase === 'game-end') {
        sessionStorage.removeItem(hostStateKey);
      } else {
        sessionStorage.setItem(hostStateKey, JSON.stringify(gs));
      }
    } catch { /* best-effort */ }
    scheduleBotRef.current(gs);
  }, [broadcastState, hostStateKey]);

  const clearDisconnected = useCallback((playerId?: number) => {
    const dp = disconnectedPlayerRef.current;
    if (dp && (playerId === undefined || dp.id === playerId)) {
      disconnectedPlayerRef.current = null;
      setDisconnectedPlayer(null);
      if (isHost) send('player_reconnected', { playerId: dp.id });
    }
  }, [isHost, send]);

  const cancelDisconnectTimer = useCallback((playerId: number) => {
    const t = disconnectTimersRef.current.get(playerId);
    if (t) {
      clearTimeout(t);
      disconnectTimersRef.current.delete(playerId);
    }
  }, []);

  const applyHostAction = useCallback((action: PlayerAction, fromPlayerId: number) => {
    let gs = hostGameRef.current;
    if (!gs) return;

    if (action.type === 'bid') {
      if (gs.phase !== 'bidding' || gs.currentBidderId !== fromPlayerId) return;
      if (!Number.isInteger(action.value) || action.value < 0 || action.value > gs.round) return;
      gs = applyBid(gs, fromPlayerId, action.value);
    } else if (action.type === 'play') {
      if (gs.phase !== 'playing' || gs.currentPlayerId !== fromPlayerId) return;
      let cardId = action.cardId;
      // Round-1 blind plays arrive with opaque ids — map back to the real card
      if (cardId.startsWith('blind-')) {
        const player = gs.players.find((p) => p.id === fromPlayerId);
        const idx = Number(cardId.slice('blind-'.length));
        const real = player?.hand[idx];
        if (!real) return;
        cardId = real.id;
      }
      const player = gs.players.find((p) => p.id === fromPlayerId);
      if (!player?.hand.some((c) => c.id === cardId)) return;
      gs = applyCardPlay(gs, fromPlayerId, cardId);
      if (gs.phase === 'trick-end') {
        setTimeout(() => {
          if (!hostGameRef.current || hostGameRef.current.phase !== 'trick-end') return;
          commitHostState(startNextTrick(hostGameRef.current));
        }, 1600);
      }
    } else if (action.type === 'next_round') {
      pendingNextRoundRef.current.add(fromPlayerId);
      // Only humans confirm — bots would leave the game stuck forever
      const activeHumans = getActivePlayers(gs.players).filter((p) => p.isHuman);
      if (pendingNextRoundRef.current.size >= activeHumans.length) {
        pendingNextRoundRef.current.clear();
        // Latecomers the host approved only ever get dealt in here, between rounds.
        if (pendingSeatsRef.current.length) {
          gs = seatNewcomers(gs, pendingSeatsRef.current);
          pendingSeatsRef.current = [];
        }
        gs = advanceToNextRound(gs);
      } else {
        return;
      }
    }

    commitHostState(gs);
  }, [commitHostState]);

  // Host clock: bots act after a short delay; human players get the full
  // TURN_SECONDS before the table plays their weakest card / lowest bid, so an
  // AFK or dropped player never freezes the game.
  const scheduleBot = useCallback((gs: GameState) => {
    if (!isHost) return;
    if (botTimerRef.current) clearTimeout(botTimerRef.current);

    if (gs.phase === 'bidding') {
      const bidder = gs.players.find((p) => p.id === gs.currentBidderId);
      if (!bidder || bidder.eliminated) return;
      const delay = bidder.isHuman ? TURN_SECONDS * 1000 : 800;
      botTimerRef.current = setTimeout(() => {
        const cur = hostGameRef.current;
        if (!cur || cur.phase !== 'bidding' || cur.currentBidderId !== bidder.id) return;
        const curBidder = cur.players.find((p) => p.id === bidder.id)!;
        const value = bidder.isHuman
          ? lowestAllowedBid(cur, bidder.id)
          : getAIBid(
              curBidder.hand,
              cur.manilhaValue!,
              getActivePlayers(cur.players).filter((p) => p.bid !== null).map((p) => p.bid!),
              cur.round,
              isLastBidder(cur, bidder.id)
            );
        applyHostAction({ type: 'bid', value }, bidder.id);
      }, delay);
    } else if (gs.phase === 'playing') {
      const player = gs.players.find((p) => p.id === gs.currentPlayerId);
      if (!player || player.eliminated) return;
      const delay = player.isHuman ? TURN_SECONDS * 1000 : 1000;
      botTimerRef.current = setTimeout(() => {
        const cur = hostGameRef.current;
        if (!cur || cur.phase !== 'playing' || cur.currentPlayerId !== player.id) return;
        const curPlayer = cur.players.find((p) => p.id === player.id)!;
        if (curPlayer.hand.length === 0) return;
        const cardId = player.isHuman
          ? weakestCardId(curPlayer, cur.manilhaValue)
          : getAIPlay(curPlayer.hand, cur.currentTrick, cur.manilhaValue!, curPlayer.bid ?? 0, curPlayer.tricksWon).id;
        if (cardId) applyHostAction({ type: 'play', cardId }, player.id);
      }, delay);
    }
  }, [isHost, applyHostAction]);

  useEffect(() => { scheduleBotRef.current = scheduleBot; }, [scheduleBot]);

  /**
   * The host walked out. Whoever joined earliest among the players still
   * connected takes the table over.
   *
   * A guest only ever holds a redacted state — it never saw the other hands —
   * so the round in progress cannot be resumed. It is re-dealt instead, keeping
   * lives, scores, round number and dealer. That is the price of never shipping
   * anyone else's cards to a client.
   */
  const maybePromoteSelf = useCallback((goneHostId: number) => {
    if (isHostRef.current) return;
    const myId = myPlayerIdRef.current;
    if (myId === null) return;

    // Who is still here, by join order (lowest id joined first)?
    const present = new Set<number>();
    const presence = channelRef.current?.presenceState() ?? {};
    for (const metas of Object.values(presence)) {
      for (const m of metas as unknown as { playerId?: number }[]) {
        if (typeof m.playerId === 'number') present.add(m.playerId);
      }
    }
    present.delete(goneHostId);
    if (!present.size) return;

    const successor = Math.min(...present);
    if (successor !== myId) return;

    isHostRef.current = true;
    setIsHost(true);
    setBecameHost(true);
    hostIdRef.current = myId;
    setHostId(myId);
    try { sessionStorage.setItem('fdp-host-room', roomCode); } catch { /* best-effort */ }

    // Take the lobby from what we already know, minus the host who left.
    const lobby = lobbyPlayersRef.current.filter((lp) => lp.id !== goneHostId);
    lobbyPlayersRef.current = lobby;
    setLobbyPlayers(lobby);
    nextPlayerIdRef.current = Math.max(nextPlayerIdRef.current, ...lobby.map((l) => l.id + 1), 1);

    send('host_changed', { hostId: myId, name: playerName });

    const gs = gameStateRef.current;
    if (gs && gs.phase !== 'game-end' && gs.phase !== 'setup') {
      const players = gs.players.map((p) =>
        p.id === goneHostId ? { ...p, eliminated: true, hand: [] } : p
      );
      const remaining = getActivePlayers(players);
      if (remaining.length <= 1) {
        const winner = remaining[0] ?? null;
        commitHostState({ ...gs, players, phase: 'game-end', winner });
      } else {
        // Fresh deal for the round we were on — nobody here knows the old hands.
        commitHostState(dealRound({
          ...gs,
          players,
          currentTrick: [],
          roundResults: [],
          trickWinnerId: null,
          winner: null,
        }));
      }
    }
    broadcastLobby(lobby);
    persistHostLobby();
  }, [roomCode, playerName, send, broadcastLobby, commitHostState, persistHostLobby]);

  useEffect(() => { maybePromoteSelfRef.current = maybePromoteSelf; }, [maybePromoteSelf]);

  useEffect(() => {
    if (!playerName) return;

    let disposed = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retryInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearJoinTimers = () => {
      if (retryInterval) { clearInterval(retryInterval); retryInterval = null; }
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
    };

    // Builds a fresh channel with all handlers. Called on mount and again on
    // every reconnect attempt — Supabase channels can't be reused after error.
    const connect = () => {
      if (disposed) return;

      const channel = supabase.channel(`fdp-${roomCode}`);
      channelRef.current = channel;

      channel
        // ── Game messages ──────────────────────────────────────────────
        .on('broadcast', { event: 'join' }, ({ payload }) => {
          if (!isHostRef.current) return;
          const { clientId: joinerId, name } = payload as { clientId: string; name: string };

          // If this clientId already has a player, just resend welcome + state
          if (clientPlayerMapRef.current.has(joinerId)) {
            const existingId = clientPlayerMapRef.current.get(joinerId)!;
            send('welcome', { clientId: joinerId, playerId: existingId });
            broadcastLobby(lobbyPlayersRef.current);
            if (hostGameRef.current) broadcastState(hostGameRef.current);
            return;
          }

          const gs = hostGameRef.current;
          const gameOn = !!gs && gs.phase !== 'setup' && gs.phase !== 'game-end';

          // Reconnect: someone typing the room code again from a fresh session
          // (new tab, phone died, storage cleared) still owns their seat, so
          // match them back onto it by name instead of minting a new player.
          const seat = gs?.players.find((p) => p.name === name && !p.eliminated);
          if (gameOn && seat) {
            clientPlayerMapRef.current.set(joinerId, seat.id);
            cancelDisconnectTimer(seat.id);
            clearDisconnected(seat.id);
            if (!lobbyPlayersRef.current.some((lp) => lp.id === seat.id)) {
              const back = [...lobbyPlayersRef.current, { id: seat.id, name }].sort((a, b) => a.id - b.id);
              lobbyPlayersRef.current = back;
              setLobbyPlayers(back);
              lobbySeqRef.current++;
              broadcastLobby(back);
              persistHostLobby();
            }
            send('welcome', { clientId: joinerId, playerId: seat.id });
            broadcastState(gs!);
            return;
          }

          const dp = disconnectedPlayerRef.current;
          if (dp && dp.name === name) {
            // Dropped before the deal — restore their seat as-is.
            cancelDisconnectTimer(dp.id);
            clearDisconnected(dp.id);
            clientPlayerMapRef.current.set(joinerId, dp.id);
            send('welcome', { clientId: joinerId, playerId: dp.id });
            if (hostGameRef.current) broadcastState(hostGameRef.current);
            return;
          }

          // Brand-new face while a game is running — the host decides, and they
          // only get dealt in from the next round.
          if (gameOn) {
            setPendingJoins((prev) =>
              prev.some((p) => p.clientId === joinerId) ? prev : [...prev, { clientId: joinerId, name }]
            );
            send('join_pending', { clientId: joinerId });
            return;
          }

          // Lobby phase — anyone can take a seat.
          const playerId = nextPlayerIdRef.current++;
          const updated = [...lobbyPlayersRef.current, { id: playerId, name }];
          lobbyPlayersRef.current = updated;
          setLobbyPlayers(updated);
          lobbySeqRef.current++;
          broadcastLobby(updated);
          persistHostLobby();

          clientPlayerMapRef.current.set(joinerId, playerId);
          send('welcome', { clientId: joinerId, playerId });
          if (hostGameRef.current) broadcastState(hostGameRef.current);
        })
        .on('broadcast', { event: 'join_pending' }, ({ payload }) => {
          if (isHostRef.current) return;
          if ((payload as { clientId: string }).clientId === clientIdRef.current) {
            setAwaitingApproval(true);
          }
        })
        .on('broadcast', { event: 'join_rejected' }, ({ payload }) => {
          if (isHostRef.current) return;
          if ((payload as { clientId: string }).clientId === clientIdRef.current) {
            setAwaitingApproval(false);
            setJoinRejected(true);
          }
        })
        .on('broadcast', { event: 'welcome' }, ({ payload }) => {
          if (isHostRef.current) return;
          const { clientId: targetClient, playerId } = payload as { clientId: string; playerId: number };
          if (targetClient === clientIdRef.current) {
            myPlayerIdRef.current = playerId;
            setMyPlayerId(playerId);
            setAwaitingApproval(false);
            setJoinRejected(false);
            try { sessionStorage.setItem(pidKey, String(playerId)); } catch { /* best-effort */ }
            clearJoinTimers();
            channel.track({ playerId, name: playerName });
          }
        })
        .on('broadcast', { event: 'lobby' }, ({ payload }) => {
          if (isHostRef.current) return;
          const { players, seq } = payload as { players: LobbyPlayer[]; seq?: number };
          // Ignore stale out-of-order lobby broadcasts
          if (seq !== undefined && seq <= lastLobbySeqRef.current) return;
          if (seq !== undefined) lastLobbySeqRef.current = seq;
          setLobbyPlayers(players);
        })
        .on('broadcast', { event: 'game_state' }, ({ payload }) => {
          if (isHostRef.current) return;
          const { state, target } = payload as { state: GameState; target?: number };
          // States are per-player; only apply the copy addressed to us
          if (target !== undefined && target !== myPlayerIdRef.current) return;
          setGameState(state);
        })
        .on('broadcast', { event: 'action' }, ({ payload }) => {
          if (!isHostRef.current) return;
          const { action, fromPlayerId } = payload as { action: PlayerAction; fromPlayerId: number };
          applyHostAction(action, fromPlayerId);
        })
        // Guest requests current state after reconnecting — also proof of life
        .on('broadcast', { event: 'request_state' }, ({ payload }) => {
          if (!isHostRef.current) return;
          const { playerId } = (payload ?? {}) as { playerId?: number };
          if (playerId !== undefined) {
            cancelDisconnectTimer(playerId);
            clearDisconnected(playerId);
          }
          if (hostGameRef.current) broadcastState(hostGameRef.current);
          broadcastLobby(lobbyPlayersRef.current);
        })
        // ── Chat ────────────────────────────────────────────────────────
        .on('broadcast', { event: 'chat' }, ({ payload }) => {
          setChatMessages((prev) => [...prev, payload as ChatMessage]);
        })
        // ── Kick / voluntary leave ──────────────────────────────────────
        .on('broadcast', { event: 'kicked' }, ({ payload }) => {
          if (isHostRef.current) return;
          const { targetId } = payload as { targetId: number };
          if (targetId === myPlayerIdRef.current) setWasKicked(true);
        })
        .on('broadcast', { event: 'leave_lobby' }, ({ payload }) => {
          if (!isHostRef.current) return;
          const { playerId } = payload as { playerId: number };
          const updated = lobbyPlayersRef.current.filter((p) => p.id !== playerId);
          if (updated.length === lobbyPlayersRef.current.length) return;
          lobbyPlayersRef.current = updated;
          setLobbyPlayers(updated);
          lobbySeqRef.current++;
          broadcastLobby(updated);
          persistHostLobby();
        })
        // ── Disconnect events (broadcast so all players see the pause) ──
        .on('broadcast', { event: 'player_disconnected' }, ({ payload }) => {
          if (isHostRef.current) return;
          const { playerId, name } = payload as { playerId: number; name: string };
          setDisconnectedPlayer({ id: playerId, name });
        })
        .on('broadcast', { event: 'player_reconnected' }, () => {
          if (isHostRef.current) return;
          setDisconnectedPlayer(null);
        })
        // ── Presence: detect crashes / unexpected disconnects ───────────
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          for (const p of leftPresences) {
            const { playerId, name } = p as unknown as { playerId: number; name: string };

            // Guests watch the host's presence: if the table loses its owner,
            // the next player by join order takes over instead of everyone
            // staring at a frozen board.
            if (!isHostRef.current) {
              if (playerId === hostIdRef.current) {
                cancelDisconnectTimer(playerId);
                const t = setTimeout(() => {
                  disconnectTimersRef.current.delete(playerId);
                  setDisconnectedPlayer({ id: playerId, name: name ?? 'Host' });
                  maybePromoteSelfRef.current(playerId);
                }, DISCONNECT_GRACE_MS);
                disconnectTimersRef.current.set(playerId, t);
              }
              continue;
            }

            if (playerId === hostIdRef.current) continue;

            const gs = hostGameRef.current;
            // No game yet → they left the lobby; drop them from the seat list.
            if (!gs || gs.phase === 'setup') {
              const updated = lobbyPlayersRef.current.filter((lp) => lp.id !== playerId);
              if (updated.length !== lobbyPlayersRef.current.length) {
                lobbyPlayersRef.current = updated;
                setLobbyPlayers(updated);
                lobbySeqRef.current++;
                broadcastLobby(updated);
                persistHostLobby();
              }
              continue;
            }
            if (gs.phase === 'game-end') continue;

            const player = gs.players.find(pl => pl.id === playerId && !pl.eliminated);
            if (!player) continue;

            // Grace period: flaky connections come right back — don't pause
            // the table for a hiccup.
            cancelDisconnectTimer(playerId);
            const timer = setTimeout(() => {
              disconnectTimersRef.current.delete(playerId);
              const dp = { id: playerId, name: player.name ?? name };
              disconnectedPlayerRef.current = dp;
              setDisconnectedPlayer(dp);
              send('player_disconnected', dp);
            }, DISCONNECT_GRACE_MS);
            disconnectTimersRef.current.set(playerId, timer);
          }
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          for (const p of newPresences) {
            const { playerId } = p as unknown as { playerId: number };
            if (playerId === undefined) continue;
            cancelDisconnectTimer(playerId);
            if (
              !isHostRef.current &&
              playerId === hostIdRef.current &&
              disconnectedPlayerRef.current?.id === hostIdRef.current
            ) {
              setDisconnectedPlayer(null);
              // Host is back — ask for the current state
              send('request_state', { playerId: myPlayerIdRef.current });
            }
            if (isHostRef.current) clearDisconnected(playerId);
          }
        })
        // A new host announced itself — everyone follows, and the old host
        // (if it ever comes back) stops thinking it still owns the table.
        .on('broadcast', { event: 'host_changed' }, ({ payload }) => {
          const { hostId: newHostId } = payload as { hostId: number };
          if (promotionTimerRef.current) clearTimeout(promotionTimerRef.current);
          hostIdRef.current = newHostId;
          setHostId(newHostId);
          cancelDisconnectTimer(newHostId);
          setDisconnectedPlayer(null);
          disconnectedPlayerRef.current = null;
          if (newHostId !== myPlayerIdRef.current && isHostRef.current) {
            isHostRef.current = false;
            setIsHost(false);
            try { sessionStorage.removeItem('fdp-host-room'); } catch { /* best-effort */ }
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            reconnectAttempts = 0;
            setIsConnected(true);
            setError(null);

            if (isHost) {
              channel.track({ playerId: 0, name: playerName });
              // Push state right away so guests recover fast after we return,
              // and resume the bot loop in case it was a bot's turn.
              if (hostGameRef.current) {
                broadcastState(hostGameRef.current);
                scheduleBotRef.current(hostGameRef.current);
              }
              broadcastLobby(lobbyPlayersRef.current);

              // Heartbeat every 12s keeps the channel alive and lets
              // reconnecting guests recover the game state without rejoining
              if (heartbeatRef.current) clearInterval(heartbeatRef.current);
              heartbeatRef.current = setInterval(() => {
                if (hostGameRef.current) broadcastState(hostGameRef.current);
                else broadcastLobby(lobbyPlayersRef.current);
              }, 12000);
            } else {
              // If we already have a player ID, we're reconnecting —
              // request current state from host instead of re-joining
              if (myPlayerIdRef.current !== null) {
                channel.track({ playerId: myPlayerIdRef.current, name: playerName });
                send('request_state', { playerId: myPlayerIdRef.current });
                return;
              }

              const sendJoin = () => {
                if (myPlayerIdRef.current !== null) return;
                send('join', { clientId: clientIdRef.current, name: playerName });
              };
              sendJoin();
              if (retryInterval) clearInterval(retryInterval);
              retryInterval = setInterval(sendJoin, 2000);
              if (timeoutId) clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                if (retryInterval) clearInterval(retryInterval);
                // Waiting on the host to wave us in is not a failure to connect.
                if (myPlayerIdRef.current === null && !awaitingApprovalRef.current) {
                  setError('Não foi possível entrar na sala. Verifique se o código está correto e o host está online.');
                }
              }, 30000);
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            // Don't give up: tear the channel down and rebuild with backoff.
            // Mobile browsers kill the socket whenever the tab is backgrounded.
            setIsConnected(false);
            if (disposed) return;

            reconnectAttempts++;
            if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
              setError('Sem conexão com a sala. Verifique sua internet e recarregue a página.');
              return;
            }

            clearJoinTimers();
            if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
            supabase.removeChannel(channel);
            if (channelRef.current === channel) channelRef.current = null;

            const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 10000);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
          }
        });
    };

    connect();

    // Reconnect immediately when the tab comes back to the foreground
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || disposed) return;
      if (!isConnectedRef.current && !reconnectTimer) {
        reconnectAttempts = 0;
        if (channelRef.current) supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const timersAtSetup = disconnectTimersRef.current;
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      clearJoinTimers();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (botTimerRef.current) { clearTimeout(botTimerRef.current); botTimerRef.current = null; }
      for (const t of timersAtSetup.values()) clearTimeout(t);
      timersAtSetup.clear();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
    // `isHost` is deliberately not a dependency: handlers read isHostRef, so a
    // mid-game promotion flips behaviour without tearing the channel down and
    // rebuilding it (which would drop presence and the promotion broadcast).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roomCode, playerName, pidKey, send, broadcastState, broadcastLobby,
    applyHostAction, cancelDisconnectTimer, clearDisconnected, persistHostLobby,
  ]);

  const sendChat = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: clientIdRef.current + Date.now(),
      playerId: myPlayerIdRef.current ?? 0,
      name: playerName ?? '?',
      text,
      ts: Date.now(),
    };
    setChatMessages((prev) => [...prev, msg]);
    send('chat', msg as unknown as Record<string, unknown>);
  }, [playerName, send]);

  const sendAction = useCallback((action: PlayerAction) => {
    if (isHost) {
      applyHostAction(action, myPlayerIdRef.current ?? 0);
    } else {
      send('action', { action, fromPlayerId: myPlayerIdRef.current ?? 0 });
    }
  }, [isHost, applyHostAction, send]);

  const startGame = useCallback((roundLimit?: number) => {
    if (!isHost) return;
    // Online is humans only — start with everyone who joined the lobby (no bots).
    const lobby = lobbyPlayersRef.current;
    const count = lobby.length;
    if (count < 2) return;

    // initGame numbers the seats 0..count-1, but lobby ids get gaps as soon as
    // someone leaves or is kicked (guests keep the id they were welcomed with,
    // e.g. [0, 2]). Remap the dealt game onto the real lobby ids, otherwise a
    // guest would not find themselves in the state and could not play.
    const gs = initGame(count, count, roundLimit);
    const seatId = (slot: number) => lobby[slot].id;
    const namedGs: GameState = {
      ...gs,
      players: gs.players.map((p, i) => ({ ...p, id: seatId(i), name: lobby[i].name })),
      dealerPlayerId: seatId(gs.dealerPlayerId),
      currentBidderId: seatId(gs.currentBidderId),
      currentPlayerId: seatId(gs.currentPlayerId),
      trickLeaderId: seatId(gs.trickLeaderId),
    };
    persistHostLobby();
    commitHostState(namedGs);
  }, [isHost, commitHostState, persistHostLobby]);

  const removeDisconnectedPlayer = useCallback(() => {
    if (!isHost) return;
    const dp = disconnectedPlayerRef.current;
    if (!dp) return;

    const { id: playerId } = dp;
    let gs = hostGameRef.current;
    if (!gs) return;

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
            commitHostState(startNextTrick(hostGameRef.current));
          }, 1600);
        }
      }
    }

    gs = {
      ...gs,
      players: gs.players.map(p =>
        p.id === playerId ? { ...p, eliminated: true, hand: [] } : p
      ),
    };

    const remaining = getActivePlayers(gs.players);
    if (remaining.length <= 1) {
      const winner = remaining[0] ?? [...gs.players].sort((a, b) => b.points - a.points)[0] ?? null;
      gs = { ...gs, phase: 'game-end', winner };
    } else {
      // Removing a player can leave the turn pointing at their now-empty seat —
      // hand it to someone who can actually play.
      gs = normalizeTurn(gs);
    }

    commitHostState(gs);

    disconnectedPlayerRef.current = null;
    setDisconnectedPlayer(null);
    send('player_reconnected', {});
  }, [isHost, commitHostState, send]);

  // Host removes a player on purpose (lobby or mid-game). Notifies the target,
  // drops them from the seat list, and folds their game slot if a game is on.
  const kickPlayer = useCallback((playerId: number) => {
    if (!isHost || playerId === hostIdRef.current) return;
    send('kicked', { targetId: playerId });
    cancelDisconnectTimer(playerId);

    const updatedLobby = lobbyPlayersRef.current.filter((p) => p.id !== playerId);
    lobbyPlayersRef.current = updatedLobby;
    setLobbyPlayers(updatedLobby);
    lobbySeqRef.current++;
    broadcastLobby(updatedLobby);
    persistHostLobby();

    let gs = hostGameRef.current;
    if (!gs) return;

    if (gs.phase === 'bidding' && gs.currentBidderId === playerId) {
      gs = applyBid(gs, playerId, 0);
    } else if (gs.phase === 'playing' && gs.currentPlayerId === playerId) {
      const player = gs.players.find((p) => p.id === playerId);
      if (player?.hand.length) {
        const afterPlay = applyCardPlay(gs, playerId, player.hand[0].id);
        gs = afterPlay;
        if (afterPlay.phase === 'trick-end') {
          setTimeout(() => {
            if (!hostGameRef.current || hostGameRef.current.phase !== 'trick-end') return;
            commitHostState(startNextTrick(hostGameRef.current));
          }, 1600);
        }
      }
    }

    gs = {
      ...gs,
      players: gs.players.map((p) =>
        p.id === playerId ? { ...p, eliminated: true, hand: [] } : p
      ),
    };

    const remaining = getActivePlayers(gs.players);
    if (remaining.length <= 1) {
      const winner = remaining[0] ?? [...gs.players].sort((a, b) => b.points - a.points)[0] ?? null;
      gs = { ...gs, phase: 'game-end', winner };
    } else {
      // Removing a player can leave the turn pointing at their now-empty seat —
      // hand it to someone who can actually play.
      gs = normalizeTurn(gs);
    }

    commitHostState(gs);
  }, [isHost, broadcastLobby, commitHostState, persistHostLobby, cancelDisconnectTimer, send]);

  // Host waves in someone who showed up mid-game. They get a seat and a hand
  // only when the next round is dealt.
  const approveJoin = useCallback((joinerClientId: string) => {
    if (!isHost) return;
    const pending = pendingJoinsRef.current.find((p) => p.clientId === joinerClientId);
    if (!pending) return;

    const playerId = nextPlayerIdRef.current++;
    clientPlayerMapRef.current.set(joinerClientId, playerId);

    const updated = [...lobbyPlayersRef.current, { id: playerId, name: pending.name }];
    lobbyPlayersRef.current = updated;
    setLobbyPlayers(updated);
    lobbySeqRef.current++;
    broadcastLobby(updated);
    persistHostLobby();

    pendingSeatsRef.current = [...pendingSeatsRef.current, { id: playerId, name: pending.name }];
    setPendingJoins((prev) => prev.filter((p) => p.clientId !== joinerClientId));

    send('welcome', { clientId: joinerClientId, playerId });
    if (hostGameRef.current) broadcastState(hostGameRef.current);
  }, [isHost, broadcastLobby, broadcastState, persistHostLobby, send]);

  const rejectJoin = useCallback((joinerClientId: string) => {
    if (!isHost) return;
    send('join_rejected', { clientId: joinerClientId });
    setPendingJoins((prev) => prev.filter((p) => p.clientId !== joinerClientId));
  }, [isHost, send]);

  // Guest leaves the lobby voluntarily — tell the host to free the seat.
  const leaveLobby = useCallback(() => {
    if (myPlayerIdRef.current !== null) {
      send('leave_lobby', { playerId: myPlayerIdRef.current });
    }
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  }, [send]);

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
    wasKicked,
    disconnectedPlayer,
    chatMessages,
    pendingJoins,
    awaitingApproval,
    joinRejected,
    isHost,
    hostId,
    becameHost,
    // Approved mid-game: we hold a seat but the deal only reaches us next round.
    seatedNextRound:
      myPlayerId !== null &&
      !!gameState &&
      gameState.phase !== 'game-end' &&
      !gameState.players.some((p) => p.id === myPlayerId),
    sendAction,
    sendChat,
    startGame,
    removeDisconnectedPlayer,
    kickPlayer,
    approveJoin,
    rejectJoin,
    leaveLobby,
    disconnect,
  };
}
