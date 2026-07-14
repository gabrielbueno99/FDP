'use client';

interface BidPanelProps {
  cardsInRound: number;
  forbiddenBid: number | null;
  onBid: (bid: number) => void;
  tentoDiff: number;
  bidsPlaced: number;
}

export function BidPanel({ cardsInRound, forbiddenBid, onBid, tentoDiff, bidsPlaced }: BidPanelProps) {
  return (
    <div className="bg-black/40 border border-blue-900/40 rounded-2xl p-4 flex flex-col items-center gap-3 backdrop-blur-sm shadow-xl">
      <p className="text-cyan-300 font-semibold text-sm tracking-wide">
        Quantos tentos você vai fazer?
      </p>

      {bidsPlaced > 0 && (
        <div className={`text-xs px-3 py-1 rounded-full border font-bold ${
          tentoDiff > 0
            ? 'bg-red-950/60 border-red-700/40 text-red-400'
            : tentoDiff < 0
              ? 'bg-yellow-950/60 border-yellow-700/40 text-yellow-400'
              : 'bg-green-950/60 border-green-700/40 text-green-400'
        }`}>
          {tentoDiff > 0
            ? `Sobra ${tentoDiff} tento${tentoDiff > 1 ? 's' : ''}`
            : tentoDiff < 0
              ? `Falta ${Math.abs(tentoDiff)} tento${Math.abs(tentoDiff) > 1 ? 's' : ''}`
              : 'Fechado!'}
        </div>
      )}

      {forbiddenBid !== null && (
        <p className="text-red-400/80 text-xs">
          Não pode declarar {forbiddenBid}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5 justify-center">
        {Array.from({ length: cardsInRound + 1 }, (_, i) => {
          const isForbidden = i === forbiddenBid;
          return (
            <button
              key={i}
              disabled={isForbidden}
              onClick={() => onBid(i)}
              className={[
                'w-11 h-11 rounded-full font-bold text-sm transition-all border shadow',
                isForbidden
                  ? 'bg-gray-900/50 text-gray-600 border-gray-700/30 cursor-not-allowed opacity-40'
                  : 'bg-cyan-800 hover:bg-cyan-600 text-cyan-100 border-cyan-700/60 hover:scale-110 active:scale-95 hover:shadow-[0_0_12px_rgba(0,212,255,0.3)]',
              ].join(' ')}
            >
              {i}
            </button>
          );
        })}
      </div>
    </div>
  );
}
