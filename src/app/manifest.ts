import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FDP — Filho da Puta',
    short_name: 'FDP',
    description:
      'O clássico jogo de cartas brasileiro. Declare seus tentos, blefe e seja o último de pé.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0b1f18',
    theme_color: '#0b1f18',
    lang: 'pt-BR',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
