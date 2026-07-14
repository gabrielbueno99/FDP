'use client';
import { Card } from '../lib/types';
import { SUIT_SYMBOLS } from '../lib/deck';

interface CardProps {
  card: Card;
  isManilha?: boolean;
  isWinning?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  dimmed?: boolean;
}

const suitColor = (suit: Card['suit']) =>
  suit === 'hearts' || suit === 'diamonds' ? 'text-red-600' : 'text-gray-900';

export function CardComponent({ card, isManilha, isWinning, clickable, onClick, size = 'md', dimmed }: CardProps) {
  const sym = SUIT_SYMBOLS[card.suit];
  const color = suitColor(card.suit);

  const dims = {
    xs: 'w-8 h-11',
    sm: 'w-11 h-16',
    md: 'w-16 h-24',
    lg: 'w-20 h-28',
  }[size];

  const padding = size === 'xs' || size === 'sm' ? 'p-0.5' : 'p-1.5';
  const centerSym = size === 'xs' ? 'text-sm' : size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-3xl';
  const cornerText = size === 'xs' ? 'text-[7px]' : size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-xs' : 'text-sm';

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={[
        'relative rounded-lg border select-none flex flex-col justify-between transition-all duration-150',
        padding,
        dims,
        isManilha
          ? 'border-amber-400 shadow-[0_0_14px_3px_rgba(251,191,36,0.45)] bg-amber-50'
          : isWinning
            ? 'border-emerald-400 shadow-[0_0_14px_4px_rgba(52,211,153,0.5)] bg-white ring-2 ring-emerald-400/70'
            : 'border-gray-200/80 shadow-lg bg-white',
        clickable
          ? 'cursor-pointer hover:scale-110 hover:-translate-y-4 hover:shadow-2xl hover:shadow-black/60 hover:z-10'
          : '',
        dimmed ? 'opacity-30' : '',
      ].join(' ')}
    >
      <div className={`font-bold leading-none ${color} ${cornerText}`}>
        <div>{card.value}</div>
        <div>{sym}</div>
      </div>
      <div className={`text-center leading-none ${color} ${centerSym}`}>{sym}</div>
      <div className={`font-bold leading-none rotate-180 ${color} ${cornerText}`}>
        <div>{card.value}</div>
        <div>{sym}</div>
      </div>
      {isManilha && (
        <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-amber-900 text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow border border-amber-200">
          M
        </div>
      )}
    </div>
  );
}

export function CardBack({
  size = 'md',
  clickable,
  onClick,
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  clickable?: boolean;
  onClick?: () => void;
}) {
  const dims = {
    xs: 'w-8 h-11',
    sm: 'w-11 h-16',
    md: 'w-16 h-24',
    lg: 'w-20 h-28',
  }[size];

  const innerPad = size === 'xs' ? 'inset-1' : 'inset-1.5';
  const innerPad2 = size === 'xs' ? 'inset-1.5' : 'inset-2.5';
  const symSize = size === 'xs' ? 'text-base' : 'text-2xl';

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={[
        dims,
        'rounded-lg border-2 border-amber-700/50 bg-gradient-to-br from-green-900 via-green-950 to-green-900 shadow-md flex items-center justify-center relative overflow-hidden select-none transition-all duration-150',
        clickable ? 'cursor-pointer hover:scale-110 hover:-translate-y-3 hover:shadow-2xl hover:shadow-black/60 hover:z-10' : '',
      ].join(' ')}
    >
      <div className={`absolute ${innerPad} border border-amber-600/35 rounded-md pointer-events-none`} />
      <div className={`absolute ${innerPad2} border border-amber-600/20 rounded pointer-events-none`} />
      <span className={`text-amber-600/25 ${symSize} select-none`}>♦</span>
    </div>
  );
}
