// Small things remembered on the phone: the user's saved cities and an anonymous id.
// Nothing here leaves the phone except the anonymous id (see track.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from './places';

const CITIES = 'vibe.cities.v1';
const ID = 'vibe.id.v1';
const MAPS = 'skyscore.maps.v1';
export const MAX_CITIES = 12;

export async function loadCities(): Promise<Place[]> {
  try {
    const raw = await AsyncStorage.getItem(CITIES);
    const list = raw ? (JSON.parse(raw) as Place[]) : [];
    return Array.isArray(list) ? list.filter((p) => typeof p?.lat === 'number' && typeof p?.lon === 'number') : [];
  } catch {
    return [];
  }
}

export async function saveCities(list: Place[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CITIES, JSON.stringify(list.slice(-MAX_CITIES)));
  } catch {
    // Not fatal: the list just won't survive a restart.
  }
}

// A random id that says nothing about the person; lets us count unique phones.
export async function anonymousId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(ID);
    if (existing) return existing;
    const id = 'v-' + Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');
    await AsyncStorage.setItem(ID, id);
    return id;
  } catch {
    return 'v-unsaved';
  }
}

// Which Maps app nearby places open in (iPhone only; Android always uses Google Maps).
export async function loadMapsApp(): Promise<'apple' | 'google' | null> {
  try {
    const v = await AsyncStorage.getItem(MAPS);
    return v === 'apple' || v === 'google' ? v : null;
  } catch {
    return null;
  }
}
export async function saveMapsApp(app: 'apple' | 'google'): Promise<void> {
  try {
    await AsyncStorage.setItem(MAPS, app);
  } catch {}
}
