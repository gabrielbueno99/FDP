'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '../hooks/useGame';
import { GameBoard } from '../components/GameBoard';

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
    <div className="min-h-screen wood-bg flex flex-col items-center justify-center p-6 gap-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <h1 className="font-display font-black text-cyan-400 text-8xl tracking-widest drop-shadow-[0_0_24px_rgba(0,212,255,0.35)]">
          FDP
        </h1>
        <div className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-cyan-700/50 to-transparent" />
        <p className="text-blue-700/70 text-xs tracking-[0.25em] uppercase">
          Filho da Puta — o jogo de cartas
        </p>
      </div>

      {/* Decorative cards */}
      <div className="flex gap-2 -rotate-1 my-1">
        {[
          { suit: '♣', color: 'text-gray-900', rotate: '-rotate-3' },
          { suit: '♥', color: 'text-red-600', rotate: 'rotate-2' },
          { suit: '♠', color: 'text-gray-900', rotate: '-rotate-1' },
          { suit: '♦', color: 'text-red-600', rotate: 'rotate-3' },
        ].map((s, i) => (
          <div
            key={i}
            className={`w-14 h-20 bg-white rounded-xl flex items-center justify-center text-3xl shadow-xl border border-blue-300/10 ${s.rotate}`}
          >
            <span className={s.color}>{s.suit}</span>
          </div>
        ))}
      </div>

      {/* Solo panel */}
      <div className="bg-black/35 border border-blue-900/35 rounded-2xl p-6 w-full max-w-xs flex flex-col gap-5 backdrop-blur-sm shadow-2xl">
        <h2 className="text-cyan-200 font-bold text-lg text-center tracking-wide">Jogar Solo</h2>

        <div className="flex flex-col gap-2">
          <label className="text-blue-700/70 text-xs uppercase tracking-widest text-center">
            Número de jogadores
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
          <p className="text-blue-800/60 text-xs text-center">
            Você vs {playerCount - 1} bot{playerCount > 2 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={handleStartSolo}
          className="bg-cyan-700 hover:bg-cyan-600 text-cyan-100 font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg border border-cyan-600/40"
        >
          Iniciar Partida
        </button>
      </div>

      {/* Online panel */}
      <div className="bg-black/35 border border-blue-900/35 rounded-2xl p-6 w-full max-w-xs flex flex-col gap-4 backdrop-blur-sm shadow-2xl">
        <h2 className="text-cyan-200 font-bold text-lg text-center tracking-wide">Jogar Online</h2>
        <p className="text-blue-700/60 text-sm text-center">
          Crie uma sala e compartilhe o link com seus amigos
        </p>
        <button
          onClick={() => router.push('/criar')}
          className="bg-green-800 hover:bg-green-700 text-green-100 font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg border border-green-700/40"
        >
          Criar Sala
        </button>
      </div>

      <p className="text-blue-900/45 text-xs text-center max-w-xs">
        Declare quantos tentos vai fazer. Quem errar perde 1 ponto. Começa com 5. Último sobrevivente vence.
      </p>
    </div>
  );
}
