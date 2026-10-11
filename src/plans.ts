// "Plans": what to actually do, given the weather and the time. Utility first:
// every idea is ranked by how useful it is right now, never by whether it pays.
// Most open Maps (free, nearby, no partner); some open a partner app where that's
// the genuinely best tool (a ride, delivery, tickets, a reservation).
// Pure functions (no React), so the rules are easy to read and tune.

import type { Hour } from './weather';
import * as P from './partners';

export type PlanKind =
  | 'ride' | 'food' | 'coffee' | 'movie' | 'museum' | 'park' | 'icecream'
  | 'brunch' | 'outdoorTable' | 'bar' | 'tonight' | 'lateFood';
export type Plan = { kind: PlanKind; title: string; why: string; links: P.Link[] };

const fmtHour = (h: number) => (h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? `${h} AM` : `${h - 12} PM`);

export type Where = {
  city: string; // '' when we can't name it
  lat: number;
  lon: number;
  isHere: boolean; // the phone's own location (Maps can then search around the person)
  mapsApp: P.MapsApp; // which Maps app nearby places open in
};

/** The moment, boiled down to the handful of facts the rules use. */
function moment(today: Hour[], now: Date, score: number) {
  const hr = now.getHours();
  const ahead = today.filter((h) => h.time.getHours() >= hr);
  const current = ahead[0];
  const wetNow = (current?.rainChance ?? 0) >= 50;
  const rainAt = ahead.find((h) => h.rainChance >= 55);
  const wetLater = !wetNow && !!rainAt;
  const feels = current?.feelsLike ?? 65;
  const weekday = now.getDay() !== 0 && now.getDay() !== 6;
  return {
    hr, wetNow, wetLater, rainAt, weekday, score,
    weekend: !weekday,
    morning: hr >= 6 && hr < 11,
    daylight: hr >= 9 && hr < 17, // museums, parks
    afternoon: hr >= 12 && hr < 18,
    evening: hr >= 17 && hr <= 22,
    lateNight: hr >= 23 || hr < 5,
    commute: weekday && ((hr >= 7 && hr <= 9) || (hr >= 16 && hr <= 18)),
    hot: feels >= 85,
    cold: feels <= 42,
    nice: score >= 7 && !wetNow && !wetLater,
    snowNow: current?.sky === 'snow' && wetNow,
  };
}

/**
 * Every idea that makes sense right now, most useful first. Ideas that don't fit
 * the moment (a park in the rain, coffee at 1 AM) are left out entirely.
 */
export function plansFor(today: Hour[], now: Date, score: number, where: Where): Plan[] {
  const m = moment(today, now, score);
  const near = where.isHere ? undefined : { lat: where.lat, lon: where.lon, city: where.city || undefined };
  const map = (what: string) => P.maps(what, near, where.mapsApp);
  const rainTime = m.rainAt ? fmtHour(m.rainAt.time.getHours()) : '';

  // Each idea: how useful it is now (higher is better; 0 or below = not shown), and its pitch.
  const ideas: { useful: number; plan: Plan }[] = [
    {
      useful: 1 + (m.wetNow ? 5 : 0) + (m.wetLater ? 3 : 0) + (m.lateNight ? 4 : 0) + (m.commute ? 2 : 0) + (m.cold ? 1 : 0),
      plan: {
        kind: 'ride', title: 'Get a ride',
        why: m.snowNow ? 'Skip the slush' : m.wetNow ? 'Skip the wet walk' : m.wetLater ? `Rain at ${rainTime}` : m.lateNight ? 'Late night' : m.commute ? 'Beat the commute' : 'Door to door',
        links: [P.uber(), P.lyft()],
      },
    },
    {
      useful: 1 + (m.wetNow && m.evening ? 5 : m.wetNow ? 3 : 0) + (m.wetLater && m.evening ? 3 : 0) + (m.lateNight ? 3 : 0) + (m.cold && m.evening ? 2 : 0),
      plan: {
        kind: 'food', title: 'Order in',
        why: m.wetNow ? 'Stay in, stay dry' : m.wetLater ? (m.evening ? 'Good night to stay in' : `Rain at ${rainTime}. Plan dinner in.`) : m.lateNight ? 'Kitchen’s closed' : m.cold ? 'Too cold to go out' : 'Stay in, eat well',
        links: [P.uberEats(), P.doorDash()],
      },
    },
    {
      useful: m.lateNight ? -1 : 1 + (m.morning ? 4 : 0) + (m.cold ? 2 : 0) + (m.wetNow ? 2 : 0) + (m.afternoon && !m.hot ? 1 : 0),
      plan: {
        kind: 'coffee', title: m.hot ? 'Iced coffee nearby' : 'Coffee nearby',
        why: m.snowNow ? 'Wait out the snow somewhere warm' : m.wetNow ? 'Wait out the rain somewhere warm' : m.cold ? 'Warm up' : m.morning ? 'Start the day right' : 'A short walk away',
        links: [map(m.hot ? 'iced coffee' : 'coffee')],
      },
    },
    {
      useful: (m.wetNow ? 4 : 0) + (m.wetLater && m.evening ? 3 : 0) + (m.evening ? 2 : 0) + (m.hot ? 2 : 0) + (m.cold ? 1 : 0) + (m.weekend ? 1 : 0) - (m.lateNight ? 3 : 0) - (m.nice && m.daylight ? 2 : 0),
      plan: {
        kind: 'movie', title: 'Catch a movie',
        why: m.wetNow ? 'The perfect rain plan' : m.hot ? 'Two hours of air conditioning' : m.evening ? 'An easy plan for tonight' : 'Theaters nearby',
        links: [map('movie theater')],
      },
    },
    {
      useful: m.daylight ? (m.wetNow ? 4 : 0) + (m.hot ? 3 : 0) + (m.cold ? 3 : 0) + (m.weekend ? 1 : 0) - (m.nice ? 1 : 0) : -1,
      plan: {
        kind: 'museum', title: 'A museum',
        why: m.wetNow ? 'Indoors and worth it' : m.hot ? 'Cool, quiet, and indoors' : m.cold ? 'Warm and worth it' : 'Something to see',
        links: [map('museum')],
      },
    },
    {
      useful: m.daylight && m.nice && !m.hot ? 5 + (m.score >= 9 ? 1 : 0) + (m.weekend ? 1 : 0) : -1,
      plan: { kind: 'park', title: 'Get to a park', why: `${m.score}/10 out there. Use it.`, links: [map('park')] },
    },
    {
      useful: m.hot && !m.wetNow && !m.lateNight ? 4 : m.nice && m.afternoon && m.score >= 8 ? 1 : -1,
      plan: { kind: 'icecream', title: 'Ice cream', why: m.hot ? 'It’s hot. You’ve earned it.' : 'Nice afternoon for it', links: [map('ice cream')] },
    },
    {
      useful: m.weekend && m.hr >= 9 && m.hr < 14 ? 4 + (m.nice ? 1 : 0) : -1,
      plan: {
        kind: 'brunch', title: m.nice ? 'Brunch outside' : 'Brunch',
        why: m.nice ? 'Patio weather' : m.wetNow ? 'A long, dry brunch' : 'It’s the weekend',
        links: [map(m.nice ? 'brunch outdoor seating' : 'brunch'), P.openTable('brunch', where.city)],
      },
    },
    {
      useful: m.nice && (m.evening || (m.afternoon && m.weekend)) ? 4 : -1,
      plan: {
        kind: 'outdoorTable', title: 'Eat outside', why: 'Nice enough for a table outdoors',
        links: [map('restaurant outdoor seating'), P.openTable('outdoor seating', where.city)],
      },
    },
    {
      useful: m.evening ? 2 + (m.weekend ? 1 : 0) + (m.nice ? 1 : 0) + (m.cold || m.wetNow ? 1 : 0) : m.lateNight && !m.weekday ? 1 : -1,
      plan: {
        kind: 'bar', title: m.nice ? 'A rooftop drink' : 'A cozy bar',
        why: m.nice ? 'Rooftop weather' : m.wetNow ? 'Duck in out of the rain' : m.cold ? 'Somewhere warm' : 'Nearby',
        links: [map(m.nice ? 'rooftop bar' : 'cozy bar')],
      },
    },
    {
      useful: (m.evening ? 2 : 0) + (m.weekend ? 1 : 0) + (m.wetNow ? 1 : 0) - (m.lateNight ? 2 : 0),
      plan: { kind: 'tonight', title: m.evening ? 'Something on tonight' : 'Something on today', why: 'Shows, pop-ups, events', links: [P.tonight(where.city)] },
    },
    {
      useful: m.lateNight ? 3 : -1,
      plan: { kind: 'lateFood', title: 'Late-night food', why: 'Still open nearby', links: [map('late night food')] },
    },
  ];

  return ideas
    .filter((i) => i.useful > 0)
    .sort((a, b) => b.useful - a.useful)
    .map((i) => i.plan);
}

/** Where a typed search goes: nearby on Maps first, then tickets, tours, and tables. */
// Apps people might type by name, plus a few plain-word intents. Typing "ube"
// already offers Uber; "taxi" offers both ride apps.
const APPS: { names: string[]; links: () => P.Link[] }[] = [
  { names: ['uber'], links: () => [P.uber()] },
  { names: ['lyft'], links: () => [P.lyft()] },
  { names: ['uber eats', 'ubereats'], links: () => [P.uberEats()] },
  { names: ['doordash', 'door dash'], links: () => [P.doorDash()] },
  { names: ['ride', 'taxi', 'cab', 'car'], links: () => [P.uber(), P.lyft()] },
  { names: ['delivery', 'deliver', 'order in', 'takeout', 'take out'], links: () => [P.uberEats(), P.doorDash()] },
];

function appMatches(text: string): P.Link[] {
  const t = text.toLowerCase();
  const found: P.Link[] = [];
  for (const a of APPS) {
    const hit = a.names.some((n) => n === t || (t.length >= 3 && n.startsWith(t)) || t.startsWith(n + ' '));
    if (hit) for (const l of a.links()) if (!found.some((f) => f.partner === l.partner)) found.push(l);
  }
  return found;
}

export function searchLinks(query: string, where: Where): { title: string; why?: string; link: P.Link }[] {
  const text = query.trim();
  if (!text) return [];
  const near = where.isHere ? undefined : { lat: where.lat, lon: where.lon, city: where.city || undefined };
  const nearby = { title: `Nearby: “${text}”`, link: P.maps(text, near, where.mapsApp) };
  const apps = appMatches(text);
  // Asked for an app by name: open the app, with a Maps search as a fallback.
  if (apps.length) return [...apps.map((l) => ({ title: l.label, why: 'Open the app', link: l })), nearby];
  return [
    nearby,
    { title: `Tickets: “${text}”`, link: P.ticketmaster(text, where.city) },
    { title: `Things to do: “${text}”`, link: P.viator(text, where.city) },
    { title: `Restaurants: “${text}”`, link: P.openTable(text, where.city) },
  ];
}
