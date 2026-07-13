'use client';

interface DisconnectOverlayProps {
  player: { id: number; name: string };
  isHost: boolean;
  onRemove: () => void;
}

export function DisconnectOverlay({ player, isHost, onRemove }: DisconnectOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-amber-950/95 border-2 border-amber-700/40 rounded-2xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-4 shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-red-900/40 border border-red-700/40 flex items-center justify-center">
          <span className="text-2xl">📶</span>
        </div>

        <div>
          <h2 className="text-amber-200 font-bold text-lg">Conexão perdida</h2>
          <p className="text-amber-400 font-black text-2xl mt-1">{player.name}</p>
        </div>

        <p className="text-amber-700/70 text-sm animate-pulse">
          Jogo pausado — aguardando reconexão...
        </p>

        {isHost && (
          <button
            onClick={onRemove}
            className="mt-2 w-full bg-red-900/50 hover:bg-red-800/70 text-red-300 font-bold py-3 rounded-xl transition-all border border-red-700/40 hover:scale-105 active:scale-95"
          >
            Remover da partida
          </button>
        )}

        {!isHost && (
          <p className="text-amber-900/60 text-xs">
            Apenas o criador da sala pode remover jogadores
          </p>
        )}
      </div>
    </div>
  );
}
