'use client';
import { useEffect, useRef, useState } from 'react';
import { TURN_SECONDS } from '../lib/game';
import { playSound } from '../lib/sounds';

// Purely visual countdown — the actual auto-play is enforced in the hooks
// (solo) / host (online). The parent gives it a `key` per turn so it remounts
// fresh each time instead of resetting state inside an effect.
export function TurnTimer({ warnSound }: { warnSound?: boolean }) {
  const [left, setLeft] = useState(TURN_SECONDS);
  const warned = useRef(false);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, TURN_SECONDS - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (warnSound && remaining <= 5 && remaining > 0 && !warned.current) {
        warned.current = true;
        playSound('warning');
      }
      if (remaining <= 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [warnSound]);

  const pct = (left / TURN_SECONDS) * 100;
  const urgent = left <= 5;

  return (
    <div className="flex items-center gap-2 w-full max-w-[220px]">
      <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-250 ease-linear ${urgent ? 'bg-danger' : 'bg-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums font-semibold ${urgent ? 'text-danger' : 'text-cream/60'}`}>
        {left}s
      </span>
    </div>
  );
}
