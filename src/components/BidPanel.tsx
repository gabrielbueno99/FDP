'use client';

interface BidPanelProps {
  cardsInRound: number;
  forbiddenBid: number | null;
  onBid: (bid: number) => void;
}

export function BidPanel({ cardsInRound, forbiddenBid, onBid }: BidPanelProps) {
  return (
    <div className="bg-black/35 border border-amber-800/40 rounded-2xl p-4 flex flex-col items-center gap-3 backdrop-blur-sm shadow-xl">
      <p className="text-amber-300 font-semibold text-sm tracking-wide">
        Quantos tentos você vai fazer?
      </p>
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
                  : 'bg-amber-700 hover:bg-amber-500 text-amber-100 border-amber-600/70 hover:scale-110 active:scale-95 hover:shadow-[0_0_10px_rgba(251,191,36,0.25)]',
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
