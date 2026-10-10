// The living sky: the score sets the mood, the clock sets the light.
// Pure functions (no React) so the colours are easy to test and tune.
//
// Three colour stops (overhead, middle, horizon) are the score's sky, tinted
// toward real twilight colours as the sun rises and sets. A soft glow marks
// where the sun (or moon) is, and haze density follows cloud cover.

import type { Sun } from './weather';
import { skyFor } from './theme';

export type SkyLook = {
  colors: [string, string, string]; // overhead, middle, horizon
  glow: { x: number; y: number; color: string; strength: number }; // x, y are 0-1 of the screen
  haze: number; // 0-1, how much drifting haze to show
  fall: 'rain' | 'snow' | null; // something falling from the sky right now
};

// ---------- colour helpers ----------
type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);

// Darken a colour just enough that white text on it stays comfortably readable.
function keepReadable(c: RGB, maxLum: number): RGB {
  if (luminance(c) <= maxLum) return c;
  let lo = 0, hi = 1; // how much of the colour to keep
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(c.map((v) => v * mid) as RGB) <= maxLum) lo = mid;
    else hi = mid;
  }
  return c.map((v) => v * lo) as RGB;
}
// White on these limits is about 5.5:1 or better, with room for the glow on top.
const MAX_LUM: [number, number, number] = [0.15, 0.13, 0.11];

// ---------- the light through the day ----------
// Each phase tints overhead / middle / horizon toward a colour by an amount.
type Tint = [string, number];
type Phase = { top: Tint; mid: Tint; hor: Tint };
const NONE: Tint = ['#000000', 0];
const PHASE: Record<string, Phase> = {
  night: { top: ['#070b1e', 0.72], mid: ['#0e1533', 0.66], hor: ['#18203f', 0.6] },
  blue: { top: ['#121a42', 0.58], mid: ['#283166', 0.5], hor: ['#5a4a7a', 0.48] }, // blue hour
  dawn: { top: ['#2c3a6e', 0.36], mid: ['#7c6a8e', 0.34], hor: ['#e08c7a', 0.5] },
  day: { top: NONE, mid: NONE, hor: NONE },
  // Warm tints are already deep and saturated, and applied strongly at the horizon,
  // so blue + orange doesn't turn to grey mud and the readability guard has little to darken.
  golden: { top: ['#24497e', 0.15], mid: ['#7c5c80', 0.32], hor: ['#a8623a', 0.68] },
  sunset: { top: ['#2e2a66', 0.4], mid: ['#7a3f6e', 0.48], hor: ['#b24e3c', 0.76] },
  dusk: { top: ['#181d48', 0.58], mid: ['#4a3a72', 0.5], hor: ['#8e5072', 0.5] },
};

const MIN = 60 * 1000;

// Keyframes for one day, in ms, relative to that day's sunrise (r) and sunset (s).
function keyframes(sun: Sun): [number, Phase][] {
  const r = sun.rise.getTime();
  const s = sun.set.getTime();
  return [
    [r - 90 * MIN, PHASE.night],
    [r - 30 * MIN, PHASE.blue],
    [r, PHASE.dawn],
    [r + 60 * MIN, PHASE.day],
    [s - 90 * MIN, PHASE.day],
    [s - 40 * MIN, PHASE.golden],
    [s, PHASE.sunset],
    [s + 35 * MIN, PHASE.dusk],
    [s + 80 * MIN, PHASE.night],
  ];
}

const apply = (base: RGB, [tint, amt]: Tint): RGB => mixRGB(base, hex(tint), amt);

/**
 * The sky for a score at a moment. `now` and `sun` are the location's wall
 * clock. Pass `now = null` for a day other than today: you get its daytime sky.
 */
export function skyLook(
  score: number, now: Date | null, sun: Sun | undefined, cloud: number, fall: SkyLook['fall'] = null,
): SkyLook {
  const [top, hor] = skyFor(score).map(hex) as [RGB, RGB];
  const base: [RGB, RGB, RGB] = [top, mixRGB(top, hor, 0.55), hor];

  let phaseColors: [RGB, RGB, RGB] = base;
  if (now && sun) {
    const t = now.getTime();
    const frames = keyframes(sun).map(([at, p]) => [at, [apply(base[0], p.top), apply(base[1], p.mid), apply(base[2], p.hor)]] as const);
    if (t <= frames[0][0]) phaseColors = [...frames[0][1]] as [RGB, RGB, RGB];
    else if (t >= frames[frames.length - 1][0]) phaseColors = [...frames[frames.length - 1][1]] as [RGB, RGB, RGB];
    else {
      for (let i = 1; i < frames.length; i++) {
        const [t1, c1] = frames[i];
        if (t <= t1) {
          const [t0, c0] = frames[i - 1];
          const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
          phaseColors = [0, 1, 2].map((j) => mixRGB(c0[j], c1[j], k)) as [RGB, RGB, RGB];
          break;
        }
      }
    }
  }

  const colors = phaseColors.map((c, i) => toHex(keepReadable(c, MAX_LUM[i]))) as [string, string, string];
  return { colors, glow: glowAt(now, sun, cloud), haze: Math.max(0, Math.min(1, cloud / 100)), fall };
}

// Where the sun (or moon) is, and how strong its glow should be.
function glowAt(now: Date | null, sun: Sun | undefined, cloud: number) {
  const clouds = 1 - 0.6 * (cloud / 100); // overcast mutes the glow
  if (!now || !sun) return { x: 0.5, y: 0.28, color: '#fff6e2', strength: 0.1 * clouds };

  const r = sun.rise.getTime();
  const s = sun.set.getTime();
  const t = now.getTime();
  const f = (t - r) / (s - r); // 0 at sunrise, 1 at sunset

  if (f > -0.08 && f < 1.08) {
    // Daytime arc: low on the left at sunrise, high at noon, low on the right at sunset.
    const ff = Math.max(0, Math.min(1, f));
    const altitude = Math.sin(Math.PI * ff);
    const low = (1 - altitude) ** 2; // 1 near the horizon
    const fadeOut = f < 0 ? 1 + f / 0.08 : f > 1 ? 1 - (f - 1) / 0.08 : 1; // fades just past the horizon
    return {
      x: 0.14 + 0.72 * ff,
      y: 0.76 - 0.5 * altitude,
      color: low > 0.5 ? '#ffc490' : '#fff3dc',
      strength: (0.08 + 0.14 * low) * clouds * fadeOut,
    };
  }

  // Night: a faint cool glow crossing the sky between sunset and sunrise.
  const nightLength = 24 * 60 * MIN - (s - r);
  const since = t > s ? t - s : t + 24 * 60 * MIN - s; // time since last sunset
  const nf = Math.max(0, Math.min(1, since / nightLength));
  return { x: 0.18 + 0.64 * nf, y: 0.6 - 0.35 * Math.sin(Math.PI * nf), color: '#dbe4ff', strength: 0.07 * clouds };
}
