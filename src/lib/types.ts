export type Suit = 'clubs' | 'hearts' | 'spades' | 'diamonds';
export type Value = '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';

export interface Card {
  id: string;
  suit: Suit;
  value: Value;
}

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  points: number;
  hand: Card[];
  bid: number | null;
  tricksWon: number;
  eliminated: boolean;
}

export interface PlayedCard {
  playerId: number;
  card: Card;
}

export interface RoundResult {
  playerId: number;
  name: string;
  bid: number;
  tricksWon: number;
  lostPoint: boolean;
  newlyEliminated: boolean;
}

export type GamePhase =
  | 'setup'
  | 'bidding'
  | 'playing'
  | 'trick-end'
  | 'round-end'
  | 'game-end';

export interface GameState {
  phase: GamePhase;
  players: Player[];
  round: number;
  maxRounds: number;
  dealerPlayerId: number;
  currentBidderId: number;
  currentPlayerId: number;
  trickLeaderId: number;
  vira: Card | null;
  manilhaValue: Value | null;
  currentTrick: PlayedCard[];
  roundResults: RoundResult[];
  trickWinnerId: number | null;
  winner: Player | null;
}

export type NetworkMessage =
  | { type: 'join'; name: string }
  | { type: 'welcome'; playerId: number }
  | { type: 'lobby'; players: { id: number; name: string }[] }
  | { type: 'game_state'; state: GameState }
  | { type: 'action'; action: PlayerAction; fromPlayerId: number }
  | { type: 'start_game'; totalPlayers: number };

export type PlayerAction =
  | { type: 'bid'; value: number }
  | { type: 'play'; cardId: string }
  | { type: 'next_round' };

export interface ChatMessage {
  id: string;
  playerId: number;
  name: string;
  text: string;
  ts: number;
}
