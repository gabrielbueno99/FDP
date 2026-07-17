'use client';
import { useState } from 'react';
import { isMuted, setMuted } from '../lib/sounds';

export function SoundToggle({ className = '' }: { className?: string }) {
  const [muted, setMutedState] = useState(() => typeof window !== 'undefined' && isMuted());

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <button
      onClick={toggle}
      title={muted ? 'Ativar sons' : 'Silenciar'}
      aria-label={muted ? 'Ativar sons' : 'Silenciar'}
      className={`text-cream/45 hover:text-gold transition-colors ${className}`}
    >
      {muted ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 5a9 9 0 0 1 0 14" />
        </svg>
      )}
    </button>
  );
}
