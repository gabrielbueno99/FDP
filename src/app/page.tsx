'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '../hooks/useGame';
import { GameBoard } from '../components/GameBoard';

type Screen = 'home' | 'playing';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home');
  const [playerCount, setPlayerCount] = useState(4);
  const [joinCode, setJoinCode] = useState('');
  const router = useRouter();

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push(`/sala/${code}`);
  };

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

        {/* Entrar por código */}
        <div className="flex items-center gap-3 px-1">
          <div className="h-px flex-1 bg-gold/20" />
          <span className="text-cream/40 text-[11px] tracking-[2px]">OU ENTRE COM CÓDIGO</span>
          <div className="h-px flex-1 bg-gold/20" />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Código da sala"
            maxLength={5}
            className="flex-1 min-w-0 h-13 rounded-xl bg-white/5 border border-gold/40 text-cream px-[18px] text-[15px] tracking-[3px] uppercase outline-none focus:border-gold transition-colors placeholder:text-cream/30 placeholder:tracking-normal"
          />
          <button
            onClick={handleJoin}
            disabled={joinCode.trim().length < 4}
            className="h-13 px-6 rounded-xl border border-gold/45 text-cream font-semibold text-[15px] transition-all hover:bg-white/[0.04] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            Entrar
          </button>
        </div>

        <p className="text-center text-cream/45 text-xs leading-normal mt-2">
          Declare seus tentos. Erre e perca uma vida.
          <br />
          Cinco vidas. Último de pé leva.
        </p>
      </div>
    </div>
  );
}
