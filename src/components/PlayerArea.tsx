'use client';
import { Player, Value } from '../lib/types';
import { CardBack, CardComponent, CardSize } from './CardComponent';
import { getCardStrength } from '../lib/deck';

interface PlayerAreaProps {
  player: Player;
  isDealer: boolean;
  isCurrentBidder: boolean;
  isCurrentPlayer: boolean;
  isTrickWinner: boolean;
  manilhaValue: Value | null;
  showCards: boolean;
  onCardClick?: (cardId: string) => void;
  compact?: boolean;
  bigCards?: boolean;
  playOrder?: number;
  hasPlayedInTrick?: boolean;
  /** Card raised + gold outline; second tap plays it. */
  selectedCardId?: string | null;
  /** Render only the fan (info shown elsewhere, e.g. desktop bottom bar). */
  handOnly?: boolean;
  /** Desktop-size cards in the fan. */
  xlCards?: boolean;
}

const AVATAR_COLORS = ['#3a5a4a', '#5a3a3a', '#3a4a5a', '#4a5a3a', '#5a4a3a', '#4a3a5a', '#5a5a3a', '#3a5a5a'];

export function avatarColor(playerId: number) {
  return AVATAR_COLORS[playerId % AVATAR_COLORS.length];
}

export function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function Dots({ points, small }: { points: number; small?: boolean }) {
  return (
    <div className={small ? 'flex gap-[3px]' : 'flex gap-1'}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${small ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${
            i < points ? 'bg-gold' : 'bg-white/15'
          }`}
        />
      ))}
    </div>
  );
}

function fanTransform(index: number, count: number, selected: boolean) {
  if (selected) return 'translateY(-16px)';
  if (count === 1) return undefined;
  const mid = (index - (count - 1) / 2);
  const step = count > 6 ? 2.4 : 5;
  return `rotate(${mid * step}deg) translateY(${Math.abs(mid) * (count > 6 ? 3 : 5)}px)`;
}

function handOverlap(count: number, xl: boolean) {
  if (xl) return count > 6 ? '-space-x-[52px]' : count > 2 ? '-space-x-9' : '-space-x-2';
  if (count > 8) return '-space-x-14';
  if (count > 5) return '-space-x-12';
  if (count > 2) return '-space-x-7';
  return '-space-x-1';
}

export function PlayerArea({
  player,
  isDealer,
  isCurrentBidder,
  isCurrentPlayer,
  isTrickWinner,
  manilhaValue,
  showCards,
  onCardClick,
  compact,
  bigCards,
  playOrder,
  hasPlayedInTrick,
  selectedCardId,
  handOnly,
  xlCards,
}: PlayerAreaProps) {
  const sortedHand = manilhaValue
    ? [...player.hand].sort((a, b) => getCardStrength(b, manilhaValue) - getCardStrength(a, manilhaValue))
    : [...player.hand];

  const highlight =
    isCurrentPlayer || isCurrentBidder
      ? 'outline outline-[1.5px] outline-gold'
      : isTrickWinner
        ? 'outline outline-[1.5px] outline-ok'
        : '';

  const elim = player.eliminated ? 'opacity-25' : '';

  // Opponent pod — avatar, name, tentos, vidas, cartas
  if (compact) {
    return (
      <div
        className={`flex flex-col items-center gap-1 rounded-[14px] px-2 py-2 bg-black/30 ${highlight} ${elim}`}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-cream"
          style={{ background: avatarColor(player.id) }}
        >
          {initials(player.name)}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-cream font-semibold text-xs truncate max-w-[80px]">{player.name}</span>
          {player.eliminated && <span className="text-danger text-xs font-bold">✕</span>}
          {playOrder !== undefined && (
            <span
              className={`text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none ${
                hasPlayedInTrick ? 'bg-ok/25 text-ok' : 'bg-gold/25 text-gold'
              }`}
            >
              {playOrder}
            </span>
          )}
        </div>
        {isDealer && (
          <span className="text-gold text-[9px] font-bold tracking-[1.5px]">CARTEIA</span>
        )}
        {player.bid !== null ? (
          <span className="text-cream/65 text-[10.5px]">
            tentos {player.bid} · fez {player.tricksWon}
          </span>
        ) : isCurrentBidder ? (
          <span className="font-display italic text-gold text-[11px] animate-pulse">declarando…</span>
        ) : null}
        <Dots points={player.points} small />
        {!player.eliminated && player.hand.length > 0 && (
          <div className="flex -space-x-3.5">
            {showCards
              ? sortedHand.map((card) => (
                  <CardComponent
                    key={card.id}
                    card={card}
                    isManilha={card.value === manilhaValue}
                    size={bigCards ? 'md' : 'xs'}
                  />
                ))
              : sortedHand.map((_, i) => <CardBack key={i} size={bigCards ? 'md' : 'xs'} />)}
          </div>
        )}
      </div>
    );
  }

  // Human player — fanned hand (+ info row unless composed externally)
  const cardSize: CardSize = xlCards ? 'xl' : 'lg';
  const overlap = handOverlap(sortedHand.length, !!xlCards);

  const fan = !player.eliminated && (
    <div className={`flex items-end justify-center pt-2.5 ${overlap}`}>
      {sortedHand.map((card, i) => {
        const selected = card.id === selectedCardId;
        return (
          <div
            key={card.id}
            className={`transition-transform duration-150 ${selected ? 'z-10' : ''}`}
            style={{ transform: fanTransform(i, sortedHand.length, selected) }}
          >
            {showCards ? (
              <CardComponent
                card={card}
                isManilha={card.value === manilhaValue}
                selected={selected}
                clickable={!!onCardClick}
                onClick={() => onCardClick?.(card.id)}
                size={cardSize}
              />
            ) : (
              <CardBack
                size={cardSize}
                selected={selected}
                clickable={!!onCardClick}
                onClick={() => onCardClick?.(card.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  if (handOnly) return <div className={elim}>{fan}</div>;

  return (
    <div className={`flex flex-col items-center gap-2 w-full ${elim}`}>
      <div className="flex justify-between items-center w-full px-1.5">
        <span className="text-cream text-[13px] font-semibold">
          {player.name}
          {player.bid !== null && ` · tentos ${player.bid} · fez ${player.tricksWon}`}
          {isDealer && <span className="text-gold font-bold tracking-[1.5px] text-[10px]"> · CARTEIA</span>}
        </span>
        <Dots points={player.points} />
      </div>
      {fan}
    </div>
  );
}
