'use client';
import { Player, Value } from '../lib/types';
import { CardBack, CardComponent } from './CardComponent';

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
  small?: boolean;
  seat?: boolean;
}

function Dots({ points, small }: { points: number; small?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`rounded-full border transition-all ${small ? 'w-2 h-2' : 'w-3 h-3'} ${
            i < points
              ? 'bg-amber-400 border-amber-300 shadow-[0_0_4px_rgba(251,191,36,0.5)]'
              : 'bg-transparent border-amber-800/30'
          }`}
        />
      ))}
    </div>
  );
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
  small,
  seat,
}: PlayerAreaProps) {
  const highlight =
    isCurrentPlayer || isCurrentBidder
      ? 'ring-2 ring-amber-400/70 ring-offset-1 ring-offset-transparent'
      : isTrickWinner
      ? 'ring-2 ring-green-400/70 ring-offset-1 ring-offset-transparent'
      : '';

  const elim = player.eliminated ? 'opacity-25' : '';

  if (compact) {
    return (
      <div className={`${highlight} ${elim}`}>
        {/* Mobile: horizontal pill with xs cards — hidden in seat mode */}
        <div className={`${seat ? 'hidden' : 'sm:hidden'} flex items-center gap-2.5 rounded-xl px-3 py-2 bg-black/25 border border-amber-900/25`}>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-amber-100 font-semibold text-xs truncate max-w-[72px]">
                {player.name}
              </span>
              {isDealer && (
                <span className="bg-amber-700 text-amber-100 text-[8px] font-black px-1 py-px rounded-full leading-none">
                  D
                </span>
              )}
            </div>
            <Dots points={player.points} small />
            {player.bid !== null && (
              <div className="flex items-center gap-0.5 bg-black/40 border border-amber-700/30 rounded-full px-2 py-0.5 self-start">
                <span className="text-amber-300 font-black text-xs">{player.bid}</span>
                <span className="text-amber-800/50 text-[10px]">/</span>
                <span className="text-green-400 font-black text-xs">{player.tricksWon}</span>
              </div>
            )}
            {isCurrentBidder && player.bid === null && (
              <span className="text-amber-400 text-[10px] animate-pulse">Decl...</span>
            )}
          </div>
          {!player.eliminated && (
            <div className="flex gap-0.5 flex-shrink-0">
              {showCards
                ? player.hand.map((card) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      isManilha={card.value === manilhaValue}
                      size="xs"
                    />
                  ))
                : player.hand.map((_, i) => <CardBack key={i} size="xs" />)}
            </div>
          )}
        </div>

        {/* Desktop: column layout — always shown in seat mode */}
        <div className={`${seat ? 'flex' : 'hidden sm:flex'} flex-col items-center gap-2 rounded-xl px-3 py-2 bg-black/25 border border-amber-900/25`}>
          <div className="flex items-center gap-2">
            <span className="text-amber-100 font-semibold text-sm">{player.name}</span>
            {isDealer && (
              <span className="bg-amber-700 text-amber-100 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                D
              </span>
            )}
            {player.eliminated && <span className="text-red-400 text-xs font-bold">✕</span>}
          </div>
          <Dots points={player.points} small={small} />
          {player.bid !== null && (
            <div className="flex items-center gap-1 bg-black/40 border border-amber-700/30 rounded-full px-2 py-0.5">
              <span className="text-amber-300 font-black text-xs">{player.bid}</span>
              <span className="text-amber-800/50 text-[10px] mx-0.5">·</span>
              <span className="text-green-400 font-black text-xs">{player.tricksWon}</span>
            </div>
          )}
          {isCurrentBidder && player.bid === null && (
            <div className="text-amber-400 text-xs animate-pulse">Declarando...</div>
          )}
          {!player.eliminated && (
            <div className="flex gap-0.5 flex-wrap justify-center">
              {showCards
                ? player.hand.map((card) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      isManilha={card.value === manilhaValue}
                      size={small ? 'xs' : 'sm'}
                    />
                  ))
                : player.hand.map((_, i) => <CardBack key={i} size={small ? 'xs' : 'sm'} />)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full layout — human player
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl px-4 py-3 transition-all
        bg-black/25 border border-amber-900/25 backdrop-blur-sm w-full
        ${elim} ${highlight}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-amber-100 font-semibold text-sm">{player.name}</span>
        {isDealer && (
          <span className="bg-amber-700 text-amber-100 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
            D
          </span>
        )}
        {player.eliminated && <span className="text-red-400 text-xs font-bold">✕</span>}
      </div>

      <Dots points={player.points} />

      {player.bid !== null && (
        <div className="flex items-center gap-1.5 bg-black/40 border border-amber-700/30 rounded-full px-4 py-1.5">
          <span className="text-amber-600/60 text-xs uppercase tracking-wider">Tentos</span>
          <span className="text-amber-300 font-black text-lg leading-none">{player.bid}</span>
          <span className="text-amber-800/50 text-sm mx-0.5">·</span>
          <span className="text-green-400 font-black text-lg leading-none">{player.tricksWon}</span>
          <span className="text-green-800/50 text-xs uppercase tracking-wider">ganhos</span>
        </div>
      )}

      {isCurrentBidder && player.bid === null && (
        <div className="text-amber-400 text-xs font-semibold animate-pulse">Declarando...</div>
      )}

      {!player.eliminated && (
        <div className="flex gap-1.5 justify-center overflow-x-auto pb-1 max-w-full">
          {showCards
            ? player.hand.map((card) => (
                <CardComponent
                  key={card.id}
                  card={card}
                  isManilha={card.value === manilhaValue}
                  clickable={!!onCardClick}
                  onClick={() => onCardClick?.(card.id)}
                  size="lg"
                />
              ))
            : player.hand.map((card, i) => (
                <CardBack
                  key={i}
                  size="lg"
                  clickable={!!onCardClick}
                  onClick={() => onCardClick?.(card.id)}
                />
              ))}
        </div>
      )}
    </div>
  );
}
