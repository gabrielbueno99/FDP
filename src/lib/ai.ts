import { Card, Value } from './types';
import { getCardStrength } from './deck';

export function getAIBid(
  hand: Card[],
  manilhaValue: Value,
  existingBids: number[],
  cardsInRound: number,
  isLastBidder: boolean
): number {
  let estimate = 0;
  for (const card of hand) {
    const s = getCardStrength(card, manilhaValue);
    if (s >= 1000) estimate += 0.85;        // manilha
    else if (s >= 120) estimate += 0.65;   // 3 or 2
    else if (s >= 100) estimate += 0.45;   // A or K
    else if (s >= 80) estimate += 0.25;    // J or Q
    else estimate += 0.1;
  }

  let bid = Math.round(estimate);
  bid = Math.max(0, Math.min(bid, cardsInRound));

  if (isLastBidder) {
    const sum = existingBids.reduce((a, b) => a + b, 0);
    const forbidden = cardsInRound - sum;
    if (bid === forbidden) {
      if (forbidden > 0) bid = forbidden - 1;
      else bid = 1;
      bid = Math.max(0, Math.min(bid, cardsInRound));
    }
  }

  return bid;
}

export function getAIPlay(
  hand: Card[],
  currentTrick: { playerId: number; card: Card }[],
  manilhaValue: Value,
  bid: number,
  tricksWon: number
): Card {
  const sorted = [...hand].sort(
    (a, b) => getCardStrength(a, manilhaValue) - getCardStrength(b, manilhaValue)
  );

  const tricksNeeded = bid - tricksWon;
  const shouldWin = tricksNeeded > 0;

  if (currentTrick.length === 0) {
    return shouldWin ? sorted[sorted.length - 1] : sorted[0];
  }

  const bestInTrick = Math.max(
    ...currentTrick.map((p) => getCardStrength(p.card, manilhaValue))
  );
  const winning = sorted.filter(
    (c) => getCardStrength(c, manilhaValue) > bestInTrick
  );

  if (!shouldWin) return sorted[0];
  if (winning.length > 0) return winning[0];
  return sorted[0];
}
