'use client';
import { useEffect, useRef, useState } from 'react';
import { GameState } from '../lib/types';
import { avatarColor, initials } from './PlayerArea';

interface RoundSummaryProps {
  state: GameState;
  humanId: number;
  onNext: () => void;
  isMultiplayer?: boolean;
}

const AUTO_ADVANCE_SECS = 5;

export function RoundSummary({ state, humanId, onNext, isMultiplayer }: RoundSummaryProps) {
  const { roundResults, players, round, maxRounds } = state;
  const [countdown, setCountdown] = useState(AUTO_ADVANCE_SECS);
  const onNextRef = useRef(onNext);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onNextRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mine = roundResults.find((r) => r.playerId === humanId);
  const eliminatedNow = roundResults.filter((r) => r.newlyEliminated);
  const remaining = players.filter((p) => !p.eliminated).length;

  return (
    <div className="fixed inset-0 bg-[rgba(7,20,16,0.88)] backdrop-blur-[3px] flex items-center justify-center z-50 p-5">
      <div className="w-full max-w-md flex flex-col">
        <div className="flex justify-between items-center">
          <span className="font-display text-cream text-xl">FDP</span>
          <span className="text-cream/60 text-xs tracking-[1px]">
            FIM DA RODADA {round} DE {maxRounds}
          </span>
        </div>

        {mine && (
          <div className="text-center mt-8 mb-7 flex flex-col gap-1.5">
            <span className="font-display text-cream text-4xl leading-tight">
              {mine.lostPoint ? `Prometeu ${mine.bid}, fez ${mine.tricksWon}.` : 'Você cravou.'}
            </span>
            <span className={`font-display italic text-[17px] ${mine.lostPoint ? 'text-danger' : 'text-gold'}`}>
              {mine.lostPoint
                ? 'menos uma vida, FDP'
                : `declarou ${mine.bid}, fez ${mine.tricksWon} — mantém as vidas`}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {roundResults.map((r) => {
            const player = players.find((p) => p.id === r.playerId);
            const points = player?.points ?? 0;
            return (
              <div
                key={r.playerId}
                className={`flex items-center gap-3 rounded-[14px] px-4 py-3.5 border ${
                  r.lostPoint
                    ? 'bg-card-red/10 border-card-red/45'
                    : 'bg-white/[0.04] border-gold/35'
                }`}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-cream shrink-0"
                  style={{ background: avatarColor(r.playerId) }}
                >
                  {initials(r.name)}
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-cream font-semibold text-sm truncate">{r.name}</span>
                  <span className="text-cream/60 text-xs">
                    {r.bid} declarado{r.bid === 1 ? '' : 's'} · {r.tricksWon} feito{r.tricksWon === 1 ? '' : 's'}
                  </span>
                  {r.newlyEliminated && (
                    <span className="text-danger text-[10.5px] font-bold tracking-[1.5px]">ELIMINADO</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-semibold ${r.lostPoint ? 'text-danger' : 'text-ok'}`}>
                    {r.lostPoint ? '−1 vida' : 'cravou'}
                  </span>
                  <div className="flex gap-[3px]">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={`w-[7px] h-[7px] rounded-full ${
                          i < points
                            ? 'bg-gold'
                            : r.lostPoint && i === points
                              ? 'bg-card-red shadow-[0_0_8px_rgba(176,52,52,0.6)]'
                              : 'bg-white/15'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {eliminatedNow.length > 0 && (
            <p className="text-center text-cream/50 text-[12.5px]">
              {eliminatedNow.map((r) => r.name).join(', ')}{' '}
              {eliminatedNow.length > 1 ? 'foram eliminados' : 'foi eliminado'} — {remaining} segue
              {remaining > 1 ? 'm' : ''} na mesa
            </p>
          )}
          <div className="h-[3px] rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / AUTO_ADVANCE_SECS) * 100}%` }}
            />
          </div>
          <button
            onClick={onNext}
            className="btn-gold h-13 rounded-xl font-bold text-base transition-all hover:brightness-110 active:scale-95"
          >
            {isMultiplayer
              ? `Pronto · ${countdown}s`
              : `Próxima rodada · ${Math.min(round + 1, maxRounds)} carta${round + 1 > 1 ? 's' : ''} · ${countdown}s`}
          </button>
        </div>
      </div>
    </div>
  );
}
