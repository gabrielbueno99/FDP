import { Card, Suit, Value } from './types';

export const SUITS: Suit[] = ['clubs', 'hearts', 'spades', 'diamonds'];
export const VALUES: Value[] = ['4', '5', '6', '7', '8', '9', '10', 'Q', 'J', 'K', 'A', '2', '3'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  hearts: '♥',
  spades: '♠',
  diamonds: '♦',
};

export const SUIT_NAMES: Record<Suit, string> = {
  clubs: 'Paus',
  hearts: 'Copas',
  spades: 'Espadas',
  diamonds: 'Ouros',
};

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    VALUES.map((value) => ({ id: `${value}-${suit}`, suit, value }))
  );
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getManilhaValue(viraValue: Value): Value {
  // Special case: if vira is 2, skip 3 and manilha becomes 4
  if (viraValue === '2') return '4';
  const idx = VALUES.indexOf(viraValue);
  return VALUES[(idx + 1) % VALUES.length];
}

// Suit strength: clubs > hearts > spades > diamonds
export const SUIT_STRENGTH: Record<Suit, number> = {
  clubs: 4,
  hearts: 3,
  spades: 2,
  diamonds: 1,
};

// Value strength (non-manilha): 3 > 2 > A > K > J > Q > 10 > 9 > 8 > 7 > 6 > 5 > 4
export const VALUE_STRENGTH: Record<Value, number> = {
  '4': 1,
  '5': 2,
  '6': 3,
  '7': 4,
  '8': 5,
  '9': 6,
  '10': 7,
  Q: 8,
  J: 9,
  K: 10,
  A: 11,
  '2': 12,
  '3': 13,
};

export function getCardStrength(card: Card, manilhaValue: Value): number {
  if (card.value === manilhaValue) {
    return 1000 + SUIT_STRENGTH[card.suit];
  }
  return VALUE_STRENGTH[card.value] * 10 + SUIT_STRENGTH[card.suit];
}

export function getTrickWinnerId(
  trick: PlayedCard[],
  manilhaValue: Value
): number {
  return trick.reduce((winner, played) =>
    getCardStrength(played.card, manilhaValue) >
    getCardStrength(winner.card, manilhaValue)
      ? played
      : winner
  ).playerId;
}

type PlayedCard = { playerId: number; card: Card };
