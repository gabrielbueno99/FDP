'use client';
import { GameState, Player } from '../lib/types';
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

// Seat positions (x%, y% of viewport) for N opponents around the oval.
// Oval occupies roughly left:6%–right:6%, top:20%–bottom:44%.
// Top of header ≈ 6%; keep y ≥ 14 so badges clear the header bar.
function getOvalSeats(n: number): Array<{ x: string; y: string }> {
  const configs: Record<number, Array<[number, number]>> = {
    1: [[50, 14]],
    2: [[17, 25], [83, 25]],
    3: [[17, 24], [50, 14], [83, 24]],
    4: [[9, 40], [29, 15], [71, 15], [91, 40]],
    5: [[9, 37], [23, 15], [50, 14], [77, 15], [91, 37]],
    6: [[8, 51], [11, 27], [30, 14], [70, 14], [89, 27], [92, 51]],
    7: [[8, 51], [11, 27], [26, 14], [50, 13], [74, 14], [89, 27], [92, 51]],
  };
  return (configs[Math.min(n, 7)] ?? configs[1]).map(([x, y]) => ({
    x: `${x}%`,
    y: `${y}%`,
  }));
}

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
    trickWinnerId, manilhaValue, winner,
  } = state;

  const humanPlayer = players.find((p) => p.id === humanId);
  const opponents = players.filter((p) => p.id !== humanId);
  const canPlayCard = phase === 'playing' && isMyTurn;
  const seats = getOvalSeats(opponents.length);

  // Tento indicator
  const activePlayers = players.filter((p) => !p.eliminated);
  const biddedPlayers = activePlayers.filter((p) => p.bid !== null);
  const totalBidsSoFar = biddedPlayers.reduce((sum, p) => sum + p.bid!, 0);
  const tentoDiff = totalBidsSoFar - round;
  const showTento = biddedPlayers.length > 0;

  if (phase === 'game-end') {
    return (
      <div className="min-h-screen wood-bg flex items-center justify-center p-4">
        <div className="bg-amber-950/90 border-2 border-amber-700/50 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="font-display font-black text-amber-200 text-3xl mb-2">
            {winner?.id === humanId ? 'Você venceu!' : `${winner?.name} venceu!`}
          </h2>
          <p className="text-amber-700/60 text-sm mb-6 uppercase tracking-widest">
            Rodada {round} de {maxRounds}
          </p>
          <button
            onClick={onRestart}
            className="w-full bg-amber-700 hover:bg-amber-600 text-amber-100 font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg border border-amber-600/50"
          >
            Jogar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen wood-bg relative overflow-hidden select-none">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <span className="font-display font-black text-amber-400 text-2xl tracking-widest drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
          FDP
        </span>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-black/40 rounded-full px-3 py-1 border border-amber-900/30">
            <span className="text-amber-700/70 text-xs">Rodada</span>
            <span className="text-amber-200 font-black text-sm">{round}</span>
            <span className="text-amber-800/60 text-xs">/{maxRounds}</span>
          </div>

          {showTento && (
            <div className={`rounded-full px-3 py-1 border text-xs font-bold ${
              tentoDiff > 0
                ? 'bg-red-950/70 border-red-700/50 text-red-400'
                : tentoDiff < 0
                  ? 'bg-yellow-950/70 border-yellow-700/50 text-yellow-400'
                  : 'bg-green-950/70 border-green-700/50 text-green-400'
            }`}>
              {tentoDiff > 0
                ? `Sobra ${tentoDiff}`
                : tentoDiff < 0
                  ? `Falta ${Math.abs(tentoDiff)}`
                  : 'Fechado!'}
            </div>
          )}
        </div>

        <span className="text-amber-700/60 text-xs">
          {phase === 'bidding' ? '📋 Declarações' : (phase === 'playing' || phase === 'trick-end') ? '🃏 Em jogo' : ''}
        </span>
      </div>

      {/* ── Oval poker table ──────────────────────────────────── */}
      <div
        className="absolute z-0"
        style={{ top: '20%', bottom: '44%', left: '6%', right: '6%' }}
      >
        {/* Wooden rail */}
        <div
          className="absolute inset-0 rounded-[50%] shadow-2xl"
          style={{
            background: 'linear-gradient(145deg, #7a3a0a 0%, #5c2a07 50%, #7a3a0a 100%)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.7), inset 0 1px 3px rgba(255,200,100,0.15)',
          }}
        />
        {/* Felt surface */}
        <div className="absolute inset-[10px] rounded-[50%] felt-center flex items-center justify-center overflow-hidden">
          <TrickArea state={state} />
        </div>
      </div>

      {/* ── Opponent seats around the oval ────────────────────── */}
      {opponents.map((player, i) => {
        const seat = seats[i];
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
              compact
              small={opponents.length >= 4}
              seat
            />
          </div>
        );
      })}

      {/* ── Human player — bottom center ──────────────────────── */}
      {humanPlayer && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 w-full px-4 max-w-lg">
          <PlayerArea
            player={humanPlayer}
            isDealer={humanPlayer.id === dealerPlayerId}
            isCurrentBidder={phase === 'bidding' && humanPlayer.id === currentBidderId}
            isCurrentPlayer={phase === 'playing' && humanPlayer.id === currentPlayerId}
            isTrickWinner={phase === 'trick-end' && humanPlayer.id === trickWinnerId}
            manilhaValue={manilhaValue}
            showCards={round !== 1}
            onCardClick={canPlayCard ? onCardPlay : undefined}
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
            <p className="text-amber-700/60 text-sm animate-pulse">Aguardando declarações...</p>
          )}

          {phase === 'playing' && isMyTurn && (
            <p className="text-amber-300 text-sm font-bold animate-pulse tracking-widest uppercase">
              ✦ Sua vez ✦
            </p>
          )}

          {phase === 'playing' && !isMyTurn && (
            <p className="text-amber-700/60 text-sm animate-pulse">Aguardando jogada...</p>
          )}
        </div>
      )}

      {phase === 'round-end' && (
        <RoundSummary state={state} onNext={onNextRound} isMultiplayer={isMultiplayer} />
      )}
    </div>
  );
}
