import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// iOS home-screen icon — same felt + gold spade as the favicon, brand wordmark.
// The spade is drawn as SVG (not the ♠ glyph) so it renders in gold, not as a
// dark emoji.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #14352a 0%, #0b1f18 60%, #071410 100%)',
        }}
      >
        <svg width="96" height="96" viewBox="0 0 32 32" fill="#c9a55a">
          <path d="M16 5.5 L8 17 L24 17 Z" />
          <circle cx="11.3" cy="16.6" r="5.1" />
          <circle cx="20.7" cy="16.6" r="5.1" />
          <path d="M16 15 C 15.1 20.4 12.4 21 12.4 24.6 L 19.6 24.6 C 19.6 21 16.9 20.4 16 15 Z" />
        </svg>
        <div style={{ fontSize: 40, letterSpacing: 4, color: '#ead9ac', fontWeight: 700, marginTop: 4 }}>
          FDP
        </div>
      </div>
    ),
    { ...size }
  );
}
