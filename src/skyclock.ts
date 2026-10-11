// The living sky: the real weather sets the colour, the clock sets the light.
// Pure functions (no React) so the colours are easy to test and tune.
//
// Three colour stops (overhead, middle, horizon) come from what the sky is doing
// this hour (clear blue, broken cloud, overcast grey, rain, storm, snow), tinted
// toward real twilight colours as the sun rises and sets. Clear nights get stars;
// cloudy nights go charcoal instead of blue. Clouds drift in with cloud cover.

import type { Sun } from './weather';

export type SkyWeather = {
  cloud: number; // 0-100 % cloud cover
  wet: 'rain' | 'snow' | 'storm' | null; // falling right now (or most of that day)
};

export type SkyLook = {
  colors: [string, string, string]; // overhead, middle, horizon
  ink: 'dark' | 'light'; // text colour that reads on this sky
  glow: { x: number; y: number; color: string; strength: number }; // x, y are 0-1 of the screen
  haze: number; // 0-1, how many clouds to show
  night: number; // 0-1, how dark it is (dims the clouds)
  stars: number; // 0-1, how visible the stars are (dark and clear)
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
// White text on these limits is about 5.5:1 or better, with room for the glow on top.
const MAX_LUM: [number, number, number] = [0.14, 0.13, 0.11];

// ---------- the light through the day ----------
// Each phase has a clear-sky look and an overcast look: [overhead, middle, horizon].
// Daytime is airy and pale, sky blue to a warm peach haze at the horizon. Under
// cloud everything drifts to soft greys; at night clear skies are deep navy and
// cloudy ones charcoal.
type Stops = [string, string, string];
const PHASE: Record<string, { clear: Stops; grey: Stops; dark: number }> = {
  night: { clear: ['#08112b', '#121d42', '#232a55'], grey: ['#15161b', '#1d1d23', '#2b2726'], dark: 1 },
  blue: { clear: ['#16224f', '#2c3a72', '#5b5788'], grey: ['#1f2026', '#2b2a31', '#3b3536'], dark: 0.8 }, // blue hour
  dawn: { clear: ['#7d9bcc', '#c4b4cf', '#f4bf9c'], grey: ['#9aa0ab', '#b3b0b2', '#c9bdb2'], dark: 0.3 },
  day: { clear: ['#98c2ea', '#bde0e6', '#f0cd9c'], grey: ['#b4bcc6', '#c6ccd2', '#d6d3cc'], dark: 0 },
  golden: { clear: ['#8fb3d3', '#c5d3c8', '#f2bd82'], grey: ['#a9adb3', '#bcbab4', '#cfc2ae'], dark: 0.05 },
  sunset: { clear: ['#6a7fb0', '#c08e9c', '#f39d6a'], grey: ['#8d8f98', '#a69c9e', '#bba79a'], dark: 0.3 },
  dusk: { clear: ['#26305e', '#4d4578', '#9a6380'], grey: ['#24242b', '#312e35', '#443b3c'], dark: 0.7 },
};
// Rain, storms and snow, by day. At night they fade into the cloudy night sky.
const WET: Record<'rain' | 'storm' | 'snow', Stops> = {
  rain: ['#46525f', '#56626e', '#6c757e'],
  storm: ['#2a2b38', '#3d3d4f', '#545064'],
  snow: ['#9ba7b7', '#b0bac6', '#c9ccd0'],
};

const MIN = 60 * 1000;

// Keyframes for one day, in ms, relative to that day's sunrise (r) and sunset (s).
function keyframes(sun: Sun): [number, string][] {
  const r = sun.rise.getTime();
  const s = sun.set.getTime();
  return [
    [r - 90 * MIN, 'night'],
    [r - 30 * MIN, 'blue'],
    [r, 'dawn'],
    [r + 60 * MIN, 'day'],
    [s - 90 * MIN, 'day'],
    [s - 40 * MIN, 'golden'],
    [s, 'sunset'],
    [s + 35 * MIN, 'dusk'],
    [s + 80 * MIN, 'night'],
  ];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mixStops = (a: RGB[], b: RGB[], t: number) => a.map((c, i) => mixRGB(c, b[i], t));

// One phase's colours for this much cloud.
function phaseStops(name: string, overcast: number): RGB[] {
  const p = PHASE[name];
  return mixStops(p.clear.map(hex), p.grey.map(hex), overcast);
}

// Which phase we're in (blended between keyframes), as colours plus darkness.
function atTime(now: Date | null, sun: Sun | undefined, overcast: number): { stops: RGB[]; dark: number } {
  if (!now || !sun) return { stops: phaseStops('day', overcast), dark: 0 };
  const t = now.getTime();
  const frames = keyframes(sun);
  const at = (i: number) => ({ stops: phaseStops(frames[i][1], overcast), dark: PHASE[frames[i][1]].dark });
  if (t <= frames[0][0]) return at(0);
  if (t >= frames[frames.length - 1][0]) return at(frames.length - 1);
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const k = (t - frames[i - 1][0]) / (frames[i][0] - frames[i - 1][0] || 1);
      const a = at(i - 1);
      const b = at(i);
      return { stops: mixStops(a.stops, b.stops, k), dark: a.dark + (b.dark - a.dark) * k };
    }
  }
  return at(frames.length - 1);
}

// ---------- readability ----------
// Dark text on light skies, white text on dark ones. Whichever wins, nudge the
// sky just enough that small text stays at 4.5:1 or better.
const MIN_LUM = 0.3; // floor under dark text (dark ink is about #141c2b)
function lighten(c: RGB, minLum: number): RGB {
  if (luminance(c) >= minLum) return c;
  let lo = 0, hi = 1; // how far toward white
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(mixRGB(c, [255, 255, 255], mid)) >= minLum) hi = mid;
    else lo = mid;
  }
  return mixRGB(c, [255, 255, 255], hi);
}

/**
 * The sky for this weather at a moment. `now` and `sun` are the location's wall
 * clock. Pass `now = null` for a day other than today: you get its daytime sky.
 */
export function skyLook(weather: SkyWeather, now: Date | null, sun: Sun | undefined): SkyLook {
  const overcast = weather.wet ? 1 : clamp01((weather.cloud - 20) / 70);
  let { stops, dark } = atTime(now, sun, overcast);
  if (weather.wet) stops = mixStops(stops, WET[weather.wet].map(hex), 0.9 * (1 - dark));

  // The middle (behind the score) counts double.
  const lum = (luminance(stops[0]) + 2 * luminance(stops[1]) + luminance(stops[2])) / 4;
  // Rain and storms always read as moody: white text, no flicker at dawn.
  const moody = weather.wet === 'rain' || weather.wet === 'storm';
  const ink: SkyLook['ink'] = !moody && lum >= 0.2 ? 'dark' : 'light';
  const safe = stops.map((c, i) => (ink === 'dark' ? lighten(c, MIN_LUM) : keepReadable(c, MAX_LUM[i])));
  const colors = safe.map(toHex) as [string, string, string];

  const clear = weather.wet ? 0 : clamp01(1 - weather.cloud / 75);
  const glow = glowAt(now, sun, weather.cloud);
  if (ink === 'dark') glow.strength *= 1.5; // a pale sky needs a little more to show the sun
  return {
    colors,
    ink,
    glow,
    haze: weather.wet ? 0.85 : clamp01(weather.cloud / 100),
    night: dark,
    stars: clamp01((dark - 0.5) / 0.5) * clear,
    fall: weather.wet === 'snow' ? 'snow' : weather.wet ? 'rain' : null,
  };
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
