'use client';

// Tiny synthesized sound cues via the Web Audio API — no audio files, so
// nothing to license, download, or cache. Each cue is a couple of short notes.

export type SoundName =
  | 'turn'        // it's your move
  | 'play'        // a card hits the felt
  | 'trickWin'    // you took the vaza
  | 'chat'        // a new message from someone else
  | 'warning'     // your clock is running out
  | 'victory'     // you won the match
  | 'defeat';     // you were eliminated

const MUTE_KEY = 'fdp-muted';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // Browsers start the context suspended until a user gesture; resume lazily.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function setMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
}

// One note: frequency (Hz), start offset (s), length (s), peak gain, waveform.
type Note = [freq: number, at: number, dur: number, gain?: number, type?: OscillatorType];

const CUES: Record<SoundName, Note[]> = {
  turn:     [[587, 0, 0.12, 0.18], [880, 0.1, 0.16, 0.18]],
  play:     [[320, 0, 0.06, 0.12, 'triangle']],
  trickWin: [[659, 0, 0.1, 0.16], [988, 0.09, 0.18, 0.16]],
  chat:     [[740, 0, 0.08, 0.12, 'sine']],
  warning:  [[440, 0, 0.09, 0.16, 'square']],
  victory:  [[523, 0, 0.14, 0.2], [659, 0.13, 0.14, 0.2], [784, 0.26, 0.14, 0.2], [1047, 0.39, 0.3, 0.22]],
  defeat:   [[392, 0, 0.18, 0.18], [294, 0.16, 0.28, 0.18]],
};

export function playSound(name: SoundName) {
  if (isMuted()) return;
  const audio = getCtx();
  if (!audio) return;

  const now = audio.currentTime;
  for (const [freq, at, dur, gain = 0.15, type = 'sine'] of CUES[name]) {
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    // Quick attack, smooth exponential release — no clicks.
    env.gain.setValueAtTime(0.0001, now + at);
    env.gain.exponentialRampToValueAtTime(gain, now + at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(env).connect(audio.destination);
    osc.start(now + at);
    osc.stop(now + at + dur + 0.02);
  }
}
