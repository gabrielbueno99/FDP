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

function distributeOpponents(opponents: Player[]): {
  top: Player[];
  left: Player[];
  right: Player[];
} {
  const n = opponents.length;
  if (n <= 3) return { top: opponents, left: [], right: [] };
  if (n === 4) return { top: opponents.slice(0, 2), left: [opponents[2]], right: [opponents[3]] };
  if (n === 5) return { top: opponents.slice(0, 3), left: [opponents[3]], right: [opponents[4]] };
  if (n === 6) return { top: opponents.slice(0, 2), left: opponents.slice(2, 4), right: opponents.slice(4) };
  // 7
  return { top: opponents.slice(0, 3), left: opponents.slice(3, 5), right: opponents.slice(5) };
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
  const otherPlayers = players.filter((p) => p.id !== humanId);
  const canPlayCard = phase === 'playing' && isMyTurn;
  const { top, left, right } = distributeOpponents(otherPlayers);

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

  const opponentProps = (player: Player, small: boolean) => ({
    player,
    isDealer: player.id === dealerPlayerId,
    isCurrentBidder: phase === 'bidding' && player.id === currentBidderId,
    isCurrentPlayer: phase === 'playing' && player.id === currentPlayerId,
    isTrickWinner: phase === 'trick-end' && player.id === trickWinnerId,
    manilhaValue,
    showCards: round === 1,
    compact: true as const,
    small,
  });

  return (
    <div className="h-screen wood-bg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2 bg-gradient-to-b from-black/60 to-black/20 border-b border-amber-900/40 shrink-0">
        <span className="font-display font-black text-amber-400 text-2xl tracking-widest drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
          FDP
        </span>
        <div className="flex items-center gap-1.5 bg-black/30 rounded-full px-3 py-1 border border-amber-900/30">
          <span className="text-amber-700/70 text-xs">Rodada</span>
          <span className="text-amber-200 font-black text-sm">{round}</span>
          <span className="text-amber-800/60 text-xs">/{maxRounds}</span>
        </div>
        <span className="text-amber-700/60 text-xs">
          {phase === 'bidding' ? '📋 Declarações' : phase === 'playing' ? '🃏 Em jogo' : ''}
        </span>
      </div>

      {/* Table area */}
      <div className="flex-1 flex min-h-0 gap-2 p-2">

        {/* Left column — desktop only */}
        {left.length > 0 && (
          <div className="hidden sm:flex flex-col gap-2 justify-center shrink-0 w-40">
            {left.map((player) => (
              <PlayerArea key={player.id} {...opponentProps(player, true)} />
            ))}
          </div>
        )}

        {/* Center column */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">

          {/* Top opponents */}
          {top.length > 0 && (
            <div className="shrink-0 flex gap-2 justify-center flex-wrap">
              {/* Mobile: all opponents here */}
              <div className="sm:hidden contents">
                {otherPlayers.map((player) => (
                  <PlayerArea key={player.id} {...opponentProps(player, false)} />
                ))}
              </div>
              {/* Desktop: only top opponents here */}
              <div className="hidden sm:contents">
                {top.map((player) => (
                  <PlayerArea key={player.id} {...opponentProps(player, false)} />
                ))}
              </div>
            </div>
          )}

          {/* Mobile-only: all opponents (when there are no top opponents due to all going to sides) */}
          {top.length === 0 && (
            <div className="sm:hidden shrink-0 flex gap-1.5 justify-center flex-wrap">
              {otherPlayers.map((player) => (
                <PlayerArea key={player.id} {...opponentProps(player, false)} />
              ))}
            </div>
          )}

          {/* Felt */}
          <div className="flex-1 min-h-0 rounded-2xl felt-center flex items-center justify-center ring-1 ring-green-900/50 shadow-2xl overflow-hidden">
            <TrickArea state={state} />
          </div>

          {/* Human player */}
          {humanPlayer && (
            <div className="shrink-0 flex flex-col items-center gap-2">
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
                <BidPanel cardsInRound={round} forbiddenBid={forbiddenBid} onBid={onBid} />
              )}

              {phase === 'bidding' && !isMyTurn && (
                <p className="text-amber-700/60 text-sm animate-pulse">Aguardando declarações...</p>
              )}

              {phase === 'playing' && !isMyTurn && (
                <p className="text-amber-700/60 text-sm animate-pulse">Aguardando jogada...</p>
              )}

              {phase === 'playing' && isMyTurn && (
                <p className="text-amber-300 text-sm font-bold animate-pulse tracking-widest uppercase">
                  ✦ Sua vez ✦
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right column — desktop only */}
        {right.length > 0 && (
          <div className="hidden sm:flex flex-col gap-2 justify-center shrink-0 w-40">
            {right.map((player) => (
              <PlayerArea key={player.id} {...opponentProps(player, true)} />
            ))}
          </div>
        )}
      </div>

      {phase === 'round-end' && (
        <RoundSummary state={state} onNext={onNextRound} isMultiplayer={isMultiplayer} />
      )}
    </div>
  );
}
