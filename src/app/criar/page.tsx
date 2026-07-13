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
    router.push(`/sala/${roomCode}`);
  };

  return (
    <div className="min-h-screen wood-bg flex flex-col items-center justify-center p-6 gap-6">
      <button
        onClick={() => router.push('/')}
        className="self-start text-amber-700/60 hover:text-amber-400 text-sm transition-colors"
      >
        ← Voltar
      </button>

      <h1 className="font-display font-black text-amber-400 text-5xl tracking-widest drop-shadow-[0_0_16px_rgba(251,191,36,0.25)]">
        FDP
      </h1>

      <div className="bg-black/30 border border-amber-800/35 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 backdrop-blur-sm shadow-2xl">
        <h2 className="text-amber-200 font-bold text-xl text-center tracking-wide">Criar Sala Online</h2>

        <div className="flex flex-col gap-2">
          <label className="text-amber-800/70 text-xs uppercase tracking-widest">Seu nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Como te chamamos?"
            maxLength={16}
            className="bg-black/40 border border-amber-800/40 text-amber-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500/70 transition-colors placeholder-amber-900/50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-amber-800/70 text-xs uppercase tracking-widest text-center">
            Total de jogadores
          </label>
          <div className="flex gap-1.5 justify-center flex-wrap">
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                onClick={() => setPlayerCount(n)}
                className={[
                  'w-10 h-10 rounded-xl font-bold text-sm transition-all border',
                  playerCount === n
                    ? 'bg-amber-600 text-white border-amber-500 scale-110 shadow-[0_0_12px_rgba(217,119,6,0.35)]'
                    : 'bg-amber-950/50 text-amber-600 border-amber-800/30 hover:border-amber-600/50 hover:text-amber-300',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-amber-900/50 text-xs text-center">Vagas extras preenchidas por bots</p>
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="bg-green-800 hover:bg-green-700 disabled:bg-amber-950/40 disabled:text-amber-900/40 text-green-100 font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed border border-green-700/40 disabled:border-amber-900/20 shadow-lg"
        >
          Criar Sala
        </button>
      </div>
    </div>
  );
}
