'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CriarSala() {
  const [name, setName] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [roomCode] = useState(() => generateRoomCode());
  const router = useRouter();

  const handleCreate = () => {
    if (!name.trim()) return;
    sessionStorage.setItem('fdp-name', name.trim());
    sessionStorage.setItem('fdp-playercount', String(playerCount));
    sessionStorage.setItem('fdp-host-room', roomCode);
    router.push(`/sala/${roomCode}`);
  };

  return (
    <div className="min-h-screen lobby-bg flex flex-col items-center justify-center p-7 gap-6">
      <button
        onClick={() => router.push('/')}
        className="self-start text-cream/50 hover:text-gold text-sm transition-colors"
      >
        ← Voltar
      </button>

      <div className="flex flex-col items-center gap-1.5">
        <span className="font-display italic text-gold text-base">monte sua mesa</span>
        <h1 className="font-display text-cream text-5xl leading-none">Criar sala</h1>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <label className="text-cream/55 text-[11px] tracking-[2px] pl-1">SEU NOME NA MESA</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Como te chamamos?"
            maxLength={16}
            className="h-[54px] rounded-xl bg-white/5 border border-gold/40 text-cream px-[18px] outline-none focus:border-gold transition-colors placeholder:text-cream/30"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-cream/55 text-[11px] tracking-[2px] pl-1 text-center">
            LUGARES NA MESA
          </label>
          <div className="flex gap-2 justify-center flex-wrap">
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                onClick={() => setPlayerCount(n)}
                className={[
                  'w-11 h-11 rounded-[10px] text-[15px] transition-all',
                  playerCount === n
                    ? 'bg-gold text-ink font-bold'
                    : 'border border-gold/30 text-cream/60 hover:border-gold/60 hover:text-cream',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-cream/45 text-xs text-center">vagas extras preenchidas por bots</p>
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="btn-gold h-13 rounded-xl font-bold text-base transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Abrir a mesa
        </button>
      </div>
    </div>
  );
}
