'use client';
import { useEffect, useRef, useState } from 'react';
import { GameState } from '../lib/types';

interface RoundSummaryProps {
  state: GameState;
  onNext: () => void;
  isMultiplayer?: boolean;
}

const AUTO_ADVANCE_SECS = 5;

export function RoundSummary({ state, onNext, isMultiplayer }: RoundSummaryProps) {
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

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-blue-950/95 border-2 border-cyan-700/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="font-display font-black text-cyan-200 text-2xl text-center mb-1">
          Fim da Rodada {round}
        </h2>
        <p className="text-blue-700/60 text-xs text-center mb-5 uppercase tracking-widest">
          {round} de {maxRounds} rodadas
        </p>

        <div className="space-y-2.5 mb-5">
          {roundResults.map((r) => {
            const player = players.find((p) => p.id === r.playerId);
            return (
              <div
                key={r.playerId}
                className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                  r.lostPoint
                    ? 'bg-red-950/50 border-red-800/40'
                    : 'bg-green-950/50 border-green-800/40'
                }`}
              >
                <div>
                  <div className="text-slate-100 font-semibold text-sm">{r.name}</div>
                  <div className="text-blue-600/70 text-xs">
                    Declarou {r.bid} · Fez {r.tricksWon}
                  </div>
                  {r.newlyEliminated && (
                    <div className="text-red-400 text-xs font-bold mt-0.5">ELIMINADO!</div>
                  )}
                </div>
                <div className="text-right">
                  {r.lostPoint ? (
                    <span className="text-red-400 font-bold text-sm">−1 ponto</span>
                  ) : (
                    <span className="text-green-400 font-bold text-sm">✓</span>
                  )}
                  <div className="flex gap-1 justify-end mt-1.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full border ${
                          i < (player?.points ?? 0)
                            ? 'bg-cyan-400 border-cyan-300'
                            : 'bg-transparent border-blue-900/40'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-blue-900/40 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-cyan-500/70 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / AUTO_ADVANCE_SECS) * 100}%` }}
          />
        </div>

        <button
          onClick={onNext}
          className="w-full bg-cyan-700 hover:bg-cyan-600 text-cyan-100 font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg border border-cyan-600/50"
        >
          {isMultiplayer ? `Pronto (${countdown}s)` : `Próxima Rodada (${countdown}s)`}
        </button>
      </div>
    </div>
  );
}
