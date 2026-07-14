/**
 * cardTextures.js
 * Generates card face/back textures via Canvas 2D and caches them.
 * Shared across the whole app — no duplicate GPU uploads.
 */
import * as THREE from 'three';

const _cache = new Map();

const SYMBOL = { clubs: '♣', hearts: '♥', spades: '♠', diamonds: '♦' };
const RED    = new Set(['hearts', 'diamonds']);
const SIZE   = 256;

function canvasToTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.minFilter      = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function getCardBack() {
  const key = '__back__';
  if (_cache.has(key)) return _cache.get(key);

  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');

  // Background
  ctx.fillStyle = '#0d1929';
  roundRect(ctx, 2, 2, SIZE - 4, SIZE - 4, SIZE * 0.08);
  ctx.fill();

  // Grid pattern
  ctx.strokeStyle = 'rgba(0,212,255,0.12)';
  ctx.lineWidth = 1;
  const step = SIZE / 8;
  for (let i = 0; i <= SIZE; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(SIZE, i); ctx.stroke();
  }

  // FDP logo
  ctx.fillStyle   = 'rgba(0,212,255,0.7)';
  ctx.font        = `bold ${SIZE * 0.22}px serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FDP', SIZE / 2, SIZE * 0.52);

  // Cyan border
  ctx.strokeStyle = 'rgba(0,212,255,0.35)';
  ctx.lineWidth   = 4;
  roundRect(ctx, 4, 4, SIZE - 8, SIZE - 8, SIZE * 0.07);
  ctx.stroke();

  const t = canvasToTexture(c);
  _cache.set(key, t);
  return t;
}

export function getCardFace(suit, value, { isManilha = false, isWinning = false } = {}) {
  const key = `${suit}-${value}-${isManilha}-${isWinning}`;
  if (_cache.has(key)) return _cache.get(key);

  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  const r = SIZE * 0.08;

  // White card body
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 2, 2, SIZE - 4, SIZE - 4, r);
  ctx.fill();

  // Winning: emerald border glow
  if (isWinning) {
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth   = 6;
    ctx.shadowColor = 'rgba(52,211,153,0.7)';
    ctx.shadowBlur  = 14;
    roundRect(ctx, 3, 3, SIZE - 6, SIZE - 6, r);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Manilha: cyan border glow
  if (isManilha && !isWinning) {
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth   = 6;
    ctx.shadowColor = 'rgba(0,212,255,0.75)';
    ctx.shadowBlur  = 14;
    roundRect(ctx, 3, 3, SIZE - 6, SIZE - 6, r);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const sym   = SYMBOL[suit] ?? suit;
  const isRed = RED.has(suit);
  const color = isRed ? '#dc2626' : '#1e293b';

  // Top-left corner: value
  ctx.fillStyle    = color;
  ctx.font         = `bold ${SIZE * 0.2}px system-ui`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(value, SIZE * 0.08, SIZE * 0.05);

  // Top-left corner: suit symbol
  ctx.font         = `${SIZE * 0.16}px system-ui`;
  ctx.textBaseline = 'top';
  ctx.fillText(sym, SIZE * 0.09, SIZE * 0.26);

  // Center symbol
  ctx.font         = `${SIZE * 0.4}px system-ui`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sym, SIZE / 2, SIZE * 0.63);

  // Manilha badge
  if (isManilha) {
    ctx.fillStyle    = '#22d3ee';
    ctx.font         = `bold ${SIZE * 0.09}px system-ui`;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('M', SIZE * 0.93, SIZE * 0.06);
  }

  const t = canvasToTexture(c);
  _cache.set(key, t);
  return t;
}

/** Wipes all cached textures (call on scene teardown). */
export function disposeCardTextures() {
  for (const t of _cache.values()) t.dispose();
  _cache.clear();
}
