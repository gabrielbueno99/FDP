'use client';
import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../lib/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  myPlayerId: number | null;
  onSend: (text: string) => void;
}

// Provocações prontas — um toque manda pra mesa
const TAUNTS = [
  'Chora mais!',
  'Táca-le pau!',
  'Essa doeu, hein?',
  'Manilha na manga?',
  'Amador…',
  'Paga a rodada!',
  'Vai de zero de novo?',
  'FDP!',
];

// Anti-spam: more than BURST messages inside WINDOW_MS earns a COOLDOWN_MS lock.
const BURST = 5;
const WINDOW_MS = 8000;
const COOLDOWN_MS = 15000;

export function ChatPanel({ messages, myPlayerId, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const sentTimesRef = useRef<number[]>([]);
  const cooldownUntilRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Tick the visible cooldown countdown while it's active.
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => {
      const left = Math.ceil((cooldownUntilRef.current - Date.now()) / 1000);
      setCooldownLeft(left > 0 ? left : 0);
    }, 250);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  const submit = () => {
    if (Date.now() < cooldownUntilRef.current) return;
    const text = input.trim();
    if (!text) return;

    const now = Date.now();
    sentTimesRef.current = [...sentTimesRef.current.filter((t) => now - t < WINDOW_MS), now];
    if (sentTimesRef.current.length > BURST) {
      cooldownUntilRef.current = now + COOLDOWN_MS;
      sentTimesRef.current = [];
      setCooldownLeft(Math.ceil(COOLDOWN_MS / 1000));
    }

    onSend(text);
    setInput('');
  };

  const onCooldown = cooldownLeft > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-2.5">
        {messages.length === 0 && (
          <p className="text-cream/35 text-xs text-center mt-6 italic">
            nenhuma mensagem ainda…
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.playerId === myPlayerId;
          return (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
              {!isMine && (
                <span className="text-gold text-[10.5px] font-bold px-1">{msg.name.toUpperCase()}</span>
              )}
              <div
                className={`max-w-[82%] px-3 py-[7px] rounded-xl text-[13px] leading-snug break-words text-cream ${
                  isMine
                    ? 'bg-gold/20 border border-gold/35 rounded-br-[3px]'
                    : 'bg-white/[0.06] border border-white/10 rounded-bl-[3px]'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-1.5 px-3.5 pt-2 overflow-x-auto shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TAUNTS.map((t) => (
          <button
            key={t}
            onClick={() => onSend(t)}
            className="whitespace-nowrap text-[11.5px] px-2.5 py-1 rounded-full border border-white/12 text-cream/70 hover:text-cream hover:border-gold/50 active:scale-95 transition-all"
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-2 px-3.5 py-2.5 border-t border-white/10 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={onCooldown ? `Calma… espere ${cooldownLeft}s` : 'Mensagem…'}
          maxLength={200}
          disabled={onCooldown}
          className="flex-1 h-[38px] bg-white/5 border border-white/10 text-cream rounded-[10px] px-3 text-[13px] outline-none focus:border-gold/60 transition-colors placeholder:text-cream/35 disabled:opacity-60"
        />
        <button
          onClick={submit}
          disabled={!input.trim() || onCooldown}
          className="btn-gold w-[38px] h-[38px] rounded-[10px] font-bold text-base transition-all hover:brightness-110 disabled:opacity-40"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
