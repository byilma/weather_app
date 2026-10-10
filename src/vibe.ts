// The vibe engine: turns raw hours into a 1-10 score, one word, one sentence,
// and at most one callout (with an optional action button).
// Pure functions, no React, so it is easy to test and tune.

import type { Hour } from './weather';

// The alert's button opens the Plans sheet on this option (links live in partners.ts).
export type Action = { label: string; kind: 'food' | 'ride' };
export type CalloutIcon = 'rain' | 'snow' | 'storm' | 'cold' | 'sun';
export type Callout = { text: string; icon: CalloutIcon; action?: Action };
export type DayVibe = {
  date: Date;
  score: number;
  word: string;
  feeling: string; // the vibe, in a person's words (shown when you tap the word)
  line: string; // what to wear, in a few words: "Jacket and umbrella"
  hours: { time: Date; score: number }[];
};

const ACTIONS: Record<'food' | 'ride', Action> = {
  food: { label: 'Order in', kind: 'food' },
  ride: { label: 'Get a ride', kind: 'ride' },
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---------- hour score ----------

// How good a feels-like temperature is on its own (dry, calm, partly sunny).
// [feels-like °F, score]. Straight lines between points. Tune by editing rows.
// Heat falls off faster than cold: 88° is worse than 50°.
const COMFORT: [number, number][] = [
  [10, 1],
  [20, 1.5],
  [32, 3.5],
  [40, 5],
  [50, 7],
  [58, 8.5],
  [64, 10],
  [76, 10],
  [82, 8.5],
  [87, 6.5],
  [92, 4.5],
  [97, 3],
  [104, 1],
];

function comfort(f: number): number {
  if (f <= COMFORT[0][0]) return COMFORT[0][1];
  for (let i = 1; i < COMFORT.length; i++) {
    const [x1, y1] = COMFORT[i];
    if (f <= x1) {
      const [x0, y0] = COMFORT[i - 1];
      return y0 + ((f - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return COMFORT[COMFORT.length - 1][1];
}

export function scoreHour(h: Hour): number {
  const f = h.feelsLike;
  let s = comfort(f);

  // Rain or snow = how likely x how heavy, and it takes a SHARE of the score
  // rather than a fixed number of points. That keeps cold rain worse than warm
  // rain without every wet winter day collapsing to 1.
  // 10% chance costs nothing, 70%+ costs the full share. Light rain takes half
  // the score, a downpour three quarters. Snow takes less (it doesn't soak you).
  const likely = clamp((h.rainChance - 10) / 60, 0, 1);
  const heavy = (h.sky === 'snow' ? 0.35 : 0.5) + Math.min(0.25, h.precip * 2.5);
  s *= 1 - likely * heavy;
  // Thunder: you can't just walk through it.
  if (h.sky === 'storm' && h.rainChance >= 30) s -= 1.5;

  // Gusty wind.
  if (h.gust > 20) s -= Math.min(3, (h.gust - 20) / 6);
  // Sticky air. Feels-like already includes some humidity; this is the "air you wear" extra.
  if (h.dewPoint > 65) s -= Math.min(2, (h.dewPoint - 65) / 3.5);
  // Light: gloom costs a little. Sun helps on a cool day and hurts on a hot one.
  if (h.isDay && h.cloud > 85) s -= 0.7;
  if (h.isDay && h.cloud < 30 && f < 62) s += 0.6;
  if (h.isDay && h.cloud < 30 && f > 82) s -= 0.6;

  return clamp(Math.round(s), 1, 10);
}

// ---------- days ----------
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function groupDays(hours: Hour[]): Hour[][] {
  const days: Hour[][] = [];
  for (const h of hours) {
    const last = days[days.length - 1];
    if (last && sameDay(last[0].time, h.time)) last.push(h);
    else days.push([h]);
  }
  return days;
}

// The hours people are actually out in.
const waking = (d: Hour[]) => d.filter((h) => h.time.getHours() >= 8 && h.time.getHours() <= 20);

export function vibeForDay(day: Hour[]): DayVibe {
  const awake = waking(day).length ? waking(day) : day;
  const scores = awake.map(scoreHour);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const worst = Math.min(...scores);
  // A miserable stretch drags the day down a bit more than a plain average would.
  const score = clamp(Math.round(mean - 0.25 * (mean - worst)), 1, 10);

  const maxRain = Math.max(...awake.map((h) => h.rainChance));
  const hiFeel = Math.max(...awake.map((h) => h.feelsLike));
  const loFeel = Math.min(...awake.map((h) => h.feelsLike));
  const avgFeel = awake.reduce((a, h) => a + h.feelsLike, 0) / awake.length;
  const maxDew = Math.max(...awake.map((h) => h.dewPoint));
  const maxGust = Math.max(...awake.map((h) => h.gust));
  const avgCloud = awake.reduce((a, h) => a + h.cloud, 0) / awake.length;
  // Count hours, not just the peak: one wet hour is not a soggy day.
  const wetHours = awake.filter((h) => h.rainChance >= 60).length;
  const snowHours = awake.filter((h) => h.sky === 'snow' && h.rainChance >= 40).length;
  const stormHours = awake.filter((h) => h.sky === 'storm' && h.rainChance >= 40).length;

  const word = pickWord({
    score, maxRain, hiFeel, avgFeel, maxDew, maxGust, avgCloud, wetHours, snowHours, stormHours,
  });
  const extra = snowHours ? 'boots' : maxRain >= 40 ? 'umbrella' : null;
  const line = extra ? `${wear(loFeel, hiFeel)} and ${extra}` : wear(loFeel, hiFeel);
  const options = FEELINGS[word] ?? FEELINGS.Meh;
  const feeling = options[day[0].time.getDate() % options.length];

  return {
    date: day[0].time,
    score,
    word,
    feeling,
    line,
    hours: day.map((h) => ({ time: h.time, score: scoreHour(h) })),
  };
}

function pickWord(x: {
  score: number; maxRain: number; hiFeel: number; avgFeel: number; maxDew: number;
  maxGust: number; avgCloud: number; wetHours: number; snowHours: number; stormHours: number;
}): string {
  if (x.stormHours >= 1) return 'Stormy';
  if (x.snowHours >= 2) return 'Snowy';
  // Half the day or more is wet. A wet evening alone is handled by the callout.
  if (x.wetHours >= 6) return x.avgFeel < 45 ? 'Miserable' : 'Soggy';
  if (x.hiFeel >= 92) return 'Scorcher';
  if (x.maxDew >= 68 && x.hiFeel >= 80) return 'Swampy';
  if (x.avgFeel < 20) return 'Brutal';
  if (x.avgFeel < 38) return 'Bundle up';
  if (x.avgFeel < 52 && (x.maxGust > 28 || x.avgCloud > 75)) return 'Raw';
  if (x.maxGust > 35) return 'Blustery';
  if (x.avgFeel < 60 && x.avgCloud < 50 && x.maxRain < 40) return 'Crisp';
  if (x.score >= 9) return 'Gorgeous';
  if (x.score >= 7) return 'Pleasant';
  if (x.wetHours >= 1 || x.maxRain >= 40) return 'Iffy';
  if (x.avgCloud > 80) return 'Gloomy';
  return 'Meh';
}

// What to wear, in a word or two. A big swing in the day means layers.
function wear(lo: number, hi: number): string {
  if (lo < 25) return 'Heavy coat';
  if (lo < 40) return 'Winter coat';
  if (hi - lo >= 15) return 'Layers';
  if (lo < 55) return 'Jacket';
  if (lo < 65) return 'Light jacket';
  if (hi < 82) return 'T-shirt';
  return 'Shorts';
}

// The vibe: what people would actually say about a day like this.
const FEELINGS: Record<string, string[]> = {
  Gorgeous: ['The kind of day you make excuses to be outside.', 'Windows down, nowhere to be.', 'Everyone in a good mood for no reason.'],
  Pleasant: ['Easy day. Nothing to think about.', 'No complaints. Go about your business.', 'Nice enough to walk the long way.'],
  Crisp: ['Cold air, blue sky, hot coffee energy.', 'Sweater weather that feels earned.', 'Bright and brisk. Your lungs will thank you.'],
  Raw: ['The cold that gets into your bones.', 'Grey, damp, and a little mean.', 'Looks fine through the window. It is not.'],
  Blustery: ['Hold onto your hat. Literally.', 'Umbrellas will lose today.', 'The wind has opinions.'],
  'Bundle up': ['Real cold. Dress like you mean it.', 'Every layer you own, and gloves.', 'Short trips only.'],
  Brutal: ['Dangerous cold. Stay in if you can.', 'Exposed skin regrets everything.', 'A stay-under-the-blanket day.'],
  Soggy: ['Wet socks energy. Plans move indoors.', 'A couch, a movie, and nowhere to be.', 'Everything is damp and slow.'],
  Miserable: ['Cold rain. The worst combination.', 'Nobody is having a good time out there.', 'Cancel what you can.'],
  Stormy: ['Thunder in the forecast. Stay near a roof.', 'Loud, wet, and not for patios.', 'Watch the sky from inside today.'],
  Snowy: ['Snow day energy. Pretty from the window.', 'Slushy at the curb. Leave extra time.', 'Quiet streets, wet boots.'],
  Scorcher: ['Brutal heat. Shade and water, all day.', 'The sidewalk is cooking.', 'Do your errands early or not at all.'],
  Swampy: ['Air you can wear. Sticky from the first step.', 'Like walking through soup.', 'You will need a second shirt.'],
  Gloomy: ['Grey all day. Not bad, just blah.', 'Low light, low energy.', 'A good day to get things done inside.'],
  Iffy: ['Could go either way. Keep plans flexible.', 'Maybe rain, maybe not. Pack for both.', 'Hedge your bets today.'],
  Meh: ['Nothing special, nothing terrible.', 'A forgettable kind of day.', 'Fine. Just fine.'],
};

// ---------- the one callout ----------
const fmtHour = (d: Date) => {
  const h = d.getHours();
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

const noun = (h: Hour) => (h.sky === 'storm' ? 'Storms' : h.sky === 'snow' ? 'Snow' : 'Rain');
const iconFor = (h: Hour): CalloutIcon => (h.sky === 'storm' ? 'storm' : h.sky === 'snow' ? 'snow' : 'rain');

/**
 * At most one thing worth knowing for the rest of today, in a few words,
 * plus an action when it fits. `now` must be the location's wall-clock time
 * (see Forecast.now), not the phone's.
 */
export function calloutForToday(today: Hour[], now: Date): Callout | undefined {
  const ahead = today.filter((h) => h.time.getTime() >= now.getTime() - 30 * 60 * 1000);
  if (!ahead.length) return undefined;
  const weekday = now.getDay() !== 0 && now.getDay() !== 6;

  // 1. Rain/snow/storms arriving later (it's dry now).
  const wetNow = ahead[0].rainChance >= 50;
  const onset = ahead.find((h) => h.rainChance >= 55);
  if (onset && !wetNow) {
    const hr = onset.time.getHours();
    const text = `${noun(onset)} at ${fmtHour(onset.time)}`;
    const icon = iconFor(onset);
    // Commute first: getting home dry matters more than dinner plans.
    if (weekday && ((hr >= 7 && hr <= 9) || (hr >= 16 && hr <= 18))) return { text, icon, action: ACTIONS.ride };
    if (hr >= 17 && hr <= 22) return { text, icon, action: ACTIONS.food };
    return { text, icon };
  }
  if (wetNow) {
    const dry = ahead.find((h) => h.rainChance < 30);
    const action = now.getHours() >= 17 ? ACTIONS.food : ACTIONS.ride;
    const what = noun(ahead[0]);
    return { text: dry ? `${what} until ${fmtHour(dry.time)}` : `${what} all day`, icon: iconFor(ahead[0]), action };
  }

  // 2. Big temperature drop.
  const first = ahead[0];
  const daytime = ahead.filter((h) => h.time.getHours() <= 21);
  const coldest = (daytime.length ? daytime : ahead).reduce((a, h) => (h.feelsLike < a.feelsLike ? h : a), first);
  if (first.feelsLike - coldest.feelsLike >= 18)
    return { text: `Much colder by ${fmtHour(coldest.time)}`, icon: 'cold' };

  // 3. Otherwise: the best window still to come.
  const awakeAhead = waking(ahead);
  if (awakeAhead.length >= 2) {
    const scored = awakeAhead.map((h) => ({ h, s: scoreHour(h) }));
    const best = Math.max(...scored.map((x) => x.s));
    if (best >= 7) {
      const i0 = scored.findIndex((x) => x.s === best);
      let i1 = i0;
      while (i1 + 1 < scored.length && scored[i1 + 1].s >= best - 1) i1++;
      const run = scored.slice(i0, i1 + 1);
      const start = run[0].h.time;
      const end = new Date(run[run.length - 1].h.time.getTime() + 60 * 60 * 1000);
      return { text: `Best: ${fmtHour(start)} – ${fmtHour(end)}`, icon: 'sun' };
    }
  }
  return undefined;
}
