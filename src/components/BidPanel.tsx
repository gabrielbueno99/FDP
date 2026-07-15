'use client';
import { useState } from 'react';

interface BidPanelProps {
  cardsInRound: number;
  forbiddenBid: number | null;
  onBid: (bid: number) => void;
  tentoDiff: number;
  bidsPlaced: number;
}

export function BidPanel({ cardsInRound, forbiddenBid, onBid, tentoDiff, bidsPlaced }: BidPanelProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center gap-4 py-2 w-full">
      <div className="text-center flex flex-col gap-1.5">
        <span className="font-display text-cream text-2xl leading-tight">
          Quantos tentos você faz?
        </span>
        {bidsPlaced > 0 && (
          <span className="self-center px-3.5 py-1 rounded-full border border-gold/40 text-gold text-xs font-semibold">
            {tentoDiff === 0
              ? 'conta fechada, alguém vai errar'
              : tentoDiff > 0
                ? `sobra${tentoDiff > 1 ? 'm' : ''} ${tentoDiff} tento${tentoDiff > 1 ? 's' : ''} declarado${tentoDiff > 1 ? 's' : ''}`
                : `falta${Math.abs(tentoDiff) > 1 ? 'm' : ''} ${Math.abs(tentoDiff)} tento${Math.abs(tentoDiff) > 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        {Array.from({ length: cardsInRound + 1 }, (_, i) => {
          const isForbidden = i === forbiddenBid;
          const isSelected = i === selected;
          return (
            <button
              key={i}
              disabled={isForbidden}
              onClick={() => setSelected(i)}
              className={[
                'w-14 h-14 rounded-full font-display text-2xl transition-all',
                isForbidden
                  ? 'border border-gold/15 text-cream/30 cursor-not-allowed'
                  : isSelected
                    ? 'btn-gold text-ink shadow-[0_6px_18px_rgba(201,165,90,0.35)]'
                    : 'border border-gold/40 text-cream hover:border-gold active:scale-95',
              ].join(' ')}
            >
              {i}
            </button>
          );
        })}
      </div>

      {forbiddenBid !== null && (
        <p className="text-cream/45 text-xs text-center">
          {forbiddenBid} está bloqueado pra você — o carteador não pode fechar a conta
        </p>
      )}

      <button
        onClick={() => selected !== null && onBid(selected)}
        disabled={selected === null}
        className="btn-gold h-13 w-60 rounded-xl font-bold text-base transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {selected === null ? 'Escolha seus tentos' : `Declarar ${selected} tento${selected === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}
