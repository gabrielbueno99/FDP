'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CriarSala() {
  const [name, setName] = useState('');
  const [roomCode] = useState(() => generateRoomCode());
  const router = useRouter();

  const handleCreate = () => {
    if (!name.trim()) return;
    sessionStorage.setItem('fdp-name', name.trim());
    sessionStorage.setItem('fdp-host-room', roomCode);
    router.push(`/sala/${roomCode}`);
  };

  return (
    <div className="min-h-screen lobby-bg relative flex flex-col items-center justify-center p-7">
      <button
        onClick={() => router.push('/')}
        className="absolute top-6 left-6 text-cream/50 hover:text-gold text-sm transition-colors"
      >
        ← Voltar
      </button>

      <div className="flex flex-col items-center gap-1.5">
        <span className="font-display italic text-gold text-base">monte sua mesa</span>
        <h1 className="font-display text-cream text-5xl leading-none">Criar sala</h1>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4 mt-9">
        <div className="flex flex-col gap-2">
          <label className="text-cream/55 text-[11px] tracking-[2px] pl-1">SEU NOME NA MESA</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Como te chamamos?"
            maxLength={16}
            autoFocus
            className="h-[54px] rounded-xl bg-white/5 border border-gold/40 text-cream px-[18px] outline-none focus:border-gold transition-colors placeholder:text-cream/30"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="btn-gold h-13 rounded-xl font-bold text-base transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Abrir a mesa
        </button>

        <p className="text-cream/45 text-xs text-center leading-normal">
          Você abre a mesa e compartilha o código. Quando a galera
          <br />
          entrar, você começa o jogo — a partir de 2 jogadores.
        </p>
      </div>
    </div>
  );
}
