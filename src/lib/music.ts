'use client';

// Background lounge track — "A Good Bass for Gambling" by Komiku, released
// into the public domain (CC0) via FreePD.com. Shipped in /public/audio, so
// there is nothing external to load or license.
//
// Singleton <audio> so the track survives re-renders and keeps playing across
// screens. Off by default: browsers block autoplay anyway, and the first tap
// on the toggle doubles as the user gesture that unlocks playback.

const KEY = 'fdp-music';
const TRACK = '/audio/lounge.mp3';
const VOLUME = 0.22;

let audio: HTMLAudioElement | null = null;

function ensure(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(TRACK);
    audio.loop = true;
    audio.volume = VOLUME;
    audio.preload = 'none';
  }
  return audio;
}

export function isMusicOn(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY) === '1';
}

export function setMusicOn(on: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, on ? '1' : '0');
  if (on) {
    ensure().play().catch(() => {/* autoplay blocked until a gesture — fine */});
  } else {
    audio?.pause();
  }
}

// Called when a screen that wants music mounts: resumes the track if the
// player had it enabled. Safe to call repeatedly.
export function resumeMusicIfEnabled() {
  if (isMusicOn()) ensure().play().catch(() => {});
}
