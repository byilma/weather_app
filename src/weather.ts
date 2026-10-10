// Weather data layer. The rest of the app only sees `Hour[]`, so the source can
// be swapped (Open-Meteo for prototyping -> Apple WeatherKit / NWS for launch)
// without touching the vibe engine or the UI.
//
// NOTE: Open-Meteo's free API is for non-commercial use / prototyping only.
// Swap to WeatherKit (or Open-Meteo's paid plan) before monetized launch.

// What is falling from the sky (if anything). Comes from the WMO weather code.
export type Sky = 'snow' | 'storm' | 'other';

export type Hour = {
  time: Date; // local wall-clock time at the forecast location
  feelsLike: number; // °F
  temp: number; // °F
  rainChance: number; // 0-100 %, any precipitation (rain or snow)
  precip: number; // inches of water in that hour
  gust: number; // mph
  dewPoint: number; // °F
  cloud: number; // 0-100 %
  isDay: boolean;
  sky: Sky;
};

export type Sun = { rise: Date; set: Date }; // local wall-clock times at the location

export type Forecast = {
  hours: Hour[];
  sun: Sun[]; // one per day, in the same order as the days in `hours`
  // "Now" on the location's wall clock, on the same basis as Hour.time.
  // Needed when the city is in a different timezone from the phone.
  now: Date;
  fetchedAt: number; // phone time (ms) when this arrived, to keep `now` ticking
};

/** The location's wall-clock time right now, given a forecast fetched earlier. */
export const liveNow = (f: Forecast) => new Date(f.now.getTime() + (Date.now() - f.fetchedAt));

const HOURLY = [
  'apparent_temperature',
  'temperature_2m',
  'precipitation_probability',
  'precipitation',
  'wind_gusts_10m',
  'dew_point_2m',
  'cloud_cover',
  'is_day',
  'weather_code',
].join(',');

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const skyFor = (code: number | null | undefined): Sky =>
  code == null ? 'other' : code >= 95 ? 'storm' : SNOW_CODES.has(code) ? 'snow' : 'other';

export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=${HOURLY}&daily=sunrise,sunset&forecast_days=7&timezone=auto` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const j = await res.json();
  const h = j.hourly;
  const hours: Hour[] = h.time.map((t: string, i: number) => ({
    // Open-Meteo returns local time without offset ("2026-10-10T14:00").
    // Parse the parts directly so the device timezone never shifts it.
    time: parseLocal(t),
    feelsLike: h.apparent_temperature[i],
    temp: h.temperature_2m[i],
    rainChance: h.precipitation_probability[i] ?? 0,
    precip: h.precipitation[i] ?? 0,
    gust: h.wind_gusts_10m[i] ?? 0,
    dewPoint: h.dew_point_2m[i],
    cloud: h.cloud_cover[i] ?? 0,
    isDay: h.is_day[i] === 1,
    sky: skyFor(h.weather_code[i]),
  }));
  // Near the poles there may be no sunrise or sunset; fall back to 6 AM / 6 PM.
  const sun: Sun[] = (j.daily?.time ?? []).map((d: string, i: number) => ({
    rise: j.daily.sunrise?.[i] ? parseLocal(j.daily.sunrise[i]) : parseLocal(`${d}T06:00`),
    set: j.daily.sunset?.[i] ? parseLocal(j.daily.sunset[i]) : parseLocal(`${d}T18:00`),
  }));
  return { hours, sun, now: wallClockNow(j.utc_offset_seconds ?? 0), fetchedAt: Date.now() };
}

function parseLocal(s: string): Date {
  const [d, t] = s.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return new Date(y, m - 1, day, hh, mm);
}

// The current time at the location, expressed the same way parseLocal does.
function wallClockNow(offsetSeconds: number): Date {
  const shifted = new Date(Date.now() + offsetSeconds * 1000);
  return new Date(
    shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(),
    shifted.getUTCHours(), shifted.getUTCMinutes(),
  );
}
