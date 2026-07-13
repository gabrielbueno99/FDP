'use client';
import { GameState } from '../lib/types';
import { SUIT_SYMBOLS } from '../lib/deck';
import { CardComponent } from './CardComponent';

interface TrickAreaProps {
  state: GameState;
}

export function TrickArea({ state }: TrickAreaProps) {
  const { currentTrick, vira, manilhaValue, trickWinnerId, players, phase } = state;

  return (
    <div className="flex flex-col items-center gap-4 w-full py-2">
      {vira && (
        <div className="flex items-center gap-4 sm:gap-6 bg-black/20 rounded-xl px-4 sm:px-6 py-3 border border-green-800/30">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-green-600/60 text-[10px] sm:text-xs uppercase tracking-widest font-semibold">Vira</span>
            {/* sm on mobile, md on desktop */}
            <div className="sm:hidden"><CardComponent card={vira} size="sm" /></div>
            <div className="hidden sm:block"><CardComponent card={vira} size="md" /></div>
          </div>
          <span className="text-green-700/40 text-xl sm:text-2xl">→</span>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-green-600/60 text-[10px] sm:text-xs uppercase tracking-widest font-semibold">Manilha</span>
            <div className="bg-amber-400/15 border border-amber-500/40 rounded-xl px-3 sm:px-4 py-2 text-center shadow-[0_0_10px_rgba(251,191,36,0.12)]">
              <div className="text-amber-300 font-display font-black text-2xl sm:text-4xl leading-none">
                {manilhaValue}
              </div>
              <div className="text-amber-600/60 text-[10px] sm:text-sm tracking-wider mt-0.5">
                {SUIT_SYMBOLS.clubs}{SUIT_SYMBOLS.hearts}{SUIT_SYMBOLS.spades}{SUIT_SYMBOLS.diamonds}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentTrick.length > 0 && (
        <div className="w-full">
          <div className="text-center text-green-600/50 text-[10px] sm:text-xs uppercase tracking-widest mb-3 font-semibold">
            {phase === 'trick-end' && trickWinnerId !== null
              ? `${players.find((p) => p.id === trickWinnerId)?.name} ganhou a vaza!`
              : 'Vaza em andamento'}
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-5 justify-center">
            {currentTrick.map(({ playerId, card }) => {
              const player = players.find((p) => p.id === playerId);
              const isWinner = playerId === trickWinnerId;
              return (
                <div key={card.id} className="flex flex-col items-center gap-1.5">
                  <CardComponent card={card} isManilha={card.value === manilhaValue} size="md" />
                  <span className={`text-xs font-semibold ${isWinner ? 'text-green-400' : 'text-green-700/50'}`}>
                    {player?.name}{isWinner && ' ✓'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
