'use client';
import { Card } from '../lib/types';
import { SUIT_SYMBOLS } from '../lib/deck';

interface CardProps {
  card: Card;
  isManilha?: boolean;
  isWinning?: boolean;
  selected?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  dimmed?: boolean;
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const suitColor = (suit: Card['suit']) =>
  suit === 'hearts' || suit === 'diamonds' ? 'text-card-red' : 'text-card-black';

const DIMS: Record<CardSize, string> = {
  xs: 'w-8 h-11 rounded-md',
  sm: 'w-11 h-16 rounded-lg',
  md: 'w-16 h-24 rounded-[10px]',
  lg: 'w-20 h-28 rounded-xl',
  xl: 'w-[104px] h-[150px] rounded-xl',
};

export function CardComponent({ card, isManilha, isWinning, selected, clickable, onClick, size = 'md', dimmed }: CardProps) {
  const sym = SUIT_SYMBOLS[card.suit];
  const color = suitColor(card.suit);

  const padding = size === 'xs' ? 'p-1' : size === 'sm' ? 'p-1.5' : size === 'xl' ? 'p-2.5' : 'p-2';
  const rankText =
    size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-base' : size === 'md' ? 'text-2xl' : size === 'lg' ? 'text-3xl' : 'text-[32px]';
  const suitText =
    size === 'xs' ? 'text-[9px]' : size === 'sm' ? 'text-xs' : size === 'md' ? 'text-base' : size === 'lg' ? 'text-lg' : 'text-[21px]';
  const centerSym = size === 'md' ? 'text-3xl' : size === 'lg' ? 'text-4xl' : 'text-5xl';

  const badge = size === 'xs' ? 'hidden' : size === 'sm' ? 'text-[6px] px-1 -top-1.5' : 'text-[7px] px-1.5 -top-2';

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={[
        'relative bg-card border select-none flex flex-col transition-all duration-150',
        padding,
        DIMS[size],
        // Manilha gets its own unmistakable look — a warm gold glow — so it never
        // reads as merely "selected".
        isManilha
          ? 'border-transparent outline-2 outline-gold shadow-[0_0_0_2px_rgba(201,165,90,0.55),0_0_22px_6px_rgba(201,165,90,0.45),0_10px_26px_rgba(0,0,0,0.55)] -translate-y-0.5'
          : selected || isWinning
            ? 'border-transparent outline-2 outline-gold shadow-[0_10px_26px_rgba(0,0,0,0.55)]'
            : 'border-black/10 shadow-[0_6px_18px_rgba(0,0,0,0.45)]',
        clickable ? 'cursor-pointer hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/60 hover:z-10' : '',
        dimmed ? 'opacity-55' : '',
      ].join(' ')}
    >
      {isManilha && (
        <span
          className={`absolute right-1 ${badge} bg-gold text-ink font-bold tracking-[1px] rounded-full leading-[1.5] shadow`}
        >
          MANILHA
        </span>
      )}
      <span className={`font-display leading-none ${color} ${rankText}`}>{card.value}</span>
      <span className={`leading-none ${color} ${suitText}`}>{sym}</span>
      {(size === 'md' || size === 'lg' || size === 'xl') && (
        <span className={`font-display m-auto leading-none ${color} ${centerSym}`}>{sym}</span>
      )}
    </div>
  );
}

export function CardBack({
  size = 'md',
  selected,
  clickable,
  onClick,
}: {
  size?: CardSize;
  selected?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={[
        DIMS[size],
        'card-back shadow-md flex items-center justify-center relative overflow-hidden select-none transition-all duration-150',
        selected ? 'outline-2 outline-gold' : '',
        clickable ? 'cursor-pointer hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/60 hover:z-10' : '',
      ].join(' ')}
    >
      <span className={`text-gold/25 select-none ${size === 'xs' ? 'text-base' : 'text-2xl'}`}>♦</span>
    </div>
  );
}
