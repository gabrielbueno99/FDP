'use client';
import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../lib/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  myPlayerId: number | null;
  onSend: (text: string) => void;
}

const COLORS = [
  'text-amber-400',
  'text-blue-400',
  'text-green-400',
  'text-pink-400',
  'text-purple-400',
  'text-cyan-400',
  'text-orange-400',
  'text-rose-400',
];

export function ChatPanel({ messages, myPlayerId, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-amber-900/50 text-xs text-center mt-6">
            Nenhuma mensagem ainda...
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.playerId === myPlayerId;
          const color = COLORS[msg.playerId % COLORS.length];
          return (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
              {!isMine && (
                <span className={`text-[10px] font-bold px-1 ${color}`}>{msg.name}</span>
              )}
              <div className={`max-w-[82%] px-3 py-1.5 rounded-2xl text-sm leading-snug break-words ${
                isMine
                  ? 'bg-amber-700/70 text-amber-100 rounded-br-none'
                  : 'bg-black/50 text-amber-100 rounded-bl-none border border-amber-900/30'
              }`}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 px-3 py-2.5 border-t border-amber-900/30 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Mensagem..."
          maxLength={200}
          className="flex-1 bg-black/40 border border-amber-800/40 text-amber-100 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-600/70 transition-colors placeholder-amber-900/50"
        />
        <button
          onClick={submit}
          disabled={!input.trim()}
          className="bg-amber-700 hover:bg-amber-600 disabled:bg-amber-950/50 disabled:text-amber-900/40 text-amber-100 font-bold px-4 rounded-xl transition-colors border border-amber-600/40"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
