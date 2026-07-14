import { Card, GameState, Player, PlayedCard, RoundResult, Value } from './types';
import { createDeck, getManilhaValue, getTrickWinnerId, shuffle } from './deck';

export function getActivePlayers(players: Player[]): Player[] {
  return players.filter((p) => !p.eliminated);
}

export function nextActivePlayerId(players: Player[], currentId: number): number {
  const active = getActivePlayers(players);
  const idx = active.findIndex((p) => p.id === currentId);
  return active[(idx + 1) % active.length].id;
}

export function isLastBidder(state: GameState, playerId: number): boolean {
  const active = getActivePlayers(state.players);
  const dealerIdx = active.findIndex((p) => p.id === state.dealerPlayerId);
  // Dealer bids last
  return active[dealerIdx].id === playerId;
}

export function getForbiddenBid(state: GameState): number | null {
  const active = getActivePlayers(state.players);
  const nonDealerBidders = active.filter((p) => p.id !== state.dealerPlayerId);
  const allNonDealerBid = nonDealerBidders.every((p) => p.bid !== null);
  if (!allNonDealerBid) return null;

  const sum = active.reduce((acc, p) => acc + (p.bid ?? 0), 0);
  const forbidden = state.round - sum;
  if (forbidden < 0 || forbidden > state.round) return null;
  return forbidden;
}

export function dealRound(state: GameState): GameState {
  const active = getActivePlayers(state.players);
  const deck = shuffle(createDeck());
  const vira = deck[0];
  const manilhaValue = getManilhaValue(vira.value);
  const remaining = deck.slice(1);

  const newPlayers = state.players.map((p) => {
    if (p.eliminated) return { ...p, hand: [], bid: null, tricksWon: 0 };
    const activeIdx = active.findIndex((ap) => ap.id === p.id);
    const hand = remaining.slice(
      activeIdx * state.round,
      (activeIdx + 1) * state.round
    );
    return { ...p, hand, bid: null, tricksWon: 0 };
  });

  const dealerIdx = active.findIndex((p) => p.id === state.dealerPlayerId);
  const firstBidderIdx = (dealerIdx + 1) % active.length;
  const firstBidderId = active[firstBidderIdx].id;

  return {
    ...state,
    phase: 'bidding',
    players: newPlayers,
    vira,
    manilhaValue,
    currentTrick: [],
    roundResults: [],
    trickWinnerId: null,
    currentBidderId: firstBidderId,
    currentPlayerId: firstBidderId,
    trickLeaderId: firstBidderId,
  };
}

export function applyBid(
  state: GameState,
  playerId: number,
  bid: number
): GameState {
  const active = getActivePlayers(state.players);
  const newPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, bid } : p
  );

  const updatedActive = active.map((p) =>
    p.id === playerId ? { ...p, bid } : p
  );
  const allBid = updatedActive.every((p) => p.bid !== null);

  if (allBid) {
    const dealerIdx = active.findIndex((p) => p.id === state.dealerPlayerId);
    const leaderIdx = (dealerIdx + 1) % active.length;
    const leaderId = active[leaderIdx].id;

    return {
      ...state,
      phase: 'playing',
      players: newPlayers,
      currentPlayerId: leaderId,
      trickLeaderId: leaderId,
      currentTrick: [],
    };
  }

  const nextBidderId = nextActivePlayerId(newPlayers, playerId);

  return {
    ...state,
    players: newPlayers,
    currentBidderId: nextBidderId,
  };
}

export function applyCardPlay(
  state: GameState,
  playerId: number,
  cardId: string
): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const card = player.hand.find((c) => c.id === cardId)!;
  const active = getActivePlayers(state.players);

  const newPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, hand: p.hand.filter((c) => c.id !== cardId) } : p
  );

  const newTrick: PlayedCard[] = [...state.currentTrick, { playerId, card }];

  if (newTrick.length < active.length) {
    const leaderIdx = active.findIndex((p) => p.id === state.trickLeaderId);
    const nextPlayerIdx = (leaderIdx + newTrick.length) % active.length;
    const nextPlayerId = active[nextPlayerIdx].id;

    return {
      ...state,
      players: newPlayers,
      currentTrick: newTrick,
      currentPlayerId: nextPlayerId,
    };
  }

  // Trick complete
  const winnerId = getTrickWinnerId(newTrick, state.manilhaValue!);
  const playersAfterTrick = newPlayers.map((p) =>
    p.id === winnerId ? { ...p, tricksWon: p.tricksWon + 1 } : p
  );

  const handsEmpty = getActivePlayers(playersAfterTrick).every(
    (p) => p.hand.length === 0
  );

  if (handsEmpty) {
    return resolveRoundEnd(state, playersAfterTrick, newTrick, winnerId);
  }

  return {
    ...state,
    phase: 'trick-end',
    players: playersAfterTrick,
    currentTrick: newTrick,
    trickWinnerId: winnerId,
    trickLeaderId: winnerId,
    currentPlayerId: winnerId,
  };
}

export function startNextTrick(state: GameState): GameState {
  return {
    ...state,
    phase: 'playing',
    currentTrick: [],
    trickWinnerId: null,
    currentPlayerId: state.trickLeaderId,
  };
}

function resolveRoundEnd(
  state: GameState,
  players: Player[],
  lastTrick: PlayedCard[],
  lastWinnerId: number
): GameState {
  const active = getActivePlayers(players);
  const roundResults: RoundResult[] = active.map((p) => {
    const lostPoint = p.bid !== p.tricksWon;
    const newPoints = lostPoint ? p.points - 1 : p.points;
    return {
      playerId: p.id,
      name: p.name,
      bid: p.bid!,
      tricksWon: p.tricksWon,
      lostPoint,
      newlyEliminated: newPoints <= 0,
    };
  });

  const finalPlayers = players.map((p) => {
    const result = roundResults.find((r) => r.playerId === p.id);
    if (!result) return p;
    const newPoints = result.lostPoint ? p.points - 1 : p.points;
    return {
      ...p,
      points: Math.max(0, newPoints),
      eliminated: newPoints <= 0,
    };
  });

  const activeFinal = getActivePlayers(finalPlayers);
  const isGameOver =
    activeFinal.length <= 1 || state.round >= state.maxRounds;

  const winner = isGameOver
    ? activeFinal.sort((a, b) => b.points - a.points)[0] ?? null
    : null;

  return {
    ...state,
    phase: isGameOver ? 'game-end' : 'round-end',
    players: finalPlayers,
    currentTrick: lastTrick,
    trickWinnerId: lastWinnerId,
    roundResults,
    winner,
  };
}

export function advanceToNextRound(state: GameState): GameState {
  const active = getActivePlayers(state.players);

  if (active.length <= 1 || state.round >= state.maxRounds) {
    const winner = [...active].sort((a, b) => b.points - a.points)[0] ?? null;
    return { ...state, phase: 'game-end', winner };
  }

  const dealerIdx = active.findIndex((p) => p.id === state.dealerPlayerId);
  const nextDealerId = active[(dealerIdx + 1) % active.length].id;

  return dealRound({
    ...state,
    round: state.round + 1,
    dealerPlayerId: nextDealerId,
  });
}

export function initGame(playerCount: number, humanCount: number): GameState {
  const botNames = ['João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Júlia', 'Lucas'];
  const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
    id: i,
    name: i < humanCount ? (i === 0 ? 'Você' : `Jogador ${i + 1}`) : botNames[i - humanCount],
    isHuman: i < humanCount,
    points: 5,
    hand: [],
    bid: null,
    tricksWon: 0,
    eliminated: false,
  }));

  const maxRounds = Math.min(Math.floor(51 / playerCount), 10);
  const dealerPlayerId = Math.floor(Math.random() * playerCount);

  return dealRound({
    phase: 'setup',
    players,
    round: 1,
    maxRounds,
    dealerPlayerId,
    currentBidderId: 0,
    currentPlayerId: 0,
    trickLeaderId: 0,
    vira: null,
    manilhaValue: null,
    currentTrick: [],
    roundResults: [],
    trickWinnerId: null,
    winner: null,
  });
}
