// Where we are rating: the phone's location, or a city the user searched for.

import * as Location from 'expo-location';

export type Place = {
  name: string; // what the header shows, e.g. "Brooklyn"
  detail?: string; // search results only, e.g. "Texas, United States"
  lat: number;
  lon: number;
  isCurrent?: boolean; // true when it came from the phone's location
};

// Used when location is off or unavailable, so the app still shows something.
export const DEFAULT_PLACE: Place = { name: 'New York', lat: 40.7128, lon: -74.006 };

/** The phone's location, or null if permission is off or it can't be found. */
export async function currentPlace(): Promise<Place | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    // A recent cached fix is instant; a fresh one can take several seconds.
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const { latitude: lat, longitude: lon } = pos.coords;
    return { name: await nameFor(lat, lon), lat, lon, isCurrent: true };
  } catch {
    return null;
  }
}

async function nameFor(lat: number, lon: number): Promise<string> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    return a?.city ?? a?.district ?? a?.subregion ?? a?.region ?? 'Your location';
  } catch {
    return 'Your location';
  }
}

/** City search (Open-Meteo geocoding, free, no key). */
export async function searchCities(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}` +
    `&count=8&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const j = await res.json();
  return (j.results ?? []).map((r: any) => ({
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/** A stable id for a place (rounded so tiny GPS jitter doesn't make a new city). */
export const placeKey = (p: Pick<Place, 'lat' | 'lon'>) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

/** Straight-line distance in km. */
export function distanceKm(a: Pick<Place, 'lat' | 'lon'>, b: Pick<Place, 'lat' | 'lon'>): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Plans (rides, delivery, a table) only make sense for a city you're actually in or near.
export const NEAR_KM = 150;
