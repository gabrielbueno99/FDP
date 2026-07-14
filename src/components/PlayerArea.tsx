'use client';
import { Player, Value } from '../lib/types';
import { CardBack, CardComponent } from './CardComponent';
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
  small?: boolean;
  bigCards?: boolean;
  seat?: boolean;
  playOrder?: number;
  hasPlayedInTrick?: boolean;
}


function Dots({ points, small }: { points: number; small?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`rounded-full border transition-all ${small ? 'w-2 h-2' : 'w-3 h-3'} ${
            i < points
              ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_4px_rgba(0,212,255,0.5)]'
              : 'bg-transparent border-blue-900/40'
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
  bigCards,
  seat,
  playOrder,
  hasPlayedInTrick,
}: PlayerAreaProps) {
  const sortedHand = manilhaValue
    ? [...player.hand].sort((a, b) => getCardStrength(b, manilhaValue) - getCardStrength(a, manilhaValue))
    : [...player.hand];

  const highlight =
    isCurrentPlayer || isCurrentBidder
      ? 'ring-2 ring-cyan-400/70 ring-offset-1 ring-offset-transparent'
      : isTrickWinner
      ? 'ring-2 ring-green-400/70 ring-offset-1 ring-offset-transparent'
      : '';

  const elim = player.eliminated ? 'opacity-25' : '';

  if (compact) {
    return (
      <div className={`${highlight} ${elim}`}>
        {/* Mobile: horizontal pill with xs cards — hidden in seat mode */}
        <div className={`${seat ? 'hidden' : 'sm:hidden'} flex items-center gap-2.5 rounded-xl px-3 py-2 bg-black/30 border border-blue-900/30`}>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-slate-100 font-semibold text-xs truncate max-w-[72px]">
                {player.name}
              </span>
              {isDealer && (
                <span className="bg-cyan-800 text-cyan-100 text-[8px] font-black px-1 py-px rounded-full leading-none">
                  D
                </span>
              )}
              {playOrder !== undefined && (
                <span className={`text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border leading-none ${
                  hasPlayedInTrick
                    ? 'bg-green-900/60 text-green-400 border-green-700/40'
                    : 'bg-blue-900/70 text-cyan-300 border-blue-700/50'
                }`}>
                  {playOrder}
                </span>
              )}
            </div>
            <Dots points={player.points} small />
            {player.bid !== null && (
              <div className="flex items-center gap-0.5 bg-black/40 border border-blue-800/30 rounded-full px-2 py-0.5 self-start">
                <span className="text-cyan-300 font-black text-xs">{player.bid}</span>
                <span className="text-blue-700/50 text-[10px]">/</span>
                <span className="text-green-400 font-black text-xs">{player.tricksWon}</span>
              </div>
            )}
            {isCurrentBidder && player.bid === null && (
              <span className="text-cyan-400 text-[10px] animate-pulse">Decl...</span>
            )}
          </div>
          {!player.eliminated && (
            <div className="flex gap-0.5 flex-shrink-0">
              {showCards
                ? sortedHand.map((card) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      isManilha={card.value === manilhaValue}
                      size="xs"
                    />
                  ))
                : sortedHand.map((_, i) => <CardBack key={i} size="xs" />)}
            </div>
          )}
        </div>

        {/* Desktop: column layout — always shown in seat mode */}
        <div className={`${seat ? 'flex' : 'hidden sm:flex'} flex-col items-center gap-2 rounded-xl px-3 py-2 bg-black/30 border border-blue-900/30`}>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-100 font-semibold text-sm">{player.name}</span>
            {isDealer && (
              <span className="bg-cyan-800 text-cyan-100 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                D
              </span>
            )}
            {player.eliminated && <span className="text-red-400 text-xs font-bold">✕</span>}
            {playOrder !== undefined && (
              <span className={`text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border leading-none ${
                hasPlayedInTrick
                  ? 'bg-green-900/60 text-green-400 border-green-700/40'
                  : 'bg-blue-900/70 text-cyan-300 border-blue-700/50'
              }`}>
                {playOrder}
              </span>
            )}
          </div>
          <Dots points={player.points} small={small} />
          {player.bid !== null && (
            <div className="flex items-center gap-1 bg-black/40 border border-blue-800/30 rounded-full px-2 py-0.5">
              <span className="text-cyan-300 font-black text-xs">{player.bid}</span>
              <span className="text-blue-700/50 text-[10px] mx-0.5">·</span>
              <span className="text-green-400 font-black text-xs">{player.tricksWon}</span>
            </div>
          )}
          {isCurrentBidder && player.bid === null && (
            <div className="text-cyan-400 text-xs animate-pulse">Declarando...</div>
          )}
          {!player.eliminated && (
            <div className="flex gap-0.5 flex-wrap justify-center">
              {showCards
                ? sortedHand.map((card) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      isManilha={card.value === manilhaValue}
                      size={bigCards ? 'md' : small ? 'xs' : 'sm'}
                    />
                  ))
                : sortedHand.map((_, i) => <CardBack key={i} size={bigCards ? 'md' : small ? 'xs' : 'sm'} />)}
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
        bg-black/30 border border-blue-900/30 backdrop-blur-sm w-full
        ${elim} ${highlight}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-slate-100 font-semibold text-sm">{player.name}</span>
        {isDealer && (
          <span className="bg-cyan-800 text-cyan-100 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
            D
          </span>
        )}
        {player.eliminated && <span className="text-red-400 text-xs font-bold">✕</span>}
        {playOrder !== undefined && (
          <span className={`text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border leading-none ${
            hasPlayedInTrick
              ? 'bg-green-900/60 text-green-400 border-green-700/40'
              : 'bg-blue-900/70 text-cyan-300 border-blue-700/50'
          }`}>
            {playOrder}
          </span>
        )}
      </div>

      <Dots points={player.points} />

      {player.bid !== null && (
        <div className="flex items-center gap-1.5 bg-black/40 border border-blue-800/30 rounded-full px-4 py-1.5">
          <span className="text-blue-600/60 text-xs uppercase tracking-wider">Tentos</span>
          <span className="text-cyan-300 font-black text-lg leading-none">{player.bid}</span>
          <span className="text-blue-700/50 text-sm mx-0.5">·</span>
          <span className="text-green-400 font-black text-lg leading-none">{player.tricksWon}</span>
          <span className="text-green-800/50 text-xs uppercase tracking-wider">ganhos</span>
        </div>
      )}

      {isCurrentBidder && player.bid === null && (
        <div className="text-cyan-400 text-xs font-semibold animate-pulse">Declarando...</div>
      )}

      {!player.eliminated && (
        <div className="flex gap-1.5 justify-center py-2">
          {showCards
            ? sortedHand.map((card) => (
                <CardComponent
                  key={card.id}
                  card={card}
                  isManilha={card.value === manilhaValue}
                  clickable={!!onCardClick}
                  onClick={() => onCardClick?.(card.id)}
                  size="lg"
                />
              ))
            : sortedHand.map((card, i) => (
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
