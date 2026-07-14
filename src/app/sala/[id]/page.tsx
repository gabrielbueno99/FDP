'use client';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiplayer } from '../../../hooks/useMultiplayer';
import { useGame } from '../../../hooks/useGame';
import { GameBoard } from '../../../components/GameBoard';
import { DisconnectOverlay } from '../../../components/DisconnectOverlay';
import { ChatPanel } from '../../../components/ChatPanel';

interface PageProps {
  params: Promise<{ id: string }>;
}

function JoinForm({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="min-h-screen wood-bg flex items-center justify-center p-6">
      <div className="bg-black/30 border border-amber-800/35 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 backdrop-blur-sm shadow-2xl">
        <h2 className="text-amber-200 font-bold text-xl text-center tracking-wide">Entrar na Sala</h2>
        <div className="flex flex-col gap-2">
          <label className="text-amber-800/70 text-xs uppercase tracking-widest">Seu nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && onJoin(name.trim())}
            placeholder="Como te chamamos?"
            maxLength={16}
            className="bg-black/40 border border-amber-800/40 text-amber-100 rounded-xl px-4 py-3 outline-none focus:border-amber-500/70 transition-colors placeholder-amber-900/50"
          />
        </div>
        <button
          onClick={() => name.trim() && onJoin(name.trim())}
          disabled={!name.trim()}
          className="bg-green-800 hover:bg-green-700 disabled:bg-amber-950/40 disabled:text-amber-900/40 text-green-100 font-bold py-3 rounded-xl transition-colors border border-green-700/40 shadow-lg"
        >
          Entrar
        </button>
      </div>
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
  const [playerCount] = useState(() => {
    if (typeof window !== 'undefined') return Number(sessionStorage.getItem('fdp-playercount') ?? '4');
    return 4;
  });

  const [nameInput, setNameInput] = useState<string | null>(playerName);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevMsgCount = useRef(0);

  const isHost = typeof window !== 'undefined' && sessionStorage.getItem('fdp-host-room') === roomCode;

  const mp = useMultiplayer(roomCode, nameInput, isHost);

  useEffect(() => {
    if (mp.role === 'host' && mp.isConnected && nameInput) {
      // host ready
    }
  }, [mp.role, mp.isConnected, nameInput]);

  useEffect(() => {
    const newCount = mp.chatMessages.length;
    if (newCount > prevMsgCount.current && !chatOpen) {
      setUnread((u) => u + (newCount - prevMsgCount.current));
    }
    prevMsgCount.current = newCount;
  }, [mp.chatMessages.length, chatOpen]);

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
        onJoin={(n) => {
          sessionStorage.setItem('fdp-name', n);
          setNameInput(n);
          setPlayerName(n);
        }}
      />
    );
  }

  if (mp.error) {
    return (
      <div className="min-h-screen wood-bg flex items-center justify-center p-6">
        <div className="bg-black/30 border border-red-800/40 rounded-2xl p-6 max-w-sm w-full text-center flex flex-col gap-4 backdrop-blur-sm shadow-2xl">
          <div className="text-red-400 text-4xl">⚠</div>
          <p className="text-amber-100 font-semibold">{mp.error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-amber-900/50 hover:bg-amber-800/60 text-amber-300 font-bold py-3 rounded-xl transition-colors border border-amber-800/30"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  if (!mp.isConnected || mp.role === 'connecting') {
    return (
      <div className="min-h-screen wood-bg flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="font-display font-black text-amber-400 text-5xl tracking-widest">FDP</div>
          <div className="text-amber-700/60 animate-pulse text-sm">Conectando à sala {roomCode}...</div>
        </div>
      </div>
    );
  }

  if (mp.gameState) {
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

        {/* Chat toggle button */}
        <button
          onClick={() => { setChatOpen(true); setUnread(0); }}
          className="fixed top-2.5 right-2.5 z-30 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-amber-800/50 shadow-lg hover:bg-amber-900/60 transition-colors"
        >
          <span className="text-base leading-none">💬</span>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* Chat bottom sheet */}
        {chatOpen && (
          <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-amber-950/98 border-t-2 border-amber-800/50 shadow-2xl" style={{ height: '55vh' }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-900/30 shrink-0">
              <span className="text-amber-200 font-bold text-sm">Chat da Sala</span>
              <button
                onClick={() => setChatOpen(false)}
                className="text-amber-700 hover:text-amber-300 text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>
            <ChatPanel
              messages={mp.chatMessages}
              myPlayerId={mp.myPlayerId}
              onSend={mp.sendChat}
            />
          </div>
        )}

        {mp.disconnectedPlayer && (
          <DisconnectOverlay
            player={mp.disconnectedPlayer}
            isHost={isHost}
            onRemove={mp.removeDisconnectedPlayer}
          />
        )}
      </>
    );
  }

  // Lobby
  const roomUrl = typeof window !== 'undefined' ? `${window.location.origin}/sala/${roomCode}` : '';

  return (
    <div className="min-h-screen wood-bg flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="font-display font-black text-amber-400 text-5xl tracking-widest drop-shadow-[0_0_16px_rgba(251,191,36,0.25)]">
        FDP
      </h1>

      <div className="bg-black/30 border border-amber-800/35 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 backdrop-blur-sm shadow-2xl">
        <div className="text-center">
          <p className="text-amber-800/60 text-[10px] uppercase tracking-widest mb-1">Código da Sala</p>
          <p className="font-display font-black text-amber-400 text-4xl tracking-widest">{roomCode}</p>
        </div>

        <div className="flex gap-2">
          <input
            readOnly
            value={roomUrl}
            className="flex-1 bg-black/40 text-amber-700/70 text-xs rounded-xl px-3 py-2 outline-none truncate border border-amber-900/30"
          />
          <button
            onClick={() => navigator.clipboard.writeText(roomUrl)}
            className="bg-amber-800/50 hover:bg-amber-700/60 text-amber-300 text-xs px-3 py-2 rounded-xl transition-colors border border-amber-700/30 whitespace-nowrap"
          >
            Copiar
          </button>
        </div>

        <div>
          <p className="text-amber-700/60 text-xs mb-2 uppercase tracking-widest">
            Jogadores ({mp.lobbyPlayers.length}/{playerCount})
          </p>
          <div className="space-y-2">
            {mp.lobbyPlayers.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-black/25 rounded-xl px-3 py-2 border border-amber-900/20">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_4px_rgba(74,222,128,0.5)]" />
                <span className="text-amber-100 text-sm">
                  {p.name}
                  {p.id === 0 && <span className="text-amber-700/60 text-xs"> (host)</span>}
                  {p.id === mp.myPlayerId && p.id !== 0 && <span className="text-amber-700/60 text-xs"> (você)</span>}
                </span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, playerCount - mp.lobbyPlayers.length) }, (_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2 bg-black/15 rounded-xl px-3 py-2 border border-amber-900/10">
                <div className="w-2 h-2 rounded-full bg-amber-900/40" />
                <span className="text-amber-900/50 text-sm">Aguardando...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat in lobby */}
        <div className="flex flex-col border border-amber-900/30 rounded-xl overflow-hidden bg-black/20" style={{ height: '180px' }}>
          <div className="px-3 py-1.5 border-b border-amber-900/25 shrink-0">
            <span className="text-amber-800/60 text-[10px] uppercase tracking-widest">Chat</span>
          </div>
          <ChatPanel
            messages={mp.chatMessages}
            myPlayerId={mp.myPlayerId}
            onSend={mp.sendChat}
          />
        </div>

        {mp.role === 'host' && (
          <button
            onClick={() => mp.startGame(playerCount)}
            disabled={mp.lobbyPlayers.length < 1}
            className="bg-amber-700 hover:bg-amber-600 disabled:bg-amber-950/40 disabled:text-amber-900/40 text-amber-100 font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 border border-amber-600/40 shadow-lg"
          >
            Iniciar Partida
            {mp.lobbyPlayers.length < playerCount && (
              <span className="text-xs font-normal ml-1 opacity-70">(bots para vagas vazias)</span>
            )}
          </button>
        )}

        {mp.role === 'guest' && (
          <p className="text-amber-700/50 text-sm text-center animate-pulse">
            Aguardando o host iniciar...
          </p>
        )}
      </div>
    </div>
  );
}
