// "Plans": what to do about the weather, ranked for right now.
// Pure functions (no React). Each plan has one or two partner links.

import type { Hour } from './weather';
import * as P from './partners';

export type PlanKind = 'ride' | 'food' | 'table' | 'tonight' | 'outside';
export type Plan = { kind: PlanKind; title: string; why: string; links: P.Link[] };

const fmtHour = (h: number) => (h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? `${h} AM` : `${h - 12} PM`);

/**
 * All plans, best first. `now` is the location's wall clock; `today` is today's hours.
 * The ranking is a handful of plain rules, easy to tune.
 */
export function plansFor(today: Hour[], now: Date, score: number, city: string): Plan[] {
  const hr = now.getHours();
  const ahead = today.filter((h) => h.time.getHours() >= hr);
  const wetNow = (ahead[0]?.rainChance ?? 0) >= 50;
  const rainAt = ahead.find((h) => h.rainChance >= 55);
  const wetLater = !wetNow && !!rainAt;
  const evening = hr >= 17 && hr <= 22;
  const lateNight = hr >= 23 || hr < 5;
  const weekday = now.getDay() !== 0 && now.getDay() !== 6;
  const commute = weekday && ((hr >= 7 && hr <= 9) || (hr >= 16 && hr <= 18));
  const nice = score >= 7 && !wetNow && !wetLater;
  const daylight = hr >= 8 && hr < 17;

  const rank: Record<PlanKind, number> = { ride: 1, food: 1, table: 1, tonight: 1, outside: 0 };
  if (wetNow) { rank.ride += 4; rank.food += 3; rank.tonight += 1; }
  if (wetLater) { rank.ride += 3; rank.food += 2; }
  if (commute) rank.ride += 2;
  if (lateNight) { rank.ride += 3; rank.food += 3; rank.tonight -= 1; rank.table -= 1; }
  if (evening) { rank.food += 1; rank.tonight += 2; rank.table += 1; }
  if (evening && nice) rank.table += 2;
  if (daylight && nice) { rank.outside += 5; rank.table += 1; }
  if (daylight && !nice) rank.tonight += 1;

  const why = {
    ride: wetNow ? 'Wet out there' : wetLater ? `Rain at ${fmtHour(rainAt!.time.getHours())}` : lateNight ? 'Late night' : commute ? 'Beat the commute' : 'Skip the walk',
    food: wetNow || wetLater ? 'Good night to stay in' : lateNight ? 'Kitchen’s closed' : 'Stay in, eat well',
    table: nice ? 'Nice enough to sit outside' : 'Eat out tonight',
    tonight: evening ? 'Shows, pop-ups, things to do' : 'Things happening today',
    outside: `${score}/10 out there. Use it.`,
  };

  const plans: Plan[] = [
    { kind: 'ride', title: 'Get a ride', why: why.ride, links: [P.uber(), P.lyft()] },
    { kind: 'food', title: 'Order in', why: why.food, links: [P.uberEats(), P.doorDash()] },
    {
      kind: 'table', title: nice ? 'A table outside' : 'Book a table', why: why.table,
      links: [P.openTable(nice ? 'outdoor seating' : '', city)],
    },
    { kind: 'tonight', title: evening ? 'Something tonight' : 'Something to do', why: why.tonight, links: [P.tonight(city)] },
    { kind: 'outside', title: 'Get outside', why: why.outside, links: [P.viator('outdoor', city)] },
  ];
  return plans.sort((a, b) => rank[b.kind] - rank[a.kind]);
}

/** Where a typed search goes: one row per kind of place to look. */
export function searchLinks(query: string, city: string): { title: string; link: P.Link }[] {
  const text = query.trim();
  if (!text) return [];
  return [
    { title: `Things to do: “${text}”`, link: P.viator(text, city) },
    { title: `Tickets: “${text}”`, link: P.ticketmaster(text, city) },
    { title: `Restaurants: “${text}”`, link: P.openTable(text, city) },
  ];
}

