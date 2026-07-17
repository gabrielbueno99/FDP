'use client';
import { useState } from 'react';
import { isMusicOn, setMusicOn } from '../lib/music';

export function MusicToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && isMusicOn());

  const toggle = () => {
    const next = !on;
    setMusicOn(next); // the click itself is the gesture that unlocks playback
    setOn(next);
  };

  return (
    <button
      onClick={toggle}
      title={on ? 'Pausar música' : 'Tocar jazz de fundo'}
      aria-label={on ? 'Pausar música' : 'Tocar jazz de fundo'}
      className={`transition-colors ${on ? 'text-gold hover:text-gold' : 'text-cream/45 hover:text-gold'} ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
        {!on && <line x1="2" y1="2" x2="22" y2="22" />}
      </svg>
    </button>
  );
}
