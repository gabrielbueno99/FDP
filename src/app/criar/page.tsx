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
    <div className="min-h-screen wood-bg flex flex-col items-center justify-center p-6 gap-6">
      <button
        onClick={() => router.push('/')}
        className="self-start text-blue-700/60 hover:text-cyan-400 text-sm transition-colors"
      >
        ← Voltar
      </button>

      <h1 className="font-display font-black text-cyan-400 text-5xl tracking-widest drop-shadow-[0_0_16px_rgba(0,212,255,0.3)]">
        FDP
      </h1>

      <div className="bg-black/35 border border-blue-900/35 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 backdrop-blur-sm shadow-2xl">
        <h2 className="text-cyan-200 font-bold text-xl text-center tracking-wide">Criar Sala Online</h2>

        <div className="flex flex-col gap-2">
          <label className="text-blue-700/70 text-xs uppercase tracking-widest">Seu nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Como te chamamos?"
            maxLength={16}
            className="bg-black/40 border border-blue-800/40 text-slate-100 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/70 transition-colors placeholder-blue-900/50"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-blue-700/70 text-xs uppercase tracking-widest text-center">
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
                    ? 'bg-cyan-700 text-white border-cyan-600 scale-110 shadow-[0_0_12px_rgba(0,212,255,0.3)]'
                    : 'bg-blue-950/50 text-blue-500 border-blue-800/30 hover:border-cyan-700/50 hover:text-cyan-300',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-blue-800/50 text-xs text-center">Vagas extras preenchidas por bots</p>
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-blue-950/40 disabled:text-blue-900/40 text-cyan-100 font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed border border-cyan-600/40 disabled:border-blue-900/20 shadow-lg"
        >
          Criar Sala
        </button>
      </div>
    </div>
  );
}
