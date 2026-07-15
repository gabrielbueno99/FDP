import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    'FDP: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados — o modo online não vai conectar. Veja .env.example.'
  );
}

// Fallback placeholders keep the app rendering (solo mode works offline);
// online mode simply fails to connect until the env vars are set.
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    realtime: {
      // Default heartbeat is 25s — mobile carriers/NATs drop idle sockets
      // before that. Pinging more often keeps the connection alive and
      // detects drops sooner.
      heartbeatIntervalMs: 15000,
      // Reconnect fast, then back off (default waits much longer)
      reconnectAfterMs: (tries: number) => Math.min(1000 * 2 ** (tries - 1), 10000),
    },
  }
);
