'use client';
import { useEffect, useState } from 'react';
import { GameState } from '../lib/types';
import { SUIT_SYMBOLS, getCardStrength } from '../lib/deck';
import { Dots, PlayerArea } from './PlayerArea';
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

// Landscape seats: % of the table zone (full width under the header).
// Index = RELATIVE position (0 = human, rendered in the bottom bar instead).
function getLandscapeSeats(n: number): Array<{ x: string; y: string } | null> {
  const cfg: Record<number, Array<[number, number] | null>> = {
    2: [null, [50, 16]],
    3: [null, [78, 18], [22, 18]],
    4: [null, [86, 42], [50, 12], [14, 42]],
    5: [null, [86, 52], [73, 12], [27, 12], [14, 52]],
    6: [null, [86, 52], [79, 12], [50, 10], [21, 12], [14, 52]],
    7: [null, [87, 58], [87, 26], [66, 10], [34, 10], [13, 26], [13, 58]],
  };
  return (cfg[Math.min(n, 7)] ?? cfg[4]).map(
    (item) => (item ? { x: `${item[0]}%`, y: `${item[1]}%` } : null)
  );
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
    phase, players, round,
    dealerPlayerId, currentBidderId, currentPlayerId,
    trickWinnerId, manilhaValue, winner, trickLeaderId, vira,
  } = state;

  const [isLandscape, setIsLandscape] = useState(false);
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Card ids are stable across rounds, so a stale selection would carry over —
  // reset it whenever the round or phase changes (adjust-state-during-render).
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [prevSelectionKey, setPrevSelectionKey] = useState('');
  const selectionKey = `${round}-${phase}`;
  if (selectionKey !== prevSelectionKey) {
    setPrevSelectionKey(selectionKey);
    setSelectedCardId(null);
  }

  const humanPlayer = players.find((p) => p.id === humanId);
  const canPlayCard = phase === 'playing' && isMyTurn;

  const handleCardClick = (cardId: string) => {
    if (cardId === selectedCardId) {
      setSelectedCardId(null);
      onCardPlay(cardId);
    } else {
      setSelectedCardId(cardId);
    }
  };

  const playSelected = () => {
    if (!selectedCardId) return;
    const id = selectedCardId;
    setSelectedCardId(null);
    onCardPlay(id);
  };

  const activePlayers = players.filter((p) => !p.eliminated);
  const humanIdx = activePlayers.findIndex((p) => p.id === humanId);
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
  const showTento = biddedPlayers.length > 0 && phase === 'bidding';

  const completedTricks = activePlayers.reduce((sum, p) => sum + p.tricksWon, 0);
  const vazaNum = Math.min(completedTricks + 1, round);

  // Selected card label for the play button / hint ("A♥"; hidden in round 1)
  const selectedCard = humanPlayer?.hand.find((c) => c.id === selectedCardId);
  const humanSeesCards = round > 1;
  const selectedLabel =
    selectedCard && humanSeesCards ? `${selectedCard.value}${SUIT_SYMBOLS[selectedCard.suit]}` : 'a carta';
  const selectedIsManilha = humanSeesCards && selectedCard?.value === manilhaValue;

  // Center status ("sua vez — Bia leva por enquanto")
  const leading = state.currentTrick.length > 0 && manilhaValue
    ? state.currentTrick.reduce((leader, played) =>
        getCardStrength(played.card, manilhaValue) > getCardStrength(leader.card, manilhaValue)
          ? played : leader
      )
    : null;
  const leadingName = leading ? players.find((p) => p.id === leading.playerId)?.name : null;
  const status =
    phase === 'playing'
      ? isMyTurn
        ? leadingName
          ? `sua vez — ${leadingName} leva por enquanto`
          : 'sua vez, se garante?'
        : `vez de ${players.find((p) => p.id === currentPlayerId)?.name}`
      : phase === 'bidding' && !isMyTurn
        ? 'aguardando declarações…'
        : null;

  if (phase === 'game-end') {
    const others = players
      .filter((p) => p.id !== winner?.id)
      .sort((a, b) => b.points - a.points);
    const humanWon = winner?.id === humanId;
    return (
      <div className="min-h-screen lobby-bg flex flex-col items-center justify-center p-7">
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="flex gap-3.5 text-gold text-[15px] tracking-[6px]">♣ ♥ ♠ ♦</div>
          <div className="text-center mt-6 flex flex-col gap-2">
            <span className="font-display italic text-gold text-lg">último de pé</span>
            <span className="font-display text-cream text-5xl leading-none">
              {humanWon ? 'Você venceu.' : `${winner?.name} venceu.`}
            </span>
            <span className="text-cream/60 text-sm">
              {round} rodada{round > 1 ? 's' : ''} · {winner?.points} vida{(winner?.points ?? 0) > 1 ? 's' : ''} de sobra
            </span>
          </div>

          <div className="w-full mt-9 flex flex-col gap-2">
            <div className="flex justify-between items-center px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-gold/35">
              <span className="text-cream text-[13.5px] font-semibold">1 · {winner?.name}</span>
              <span className="text-gold text-[12.5px]">{winner?.points} vida{(winner?.points ?? 0) > 1 ? 's' : ''}</span>
            </div>
            {others.map((p, i) => (
              <div key={p.id} className="flex justify-between items-center px-3.5 py-2.5 rounded-xl bg-white/[0.03]">
                <span className="text-cream/70 text-[13.5px]">{i + 2} · {p.name}</span>
                <span className="text-cream/45 text-[12.5px]">eliminado</span>
              </div>
            ))}
          </div>

          <button
            onClick={onRestart}
            className="btn-gold w-full h-13 rounded-xl font-bold text-base mt-9 transition-all hover:brightness-110 active:scale-95"
          >
            Jogar de novo
          </button>
        </div>
      </div>
    );
  }

  const roundLabel =
    phase === 'bidding'
      ? `RODADA ${round} · ${round} CARTA${round > 1 ? 'S' : ''}`
      : `RODADA ${round} · VAZA ${vazaNum} DE ${round}`;

  const tentoPill = showTento && (
    <span className={`rounded-full px-2.5 py-1 border text-[10px] font-semibold ${
      tentoDiff === 0 ? 'border-gold/40 text-gold' : 'border-white/15 text-cream/60'
    }`}>
      {tentoDiff > 0 ? `sobra ${tentoDiff}` : tentoDiff < 0 ? `falta ${Math.abs(tentoDiff)}` : 'conta fechada'}
    </span>
  );

  const renderOpponent = (player: (typeof players)[number]) => (
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
      playOrder={trickPlayOrder[player.id]}
      hasPlayedInTrick={playedInTrick.has(player.id)}
    />
  );

  // ── Landscape — mesa oval cinematográfica (5a/6b) ─────────
  if (isLandscape) {
    const seats = getLandscapeSeats(players.length);
    return (
      <div className="h-dvh room-bg flex flex-col select-none overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 z-20 flex items-center justify-between px-10 py-5">
          <span className="font-display text-cream text-[28px] leading-none">FDP</span>
          <div className="flex items-center gap-5">
            <span className="text-cream/60 text-[13px] tracking-[2px]">{roundLabel}</span>
            {tentoPill}
            {vira && (
              <div className="flex items-center gap-2 px-3.5 py-2 border border-gold/30 rounded-full">
                <span className="text-cream/50 text-[11px] tracking-[2px]">VIRA</span>
                <span className={`font-display text-lg leading-none ${
                  vira.suit === 'hearts' || vira.suit === 'diamonds' ? 'text-danger' : 'text-cream'
                }`}>
                  {vira.value}{SUIT_SYMBOLS[vira.suit]}
                </span>
                <span className="text-gold text-[13px] font-semibold">manilha {manilhaValue}</span>
              </div>
            )}
          </div>
        </div>

        {/* Table zone */}
        <div className="flex-1 relative min-h-0">
          {/* Oval felt */}
          <div className="absolute rounded-[50%] table-rail" style={{ left: '20%', right: '20%', top: '4%', bottom: '26%' }}>
            <div className="absolute inset-[10px] rounded-[50%] felt-center overflow-hidden">
              <div className="absolute inset-[8%] rounded-[50%] border border-gold/20 pointer-events-none" />
              <div className="absolute inset-0 flex items-center justify-center">
                <TrickArea state={state} showVira={false} status={status} />
              </div>
            </div>
          </div>

          {/* Opponents around the table */}
          {players
            .filter((p) => p.id !== humanId)
            .map((player) => {
              const pIdx   = activePlayers.findIndex((p) => p.id === player.id);
              const relIdx = (pIdx - humanIdx + activePlayers.length) % activePlayers.length;
              const seat   = seats[relIdx];
              if (!seat) return null;
              return (
                <div
                  key={player.id}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: seat.x, top: seat.y }}
                >
                  {renderOpponent(player)}
                </div>
              );
            })}

          {/* Bottom bar: you · hand · action */}
          <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center items-end gap-8 px-10 pb-5">
            {humanPlayer && (
              <>
                <div className="flex flex-col gap-2 items-start mb-3.5 w-44">
                  <span className="text-cream font-semibold">
                    {humanPlayer.name}
                    {humanPlayer.id === dealerPlayerId && (
                      <span className="text-gold font-bold tracking-[1.5px] text-[10px]"> · CARTEIA</span>
                    )}
                  </span>
                  {humanPlayer.bid !== null && (
                    <span className="text-cream/60 text-[13px]">
                      tentos {humanPlayer.bid} · fez {humanPlayer.tricksWon}
                    </span>
                  )}
                  <Dots points={humanPlayer.points} />
                </div>

                <PlayerArea
                  player={humanPlayer}
                  isDealer={false}
                  isCurrentBidder={false}
                  isCurrentPlayer={false}
                  isTrickWinner={false}
                  manilhaValue={manilhaValue}
                  showCards={humanSeesCards}
                  onCardClick={canPlayCard ? handleCardClick : undefined}
                  selectedCardId={selectedCardId}
                  handOnly
                  xlCards
                />

                <div className="flex flex-col gap-2.5 items-center mb-3.5 w-64">
                  {phase === 'bidding' && isMyTurn ? (
                    <BidPanel
                      cardsInRound={round}
                      forbiddenBid={forbiddenBid}
                      onBid={onBid}
                      tentoDiff={tentoDiff}
                      bidsPlaced={biddedPlayers.length}
                    />
                  ) : canPlayCard && selectedCardId ? (
                    <>
                      <button
                        onClick={playSelected}
                        className="btn-gold h-13 px-8 rounded-xl font-bold text-base transition-all hover:brightness-110 active:scale-95"
                      >
                        Jogar {selectedLabel}
                      </button>
                      <span className="text-cream/45 text-xs text-center">
                        {selectedIsManilha ? 'manilha na mão' : 'ou clique em outra carta'}
                      </span>
                    </>
                  ) : canPlayCard ? (
                    <span className="text-cream/45 text-xs text-center">clique numa carta pra escolher</span>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        {phase === 'round-end' && (
          <RoundSummary state={state} humanId={humanId} onNext={onNextRound} isMultiplayer={isMultiplayer} />
        )}
      </div>
    );
  }

  // ── Portrait — pods no topo, centro livre, leque embaixo (1a/4a/6a) ──
  return (
    <div className="h-dvh table-bg flex flex-col select-none overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-5 pb-1">
        <span className="font-display text-cream text-xl leading-none">FDP</span>
        <div className="flex items-center gap-2">
          <span className="text-cream/60 text-xs tracking-[1px]">{roundLabel}</span>
          {tentoPill}
        </div>
      </div>

      {/* Opponent pods */}
      <div className="shrink-0 flex flex-wrap justify-center gap-2 px-3.5 mt-3">
        {players
          .filter((p) => p.id !== humanId)
          .map((player) => (
            <div key={player.id} className="flex-1 min-w-[104px] max-w-[132px]">
              {renderOpponent(player)}
            </div>
          ))}
      </div>

      {/* Center: vira + trick + status (+ bid) */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 px-4 overflow-y-auto">
        <TrickArea state={state} status={status} />
        {phase === 'bidding' && isMyTurn && (
          <BidPanel
            cardsInRound={round}
            forbiddenBid={forbiddenBid}
            onBid={onBid}
            tentoDiff={tentoDiff}
            bidsPlaced={biddedPlayers.length}
          />
        )}
      </div>

      {/* Your hand */}
      <div className="shrink-0 px-4 pb-4 pt-1 max-w-lg mx-auto w-full flex flex-col gap-2.5">
        {humanPlayer && (
          <PlayerArea
            player={humanPlayer}
            isDealer={humanPlayer.id === dealerPlayerId}
            isCurrentBidder={phase === 'bidding' && humanPlayer.id === currentBidderId}
            isCurrentPlayer={phase === 'playing' && humanPlayer.id === currentPlayerId}
            isTrickWinner={phase === 'trick-end' && humanPlayer.id === trickWinnerId}
            manilhaValue={manilhaValue}
            showCards={humanSeesCards}
            onCardClick={canPlayCard ? handleCardClick : undefined}
            selectedCardId={selectedCardId}
          />
        )}
        {canPlayCard && (
          <p className="text-center text-cream/45 text-xs">
            {selectedCardId
              ? `toque de novo pra jogar ${selectedLabel}`
              : 'toque numa carta pra escolher'}
          </p>
        )}
      </div>

      {phase === 'round-end' && (
        <RoundSummary state={state} humanId={humanId} onNext={onNextRound} isMultiplayer={isMultiplayer} />
      )}
    </div>
  );
}
