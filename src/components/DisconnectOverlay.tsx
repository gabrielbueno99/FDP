'use client';

interface DisconnectOverlayProps {
  player: { id: number; name: string };
  isHost: boolean;
  onRemove: () => void;
}

export function DisconnectOverlay({ player, isHost, onRemove }: DisconnectOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(7,20,16,0.88)] backdrop-blur-[3px] flex items-center justify-center p-5">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-full border border-danger/50 bg-card-red/10 flex items-center justify-center">
          <span className="text-2xl">📶</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-display text-cream text-4xl leading-tight">
            {player.name} caiu.
          </span>
          <span className="font-display italic text-danger text-[17px]">
            jogo pausado — aguardando reconexão
          </span>
        </div>

        {isHost ? (
          <button
            onClick={onRemove}
            className="w-full h-13 rounded-xl border border-danger/50 text-danger font-semibold text-[15px] transition-all hover:bg-card-red/10 active:scale-95"
          >
            Remover da partida
          </button>
        ) : (
          <p className="text-cream/45 text-xs">
            apenas o anfitrião pode remover jogadores
          </p>
        )}
      </div>
    </div>
  );
}
