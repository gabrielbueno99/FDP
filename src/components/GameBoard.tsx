'use client';
import { useEffect, useState } from 'react';
import { GameState } from '../lib/types';
import { PlayerArea } from './PlayerArea';
import { TrickArea } from './TrickArea';
import { BidPanel } from './BidPanel';
import { RoundSummary } from './RoundSummary';

interface GameBoardProps {
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

// Portrait: % of the table-zone container.
// Container: 94%vw wide, paddingTop=70px, then oval paddingBottom=40% (2.5:1 ratio).
// Container height ≈ 70 + 40%×94%vw. Oval center-y ≈ 66%.
// Index = player.id. Null = human (rendered in bottom panel instead).
function getPortraitSeats(n: number): Array<{ x: string; y: string } | null> {
  const cfg: Record<number, Array<[number, number] | null>> = {
    2: [null, [50, 14]],
    3: [null, [75, 14], [25, 14]],
    4: [null, [88, 66], [50, 14], [12, 66]],
    5: [null, [88, 80], [71, 14], [29, 14], [12, 80]],
    6: [null, [88, 80], [78, 14], [50, 14], [22, 14], [12, 80]],
    7: [null, [88, 85], [88, 48], [65, 14], [35, 14], [12, 48], [12, 85]],
  };
  return (cfg[Math.min(n, 7)] ?? cfg[4]).map(
    (item) => (item ? { x: `${item[0]}%`, y: `${item[1]}%` } : null)
  );
}

// Landscape: % of the left-zone container (56%vw wide, h-dvh minus header tall).
// Index = player.id. Null = human (rendered in right panel instead).
function getLandscapeSeats(n: number): Array<{ x: string; y: string } | null> {
  const cfg: Record<number, Array<[number, number] | null>> = {
    2: [null, [50, 10]],
    3: [null, [76, 10], [24, 10]],
    4: [null, [88, 50], [50, 10], [12, 50]],
    5: [null, [88, 65], [72, 10], [28, 10], [12, 65]],
    6: [null, [88, 65], [80, 10], [50, 7], [20, 10], [12, 65]],
    7: [null, [88, 75], [88, 32], [67, 7], [33, 7], [12, 32], [12, 75]],
  };
  return (cfg[Math.min(n, 7)] ?? cfg[4]).map(
    (item) => (item ? { x: `${item[0]}%`, y: `${item[1]}%` } : null)
  );
}

const RAIL_STYLE = {
  background: 'linear-gradient(145deg,#0d1929 0%,#081320 50%,#0d1929 100%)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.85),inset 0 1px 3px rgba(0,212,255,0.08),0 0 0 1px rgba(0,212,255,0.12)',
};

export function GameBoard({
  state,
  humanId,
  forbiddenBid,
  isMyTurn,
  onBid,
  onCardPlay,
  onNextRound,
  onRestart,
  isMultiplayer,
}: GameBoardProps) {
  const {
    phase, players, round, maxRounds,
    dealerPlayerId, currentBidderId, currentPlayerId,
    trickWinnerId, manilhaValue, winner, trickLeaderId,
  } = state;

  const [isLandscape, setIsLandscape] = useState(false);
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const humanPlayer = players.find((p) => p.id === humanId);
  const canPlayCard = phase === 'playing' && isMyTurn;

  const activePlayers = players.filter((p) => !p.eliminated);
  const playedInTrick = new Set(state.currentTrick.map((pc) => pc.playerId));
  const trickPlayOrder: Record<number, number> = {};
  if (phase === 'playing' || phase === 'trick-end') {
    const leaderIdx = activePlayers.findIndex((p) => p.id === trickLeaderId);
    if (leaderIdx !== -1) {
      activePlayers.forEach((_, i) => {
        const p = activePlayers[(leaderIdx + i) % activePlayers.length];
        trickPlayOrder[p.id] = i + 1;
      });
    }
  }

  const biddedPlayers = activePlayers.filter((p) => p.bid !== null);
  const totalBidsSoFar = biddedPlayers.reduce((sum, p) => sum + p.bid!, 0);
  const tentoDiff = totalBidsSoFar - round;
  const showTento = biddedPlayers.length > 0;

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
          <button
            onClick={onRestart}
            className="w-full bg-cyan-700 hover:bg-cyan-600 text-cyan-100 font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg border border-cyan-600/50"
          >
            Jogar Novamente
          </button>
        </div>
      </div>
    );
  }

  // ── Shared sub-elements ──────────────────────────────────

  const headerJsx = (
    <div className="shrink-0 z-20 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/65 to-transparent pointer-events-none">
      <span className="font-display font-black text-cyan-400 text-xl tracking-widest drop-shadow-[0_0_10px_rgba(0,212,255,0.35)]">
        FDP
      </span>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 bg-black/40 rounded-full px-2.5 py-1 border border-blue-900/40">
          <span className="text-blue-600/70 text-[10px]">Rodada</span>
          <span className="text-cyan-200 font-black text-xs">{round}</span>
          <span className="text-blue-700/60 text-[10px]">/{maxRounds}</span>
        </div>
        {showTento && (
          <div className={`rounded-full px-2.5 py-1 border text-[10px] font-bold ${
            tentoDiff > 0
              ? 'bg-red-950/70 border-red-700/50 text-red-400'
              : tentoDiff < 0
                ? 'bg-yellow-950/70 border-yellow-700/50 text-yellow-400'
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
  );

  const portraitSeats = getPortraitSeats(players.length);
  const landscapeSeats = getLandscapeSeats(players.length);

  const renderOpponents = (seats: ReturnType<typeof getPortraitSeats>) =>
    players
      .filter((p) => p.id !== humanId)
      .map((player) => {
        const seat = seats[player.id];
        if (!seat) return null;
        return (
          <div
            key={player.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: seat.x, top: seat.y }}
          >
            <PlayerArea
              player={player}
              isDealer={player.id === dealerPlayerId}
              isCurrentBidder={phase === 'bidding' && player.id === currentBidderId}
              isCurrentPlayer={phase === 'playing' && player.id === currentPlayerId}
              isTrickWinner={phase === 'trick-end' && player.id === trickWinnerId}
              manilhaValue={manilhaValue}
              showCards={round === 1}
              bigCards={round === 1}
              compact
              small
              seat
              playOrder={trickPlayOrder[player.id]}
              hasPlayedInTrick={playedInTrick.has(player.id)}
            />
          </div>
        );
      });

  const humanPanelContent = humanPlayer && (
    <>
      <PlayerArea
        player={humanPlayer}
        isDealer={humanPlayer.id === dealerPlayerId}
        isCurrentBidder={phase === 'bidding' && humanPlayer.id === currentBidderId}
        isCurrentPlayer={phase === 'playing' && humanPlayer.id === currentPlayerId}
        isTrickWinner={phase === 'trick-end' && humanPlayer.id === trickWinnerId}
        manilhaValue={manilhaValue}
        showCards={round > 1}
        onCardClick={canPlayCard ? onCardPlay : undefined}
        playOrder={trickPlayOrder[humanPlayer.id]}
        hasPlayedInTrick={playedInTrick.has(humanPlayer.id)}
      />
      {phase === 'bidding' && isMyTurn && (
        <BidPanel
          cardsInRound={round}
          forbiddenBid={forbiddenBid}
          onBid={onBid}
          tentoDiff={tentoDiff}
          bidsPlaced={biddedPlayers.length}
        />
      )}
      {phase === 'bidding' && !isMyTurn && (
        <p className="text-blue-600/70 text-sm animate-pulse">Aguardando declarações...</p>
      )}
      {phase === 'playing' && isMyTurn && (
        <p className="text-cyan-300 text-sm font-bold animate-pulse tracking-widest uppercase">
          ✦ Sua vez ✦
        </p>
      )}
      {phase === 'playing' && !isMyTurn && (
        <p className="text-blue-600/70 text-sm animate-pulse">Aguardando jogada...</p>
      )}
    </>
  );

  // ── Landscape ─────────────────────────────────────────────
  if (isLandscape) {
    return (
      <div className="h-dvh wood-bg flex flex-col select-none overflow-hidden">
        {headerJsx}
        <div className="flex-1 flex flex-row min-h-0">

          {/* Left: oval table + opponents */}
          <div className="relative" style={{ width: '56%' }}>
            {/* Oval via absolute fill */}
            <div className="absolute z-0" style={{ top: '6%', bottom: '6%', left: '5%', right: '5%' }}>
              <div
                className="absolute inset-0 rounded-[50%]"
                style={RAIL_STYLE}
              >
                <div className="absolute inset-[10px] rounded-[50%] felt-center flex items-center justify-center overflow-hidden">
                  <TrickArea state={state} />
                </div>
              </div>
            </div>
            {renderOpponents(landscapeSeats)}
          </div>

          {/* Right: human panel */}
          <div
            className="flex flex-col items-center justify-center gap-2 px-3 pb-2 overflow-y-auto"
            style={{ width: '44%' }}
          >
            {humanPanelContent}
          </div>
        </div>
        {phase === 'round-end' && (
          <RoundSummary state={state} onNext={onNextRound} isMultiplayer={isMultiplayer} />
        )}
      </div>
    );
  }

  // ── Portrait (default) ────────────────────────────────────
  return (
    <div className="h-dvh wood-bg flex flex-col select-none overflow-hidden">
      {headerJsx}

      {/* justify-center vertically balances table + hand on all screen heights */}
      <div className="flex-1 flex flex-col min-h-0 justify-center gap-4 py-2">
        {/* Table zone: paddingTop reserves space for top-edge players */}
        <div className="relative shrink-0 mx-[3%]" style={{ paddingTop: '70px' }}>

          {/* Oval via paddingBottom aspect-ratio trick (2.5:1) */}
          <div className="relative w-full" style={{ paddingBottom: '40%' }}>
            <div
              className="absolute inset-0 rounded-[50%]"
              style={RAIL_STYLE}
            >
              <div className="absolute inset-[10px] rounded-[50%] felt-center flex items-center justify-center overflow-hidden">
                <TrickArea state={state} />
              </div>
            </div>
          </div>

          {renderOpponents(portraitSeats)}
        </div>

        {/* Human panel */}
        <div className="shrink-0 px-4 pb-1 max-w-lg mx-auto w-full flex flex-col items-center gap-2">
          {humanPanelContent}
        </div>
      </div>

      {phase === 'round-end' && (
        <RoundSummary state={state} onNext={onNextRound} isMultiplayer={isMultiplayer} />
      )}
    </div>
  );
}
