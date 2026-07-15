'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '../hooks/useGame';
import { GameBoard } from '../components/GameBoard';

function JoinByCode() {
  const [code, setCode] = useState('');
  const router = useRouter();

  const handleJoin = () => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length === 5) router.push(`/sala/${normalized}`);
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        placeholder="Código da sala"
        maxLength={5}
        className="flex-1 h-13 bg-white/[0.04] border border-gold/30 text-cream rounded-xl px-4 outline-none focus:border-gold/70 transition-colors placeholder-cream/25 text-center tracking-[0.25em] font-bold uppercase text-sm"
      />
      <button
        onClick={handleJoin}
        disabled={code.trim().length !== 5}
        className="h-13 px-5 rounded-xl border border-gold/45 text-cream font-semibold text-[15px] transition-all hover:bg-white/[0.04] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Entrar
      </button>
    </div>
  );
}

type Screen = 'home' | 'playing';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home');
  const [playerCount, setPlayerCount] = useState(4);
  const router = useRouter();

  const { state, startGame, placeBid, playCard, nextRound, restart, forbiddenBid, isMyTurn, humanId } =
    useGame();

  const handleStartSolo = () => {
    startGame(playerCount, 1);
    setScreen('playing');
  };

  const handleRestart = () => {
    restart();
    setScreen('home');
  };

  if (screen === 'playing' && state.phase !== 'setup') {
    return (
      <GameBoard
        state={state}
        humanId={humanId}
        forbiddenBid={forbiddenBid}
        isMyTurn={isMyTurn}
        onBid={placeBid}
        onCardPlay={playCard}
        onNextRound={nextRound}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <div className="min-h-screen lobby-bg flex flex-col items-center justify-center p-7 gap-0">
      {/* Title */}
      <div className="flex gap-3.5 text-gold text-[15px] tracking-[6px]">♣ ♥ ♠ ♦</div>
      <h1 className="font-display text-cream text-8xl leading-none tracking-wide mt-4">FDP</h1>
      <p className="font-display italic text-gold text-lg mt-1.5">
        o clássico jogo de cartas brasileiro
      </p>
      <div className="h-px w-16 my-7 bg-gradient-to-r from-transparent via-gold to-transparent" />

      <div className="flex flex-col gap-3.5 w-full max-w-sm">
        {/* Solo panel */}
        <div className="bg-white/[0.04] border border-gold/35 rounded-2xl px-5 py-[18px] flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <span className="text-cream font-semibold">Jogar solo</span>
            <span className="text-cream/55 text-[12.5px]">
              você vs {playerCount - 1} bot{playerCount > 2 ? 's' : ''}
            </span>
          </div>

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

          <button
            onClick={handleStartSolo}
            className="btn-gold h-13 rounded-xl font-bold text-base transition-all hover:brightness-110 active:scale-95"
          >
            Iniciar partida
          </button>
        </div>

        {/* Online */}
        <button
          onClick={() => router.push('/criar')}
          className="h-13 rounded-xl border border-gold/45 text-cream font-semibold text-[15px] transition-all hover:bg-white/[0.04] active:scale-95"
        >
          Criar sala online
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gold/20" />
          <span className="text-cream/30 text-xs tracking-widest uppercase">ou</span>
          <div className="flex-1 h-px bg-gold/20" />
        </div>

        <JoinByCode />

        <p className="text-center text-cream/45 text-xs leading-normal mt-2">
          Declare seus tentos. Erre e perca uma vida.
          <br />
          Cinco vidas. Último de pé leva.
        </p>
      </div>
    </div>
  );
}
