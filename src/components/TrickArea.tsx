'use client';
import { GameState } from '../lib/types';
import { getCardStrength } from '../lib/deck';
import { CardComponent } from './CardComponent';

interface TrickAreaProps {
  state: GameState;
  /** Vira lives in the top bar on desktop — hide it here. */
  showVira?: boolean;
  /** Turn status shown below the played cards ("sua vez — Bia leva por enquanto"). */
  status?: string | null;
}

export function TrickArea({ state, showVira = true, status }: TrickAreaProps) {
  const { currentTrick, vira, manilhaValue, trickWinnerId, players, phase } = state;

  const leadingCardId = currentTrick.length > 0 && manilhaValue
    ? currentTrick.reduce((leader, played) =>
        getCardStrength(played.card, manilhaValue) > getCardStrength(leader.card, manilhaValue)
          ? played : leader
      ).card.id
    : null;

  const winnerPlayedManilha =
    currentTrick.find((pc) => pc.playerId === trickWinnerId)?.card.value === manilhaValue;

  return (
    <div className="flex flex-col items-center gap-3.5 w-full py-2">
      {showVira && vira && (
        <div className="flex items-center gap-2.5">
          <span className="text-cream/50 text-[11px] tracking-[2px]">VIRA</span>
          <CardComponent card={vira} size="sm" />
          <span className="text-gold text-xs font-semibold">manilha {manilhaValue}</span>
        </div>
      )}

      {currentTrick.length > 0 && (
        <div className="flex items-end justify-center">
          {currentTrick.map(({ playerId, card }, i) => {
            const player = players.find((p) => p.id === playerId);
            const isManilha = card.value === manilhaValue;
            const isLeading = card.id === leadingCardId;
            const mid = (currentTrick.length - 1) / 2;
            const angle = (i - mid) * 7;
            const lift = isLeading ? -10 : Math.abs(i - mid) * 6;
            return (
              <div
                key={card.id}
                className={`flex flex-col items-center gap-1.5 ${i > 0 ? '-ml-4' : ''} ${isLeading ? 'z-10' : ''}`}
                style={{ transform: `rotate(${isLeading ? 0 : angle}deg) translateY(${lift}px)` }}
              >
                <CardComponent card={card} isManilha={isManilha} isWinning={isLeading} size="md" />
                <span className={`text-[11px] font-semibold ${isLeading ? 'text-gold' : 'text-cream/60'}`}>
                  {player?.name}
                  {isLeading && isManilha && ' · manilha'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {phase === 'trick-end' && trickWinnerId !== null ? (
        <div className="font-display italic text-gold text-base text-center">
          {players.find((p) => p.id === trickWinnerId)?.name} leva a vaza
          {winnerPlayedManilha && ' com a manilha'}
        </div>
      ) : status ? (
        <div className="font-display italic text-gold text-base text-center">{status}</div>
      ) : null}
    </div>
  );
}
