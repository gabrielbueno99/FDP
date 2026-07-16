'use client';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiplayer } from '../../../hooks/useMultiplayer';
import { useGame } from '../../../hooks/useGame';
import { maxRoundsFor } from '../../../lib/game';
import { GameBoard } from '../../../components/GameBoard';
import { DisconnectOverlay } from '../../../components/DisconnectOverlay';
import { ChatPanel } from '../../../components/ChatPanel';
import { avatarColor, initials } from '../../../components/PlayerArea';
import { ChatMessage } from '../../../lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ChatWidgetProps {
  messages: ChatMessage[];
  myPlayerId: number | null;
  onSend: (text: string) => void;
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChatWidget({ messages, myPlayerId, onSend }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevCount = useRef(0);

  useEffect(() => {
    const n = messages.length;
    if (n > prevCount.current && !open) setUnread((u) => u + (n - prevCount.current));
    prevCount.current = n;
  }, [messages.length, open]);

  return (
    <div className="fixed bottom-4 right-3 z-40 flex flex-col items-end gap-2">
      {open && (
        <div
          className="w-72 flex flex-col bg-black/80 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md"
          style={{ height: '320px' }}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 shrink-0">
            <span className="text-gold font-bold text-[10.5px] tracking-[1.5px]">CHAT DA MESA</span>
            <button
              onClick={() => setOpen(false)}
              className="text-cream/50 hover:text-gold text-lg leading-none transition-colors"
            >
              ×
            </button>
          </div>
          <ChatPanel messages={messages} myPlayerId={myPlayerId} onSend={onSend} />
        </div>
      )}

      <button
        onClick={() => { setOpen((v) => !v); setUnread(0); }}
        className="relative w-11 h-11 rounded-full border border-gold/40 bg-black/50 hover:border-gold active:scale-95 flex items-center justify-center shadow-xl transition-all text-gold"
      >
        {open ? <span className="text-lg leading-none">×</span> : <ChatIcon />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 bg-gold text-ink text-[9px] font-black rounded-full flex items-center justify-center shadow">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}

function JoinForm({ roomCode, hostName, seated, onJoin }: {
  roomCode: string;
  hostName: string | null;
  seated: number;
  onJoin: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <div className="min-h-screen lobby-bg flex flex-col items-center justify-center p-7">
      <div className="flex gap-3.5 text-gold text-[15px] tracking-[6px]">♣ ♥ ♠ ♦</div>
      <h1 className="font-display text-cream text-7xl leading-none mt-4">FDP</h1>

      <div className="text-center mt-9 flex flex-col gap-1.5">
        <span className="font-display text-cream text-3xl leading-tight">
          {hostName ? `${hostName} te chamou` : 'Te chamaram'}
          <br />
          pra mesa
        </span>
        <span className="font-display italic text-gold text-[15px]">
          sala {roomCode}{seated > 0 ? ` · ${seated} na mesa` : ''}
        </span>
      </div>

      <div className="w-full max-w-sm mt-9 flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <label className="text-cream/55 text-[11px] tracking-[2px] pl-1">SEU NOME NA MESA</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && onJoin(name.trim())}
            placeholder="Como te chamamos?"
            maxLength={16}
            className="h-[54px] rounded-xl bg-white/5 border border-gold/40 text-cream px-[18px] outline-none focus:border-gold transition-colors placeholder:text-cream/30"
          />
        </div>
        <button
          onClick={() => name.trim() && onJoin(name.trim())}
          disabled={!name.trim()}
          className="btn-gold h-[54px] rounded-xl font-bold text-base transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Sentar na mesa
        </button>
      </div>

      <p className="text-center text-cream/45 text-xs leading-normal mt-10">
        Declare seus tentos. Erre e perca uma vida.
        <br />
        Cinco vidas. Último de pé leva.
      </p>
    </div>
  );
}

export default function SalaPage({ params }: PageProps) {
  const { id: roomCode } = use(params);
  const router = useRouter();

  const [playerName, setPlayerName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('fdp-name');
    return null;
  });

  const [nameInput, setNameInput] = useState<string | null>(playerName);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [roundLimit, setRoundLimit] = useState<number | null>(null);
  const [showPlayers, setShowPlayers] = useState(false);

  const initialIsHost =
    typeof window !== 'undefined' && sessionStorage.getItem('fdp-host-room') === roomCode;

  const mp = useMultiplayer(roomCode, nameInput, initialIsHost);
  // Live flag: the host can change mid-game if the original one walks out.
  const isHost = mp.isHost;

  useEffect(() => {
    if (mp.wasKicked) router.push('/');
  }, [mp.wasKicked, router]);

  const { state: gameState, placeBid, playCard, nextRound, humanId, forbiddenBid, isMyTurn } =
    useGame({
      externalState: mp.gameState ?? undefined,
      onAction: mp.sendAction,
      myPlayerId: mp.myPlayerId ?? 0,
      noAI: true,
    });

  if (!nameInput) {
    return (
      <JoinForm
        roomCode={roomCode}
        hostName={null}
        seated={0}
        onJoin={(n) => {
          sessionStorage.setItem('fdp-name', n);
          setNameInput(n);
          setPlayerName(n);
        }}
      />
    );
  }

  // Guest knocking on a running game — the host decides.
  if (mp.awaitingApproval || mp.joinRejected) {
    return (
      <div className="min-h-screen lobby-bg flex flex-col items-center justify-center p-7">
        <div className="flex gap-3.5 text-gold text-[15px] tracking-[6px]">♣ ♥ ♠ ♦</div>
        <h1 className="font-display text-cream text-6xl leading-none mt-4">FDP</h1>
        <div className="text-center mt-9 flex flex-col gap-2 max-w-sm">
          <span className="font-display text-cream text-3xl leading-tight">
            {mp.joinRejected ? 'O anfitrião recusou.' : 'A partida já começou.'}
          </span>
          <span className="font-display italic text-gold text-[15px]">
            {mp.joinRejected
              ? 'talvez na próxima mesa'
              : 'pedimos pro anfitrião te deixar entrar…'}
          </span>
          {!mp.joinRejected && (
            <span className="text-cream/50 text-[13px] mt-1">
              Se ele liberar, você entra no começo da próxima rodada.
            </span>
          )}
        </div>
        <button
          onClick={() => router.push('/')}
          className="w-full max-w-sm h-13 rounded-xl border border-gold/45 text-cream font-semibold text-[15px] mt-9 transition-all hover:bg-white/[0.04] active:scale-95"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  if (mp.error) {
    return (
      <div className="min-h-screen lobby-bg flex items-center justify-center p-7">
        <div className="w-full max-w-sm text-center flex flex-col items-center gap-4">
          <div className="text-danger text-4xl">⚠</div>
          <p className="font-display text-cream text-2xl">{mp.error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full h-13 rounded-xl border border-gold/45 text-cream font-semibold text-[15px] transition-all hover:bg-white/[0.04] active:scale-95"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  if (!mp.isConnected || mp.role === 'connecting') {
    return (
      <div className="min-h-screen lobby-bg flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="font-display text-cream text-6xl">FDP</div>
          <div className="font-display italic text-gold animate-pulse text-[15px]">
            conectando à sala {roomCode}…
          </div>
        </div>
      </div>
    );
  }

  const chatWidget = (
    <ChatWidget
      messages={mp.chatMessages}
      myPlayerId={mp.myPlayerId}
      onSend={mp.sendChat}
    />
  );

  if (mp.gameState) {
    const activePlayers = mp.lobbyPlayers.filter(p => {
      const gs = mp.gameState!;
      return !gs.players.find(gp => gp.id === p.id)?.eliminated;
    });

    return (
      <>
        <GameBoard
          state={gameState}
          humanId={mp.myPlayerId ?? 0}
          forbiddenBid={forbiddenBid}
          isMyTurn={isMyTurn && !mp.disconnectedPlayer}
          onBid={placeBid}
          onCardPlay={playCard}
          onNextRound={nextRound}
          onRestart={() => router.push('/')}
          isMultiplayer
        />

        {/* Host: someone wants in mid-game */}
        {mp.pendingJoins.length > 0 && isHost && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
            {mp.pendingJoins.map((j) => (
              <div
                key={j.clientId}
                className="flex items-center gap-3 bg-black/85 border border-gold/45 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-md"
              >
                <span className="text-cream text-sm">
                  <span className="font-semibold text-gold">{j.name}</span> quer entrar
                </span>
                <button
                  onClick={() => mp.approveJoin(j.clientId)}
                  className="btn-gold h-8 px-3 rounded-lg text-[12.5px] font-bold transition-all hover:brightness-110 active:scale-95"
                >
                  Deixar entrar
                </button>
                <button
                  onClick={() => mp.rejectJoin(j.clientId)}
                  className="h-8 px-3 rounded-lg border border-danger/45 text-danger/80 hover:text-danger text-[12.5px] font-semibold transition-all active:scale-95"
                >
                  Recusar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* The old host walked out and this client took the table over */}
        {mp.becameHost && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-black/85 border border-gold/50 rounded-full px-4 py-2 shadow-xl backdrop-blur-md">
            <span className="font-display italic text-gold text-sm">
              o anfitrião saiu — você assumiu a mesa, a rodada foi redistribuída
            </span>
          </div>
        )}

        {/* Approved mid-game — no hand until the next deal */}
        {mp.seatedNextRound && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-black/85 border border-gold/40 rounded-full px-4 py-2 shadow-xl backdrop-blur-md">
            <span className="font-display italic text-gold text-sm">
              você entra no começo da próxima rodada…
            </span>
          </div>
        )}

        {mp.disconnectedPlayer && (
          <DisconnectOverlay
            player={mp.disconnectedPlayer}
            isHost={isHost}
            onRemove={mp.removeDisconnectedPlayer}
          />
        )}

        {/* Floating actions: bottom-left */}
        <div className="fixed bottom-4 left-3 z-40 flex flex-col items-start gap-2">
          {isHost && showPlayers && (
            <div className="w-60 bg-black/80 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md p-3 flex flex-col gap-2">
              <span className="text-gold font-bold text-[10.5px] tracking-[1.5px] px-1">JOGADORES</span>
              {activePlayers.filter(p => p.id !== mp.hostId).map(p => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.04]">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
                    style={{ background: avatarColor(p.id), color: '#ead9ac' }}
                  >
                    {initials(p.name)}
                  </div>
                  <span className="text-cream text-sm flex-1 truncate">{p.name}</span>
                  <button
                    onClick={() => mp.kickPlayer(p.id)}
                    className="text-danger/70 hover:text-danger text-xs px-1.5 py-0.5 rounded transition-colors"
                    title="Remover jogador"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {isHost && (
              <button
                onClick={() => setShowPlayers(v => !v)}
                className="w-11 h-11 rounded-full border border-gold/40 bg-black/50 hover:border-gold active:scale-95 flex items-center justify-center shadow-xl transition-all text-gold text-base"
                title="Gerenciar jogadores"
              >
                ≡
              </button>
            )}
            <button
              onClick={() => setConfirmLeave(true)}
              className="w-11 h-11 rounded-full border border-danger/40 bg-black/50 hover:border-danger active:scale-95 flex items-center justify-center shadow-xl transition-all text-danger text-base"
              title="Sair da partida"
            >
              ✕
            </button>
          </div>
        </div>

        {confirmLeave && (
          <div className="fixed inset-0 z-50 bg-[rgba(7,20,16,0.88)] backdrop-blur-[3px] flex items-center justify-center p-5">
            <div className="w-full max-w-sm text-center flex flex-col items-center gap-5">
              <span className="font-display text-cream text-4xl leading-tight">Sair da partida?</span>
              <span className="font-display italic text-gold/70 text-[15px]">
                {isHost ? 'O jogo será encerrado para todos.' : 'Você será removido da mesa.'}
              </span>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="flex-1 h-13 rounded-xl border border-gold/45 text-cream font-semibold text-[15px] transition-all hover:bg-white/[0.04] active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { mp.disconnect(); router.push('/'); }}
                  className="flex-1 h-13 rounded-xl border border-danger/50 text-danger font-semibold text-[15px] transition-all hover:bg-card-red/10 active:scale-95"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}

        {chatWidget}
      </>
    );
  }

  // Lobby
  const roomUrl = typeof window !== 'undefined' ? `${window.location.origin}/sala/${roomCode}` : '';
  const canStart = mp.lobbyPlayers.length >= 2;
  // The deck caps the match length; only offer limits that actually fit.
  const deckLimit = maxRoundsFor(Math.max(2, mp.lobbyPlayers.length));
  const roundOptions = [3, 5, 8, 10].filter((n) => n < deckLimit);
  const effectiveLimit = roundLimit && roundLimit < deckLimit ? roundLimit : deckLimit;

  return (
    <>
      <div className="min-h-screen lobby-bg flex flex-col items-center justify-center p-7">
        <div className="w-full max-w-sm flex flex-col">
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-display italic text-gold text-base">sua mesa está pronta</span>
            <h1 className="font-display text-cream text-4xl leading-none text-center">
              Sala {isHost ? (playerName ?? '') : roomCode}
            </h1>
          </div>

          <div className="mt-7 bg-white/[0.04] border border-gold/35 rounded-2xl px-5 py-[18px] flex flex-col gap-3">
            <span className="text-cream/55 text-[11px] tracking-[2px]">CÓDIGO DA MESA</span>
            <div className="flex justify-between items-center">
              <span className="font-display text-cream text-4xl tracking-[10px]">{roomCode}</span>
              <button
                onClick={() => navigator.clipboard.writeText(roomUrl)}
                className="btn-gold h-[42px] px-[18px] rounded-[10px] font-bold text-[13.5px] transition-all hover:brightness-110 active:scale-95"
              >
                Copiar link
              </button>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            <span className="text-cream/55 text-[12.5px] text-center">
              mande no grupo — quem clicar senta na mesa
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <div className="flex justify-between items-baseline px-1">
              <span className="text-cream/55 text-[11px] tracking-[2px]">NA MESA</span>
              <span className="text-cream/55 text-xs">
                {mp.lobbyPlayers.length} jogador{mp.lobbyPlayers.length > 1 ? 'es' : ''}
              </span>
            </div>
            {mp.lobbyPlayers.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-[14px] bg-white/[0.04] border ${
                  p.id === mp.myPlayerId ? 'border-gold/35' : 'border-white/10'
                }`}
              >
                <div
                  className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-[13px]"
                  style={
                    p.id === mp.hostId
                      ? { background: '#c9a55a', color: '#0b1f18' }
                      : { background: avatarColor(p.id), color: '#ead9ac' }
                  }
                >
                  {initials(p.name)}
                </div>
                <div className="flex flex-col gap-px flex-1">
                  <span className="text-cream font-semibold text-sm">{p.name}</span>
                  <span className={p.id === mp.hostId ? 'text-cream/55 text-xs' : 'text-ok text-xs'}>
                    {p.id === mp.hostId ? 'anfitrião' : 'pronto'}
                  </span>
                </div>
                {p.id === mp.myPlayerId && <span className="text-gold text-base">♠</span>}
                {isHost && p.id !== mp.hostId && (
                  <button
                    onClick={() => mp.kickPlayer(p.id)}
                    className="text-danger/50 hover:text-danger text-sm px-1.5 py-0.5 rounded transition-colors"
                    title="Remover da sala"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {mp.lobbyPlayers.length < 2 && (
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] border border-dashed border-gold/30">
                <div className="w-[38px] h-[38px] rounded-full border border-dashed border-gold/40 flex items-center justify-center text-cream/35">
                  ?
                </div>
                <span className="text-cream/40 text-[13.5px] italic">esperando a galera entrar…</span>
              </div>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3">
            {mp.role === 'host' && (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-baseline px-1">
                    <span className="text-cream/55 text-[11px] tracking-[2px]">RODADAS</span>
                    <span className="text-cream/45 text-xs">
                      {effectiveLimit} rodada{effectiveLimit > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {roundOptions.map((n) => (
                      <button
                        key={n}
                        onClick={() => setRoundLimit(n)}
                        className={[
                          'h-9 px-3.5 rounded-[10px] text-[13.5px] transition-all',
                          roundLimit === n
                            ? 'bg-gold text-ink font-bold'
                            : 'border border-gold/30 text-cream/60 hover:border-gold/60 hover:text-cream',
                        ].join(' ')}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      onClick={() => setRoundLimit(null)}
                      className={[
                        'h-9 px-3.5 rounded-[10px] text-[13.5px] transition-all',
                        roundLimit === null
                          ? 'bg-gold text-ink font-bold'
                          : 'border border-gold/30 text-cream/60 hover:border-gold/60 hover:text-cream',
                      ].join(' ')}
                    >
                      Tudo ({deckLimit})
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => mp.startGame(effectiveLimit)}
                  disabled={!canStart}
                  className="btn-gold h-13 rounded-xl font-bold text-base transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {canStart
                    ? `Começar com ${mp.lobbyPlayers.length} jogadores`
                    : 'Aguardando jogadores…'}
                </button>
                <p className="text-center text-cream/45 text-xs">
                  {canStart
                    ? 'pode começar agora ou esperar mais gente entrar'
                    : 'compartilhe o código — precisa de pelo menos 2'}
                </p>
              </>
            )}
            {mp.role === 'guest' && (
              <>
                <p className="font-display italic text-gold text-[15px] text-center animate-pulse">
                  aguardando o anfitrião abrir o jogo…
                </p>
                <button
                  onClick={() => { mp.leaveLobby(); router.push('/'); }}
                  className="h-11 rounded-xl border border-danger/40 text-danger/80 hover:text-danger font-semibold text-sm transition-all hover:border-danger/70 active:scale-95"
                >
                  Sair da sala
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {chatWidget}
    </>
  );
}
