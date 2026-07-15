# FDP — Filho da Puta

Jogo de cartas brasileiro (estilo "Fodinha") para jogar no navegador — solo contra bots ou online com amigos.

## Regras

- Na rodada N, cada jogador recebe N cartas. Uma carta é virada (**vira**) e define a **manilha** (o valor seguinte).
- Cada jogador declara quantas vazas (**tentos**) vai fazer. O dealer declara por último e não pode fechar a conta exata da rodada.
- Errou a declaração, perde 1 ponto. Todos começam com 5. Zerou, está fora. Último sobrevivente vence.
- A rodada 1 é às cegas: você vê a carta de todo mundo, menos a sua.

## Rodando

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O modo solo funciona sem configuração nenhuma.

## Modo online

O multiplayer usa [Supabase Realtime](https://supabase.com/docs/guides/realtime) (canais de broadcast — não precisa de banco). Crie um projeto gratuito no Supabase, copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

O criador da sala (host) é a autoridade do jogo: aplica as ações de todos, roda os bots e envia para cada jogador uma versão do estado só com o que ele pode ver.

## Estrutura

- `src/lib/game.ts` — regras e transições de estado (puro, sem UI)
- `src/lib/deck.ts` — baralho, força das cartas, manilha
- `src/lib/ai.ts` — bots
- `src/hooks/useGame.ts` — loop de jogo local/solo
- `src/hooks/useMultiplayer.ts` — sala online (host autoritativo via Supabase Realtime)
- `src/components/` — mesa, cartas, declaração, chat
