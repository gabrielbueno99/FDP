'use client';
import { useEffect, useRef, useState } from 'react';
import { GameState } from '../lib/types';
import { GameScene3D } from '../lib/three/GameScene3D.js';
import { BidPanel } from './BidPanel';
import { RoundSummary } from './RoundSummary';

interface GameBoard3DProps {
  state: GameState;
  humanId: number;
  forbiddenBid: number | null;
  isMyTurn: boolean;
  onBid: (bid: number) => void;
  onCardPlay: (cardId: string) => void;
  onNextRound: () => void;
  onRestart: () => void;
  isMultiplayer?: boolean;
}

interface SeatPos { x: number; y: number; relIdx: number }

export function GameBoard3D({
  state, humanId, forbiddenBid, isMyTurn,
  onBid, onCardPlay, onNextRound, onRestart, isMultiplayer,
}: GameBoard3DProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const sceneRef   = useRef<GameScene3D | null>(null);
  const [seatPositions, setSeatPositions] = useState<Map<number, SeatPos>>(new Map());

  const { phase, players, round, maxRounds, winner, dealerPlayerId,
          currentBidderId, currentPlayerId, trickWinnerId, manilhaValue } = state;

  const canPlayCard = phase === 'playing' && isMyTurn;

  // ── Initialize Three.js scene once ────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const scene = new GameScene3D(canvasRef.current);
    scene.onCardClick = onCardPlay;
    sceneRef.current  = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync canPlayCard flag every render ─────────────────────────────────────
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.canPlayCard = canPlayCard;
  });

  // ── Sync game state → 3D scene ─────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || phase === 'setup' || phase === 'game-end') return;
    scene.syncState(state, humanId);

    // Compute seat screen positions for React overlays
    const active = players.filter(p => !p.eliminated);
    setSeatPositions(scene.getSeatScreenPositions(active, humanId));
  }, [state, humanId, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Game-end screen ────────────────────────────────────────────────────────
  if (phase === 'game-end') {
    return (
      <div className="min-h-screen wood-bg flex items-center justify-center p-4">
        <div className="bg-blue-950/90 border-2 border-cyan-700/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl backdrop-blur-sm">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="font-display font-black text-cyan-200 text-3xl mb-2">
            {winner?.id === humanId ? 'Você venceu!' : `${winner?.name} venceu!`}
          </h2>
          <p className="text-blue-700/60 text-sm mb-6 uppercase tracking-widest">
            Rodada {round} de {maxRounds}
          </p>
          <button onClick={onRestart}
            className="w-full bg-cyan-700 hover:bg-cyan-600 text-cyan-100 font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg border border-cyan-600/50">
            Jogar Novamente
          </button>
        </div>
      </div>
    );
  }

  const activePlayers = players.filter(p => !p.eliminated);
  const biddedPlayers = activePlayers.filter(p => p.bid !== null);
  const totalBids     = biddedPlayers.reduce((s, p) => s + p.bid!, 0);
  const tentoDiff     = totalBids - round;
  const showTento     = biddedPlayers.length > 0;
  const humanPlayer   = players.find(p => p.id === humanId);

  return (
    <div className="relative h-dvh overflow-hidden select-none">

      {/* ── Three.js canvas (full screen) ──────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-2
                      bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <span className="font-display font-black text-cyan-400 text-xl tracking-widest
                         drop-shadow-[0_0_10px_rgba(0,212,255,0.4)]">FDP</span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-black/40 rounded-full px-2.5 py-1 border border-blue-900/40">
            <span className="text-blue-600/70 text-[10px]">Rodada</span>
            <span className="text-cyan-200 font-black text-xs">{round}</span>
            <span className="text-blue-700/60 text-[10px]">/{maxRounds}</span>
          </div>
          {showTento && (
            <div className={`rounded-full px-2.5 py-1 border text-[10px] font-bold ${
              tentoDiff > 0 ? 'bg-red-950/70 border-red-700/50 text-red-400'
              : tentoDiff < 0 ? 'bg-yellow-950/70 border-yellow-700/50 text-yellow-400'
              : 'bg-green-950/70 border-green-700/50 text-green-400'
            }`}>
              {tentoDiff > 0 ? `Sobra ${tentoDiff}` : tentoDiff < 0 ? `Falta ${Math.abs(tentoDiff)}` : 'Fechado!'}
            </div>
          )}
        </div>
        <span className="text-blue-700/60 text-[10px]">
          {phase === 'bidding' ? '📋 Decl.' : (phase === 'playing' || phase === 'trick-end') ? '🃏 Jogo' : ''}
        </span>
      </div>

      {/* ── Player badges (overlaid at each seat's screen position) ──────────── */}
      {activePlayers.map(player => {
        const pos = seatPositions.get(player.id);
        if (!pos) return null;
        const isHuman      = player.id === humanId;
        const isDealer     = player.id === dealerPlayerId;
        const isBidding    = phase === 'bidding' && player.id === currentBidderId;
        const isPlaying    = phase === 'playing' && player.id === currentPlayerId;
        const isWinner     = phase === 'trick-end' && player.id === trickWinnerId;

        const ringColor = isPlaying || isBidding
          ? 'ring-2 ring-cyan-400/80'
          : isWinner ? 'ring-2 ring-green-400/80' : '';

        // Clamp so badges never leave the viewport
        const bx = Math.max(60, Math.min((typeof window !== 'undefined' ? window.innerWidth : 400) - 60, pos.x));
        const by = Math.max(50, Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 20, pos.y - 8));

        return (
          <div
            key={player.id}
            className={`absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none
                        flex flex-col items-center gap-1`}
            style={{ left: bx, top: by }}
          >
            <div className={`bg-black/60 border border-blue-900/40 rounded-xl px-2.5 py-1.5
                             backdrop-blur-sm flex flex-col items-center gap-1 ${ringColor}`}>
              {/* Name + dealer badge */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-100 font-semibold text-xs">{player.name}</span>
                {isDealer && (
                  <span className="bg-cyan-800 text-cyan-100 text-[8px] font-black px-1 py-px rounded-full">D</span>
                )}
                {player.eliminated && <span className="text-red-400 text-[10px] font-bold">✕</span>}
              </div>

              {/* Points dots */}
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full border ${
                    i < player.points
                      ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_3px_rgba(0,212,255,0.5)]'
                      : 'bg-transparent border-blue-900/40'
                  }`} />
                ))}
              </div>

              {/* Bid / tricks */}
              {player.bid !== null && (
                <div className="flex items-center gap-1 bg-black/30 rounded-full px-2 py-0.5 border border-blue-800/30">
                  <span className="text-cyan-300 font-black text-[10px]">{player.bid}</span>
                  <span className="text-blue-700/50 text-[9px]">·</span>
                  <span className="text-green-400 font-black text-[10px]">{player.tricksWon}</span>
                </div>
              )}
              {isBidding && player.bid === null && (
                <span className="text-cyan-400 text-[9px] animate-pulse">Declarando...</span>
              )}
              {isHuman && !isPlaying && !isBidding && phase === 'playing' && (
                <span className="text-blue-600/60 text-[9px] animate-pulse">Aguardando...</span>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Bottom panel: human actions ────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none flex flex-col items-center gap-2 pb-4 px-4">

        {phase === 'bidding' && isMyTurn && (
          <div className="pointer-events-auto w-full flex justify-center">
            <BidPanel
              cardsInRound={round}
              forbiddenBid={forbiddenBid}
              onBid={onBid}
              tentoDiff={tentoDiff}
              bidsPlaced={biddedPlayers.length}
            />
          </div>
        )}

        {phase === 'bidding' && !isMyTurn && (
          <div className="bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-blue-900/30">
            <p className="text-blue-600/70 text-sm animate-pulse">Aguardando declarações...</p>
          </div>
        )}

        {phase === 'playing' && isMyTurn && (
          <div className="bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-cyan-700/40">
            <p className="text-cyan-300 text-sm font-bold animate-pulse tracking-widest uppercase">
              ✦ Sua vez — clique em uma carta ✦
            </p>
          </div>
        )}

        {/* Manilha badge (shown during play/trick) */}
        {manilhaValue && (phase === 'playing' || phase === 'trick-end') && (
          <div className="bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-cyan-700/40 flex items-center gap-2">
            <span className="text-cyan-700/60 text-[10px] uppercase tracking-widest">Manilha</span>
            <span className="text-cyan-300 font-display font-black text-lg">{manilhaValue}</span>
          </div>
        )}
      </div>

      {/* ── Round summary overlay ──────────────────────────────────────────── */}
      {phase === 'round-end' && (
        <RoundSummary state={state} humanId={humanId} onNext={onNextRound} isMultiplayer={isMultiplayer} />
      )}
    </div>
  );
}
