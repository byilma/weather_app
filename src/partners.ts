import { Linking, Platform } from 'react-native';

// Every outbound link in one place. When a partner approves you, paste the
// tracking parameters it gives you into AFFILIATE and every link picks them up.
// Nothing else in the app needs to change.
//
// Links marked "test" are built from public URL patterns, not official docs:
// open each one on a phone once before launch.

// e.g. uber: 'client_id=abc123', viator: 'pid=P00012345&mcid=42383&medium=link'
export const AFFILIATE: Record<string, string> = {
  uber: '',
  lyft: '',
  ubereats: '',
  doordash: '',
  opentable: '',
  viator: '',
  fever: '',
  ticketmaster: '',
};

// `app` is the partner's own app address (uber://...). We try it first so the app
// opens directly; if it isn't installed, the web `url` opens instead.
export type Link = { partner: string; label: string; url: string; app?: string };

const q = encodeURIComponent;
const withAffiliate = (partner: string, url: string) => {
  const extra = AFFILIATE[partner];
  if (!extra) return url;
  return url + (url.includes('?') ? '&' : '?') + extra;
};
const link = (partner: string, label: string, url: string, app?: string): Link => ({
  partner, label, url: withAffiliate(partner, url), app: app && withAffiliate(partner, app),
});

/** Open a link: the app if it's on the phone, otherwise the website. */
export async function openLink(l: Link): Promise<void> {
  if (l.app) {
    try {
      await Linking.openURL(l.app); // fails if the app isn't installed
      return;
    } catch {}
  }
  await Linking.openURL(l.url).catch(() => {});
}

// Rides. Formats from Uber's and Lyft's deep-link docs.
export const uber = () =>
  link('uber', 'Uber', 'https://m.uber.com/ul/?action=setPickup&pickup=my_location', 'uber://?action=setPickup&pickup=my_location');
export const lyft = () => link('lyft', 'Lyft', 'https://ride.lyft.com/', 'lyft://ridetype?id=lyft');

// Delivery: open straight to the app's home (test).
export const uberEats = () => link('ubereats', 'Uber Eats', 'https://www.ubereats.com/', 'ubereats://');
export const doorDash = () => link('doordash', 'DoorDash', 'https://www.doordash.com/', 'doordash://');

// The partners below have no documented app address for a search, so we open their
// website; on phones with the app, their web links usually hand off to it.

// Eat out (test): OpenTable search with a phrase and the city.
export const openTable = (phrase: string, city: string) =>
  link('opentable', 'OpenTable', `https://www.opentable.com/s?term=${q(`${phrase} ${city}`.trim())}&covers=2`);

// Things to do: Viator search works for any city name.
export const viator = (phrase: string, city: string) =>
  link('viator', 'Viator', `https://www.viator.com/searchResults/all?text=${q(`${phrase} ${city}`.trim())}`);

// Tonight: Fever city pages exist for big cities (pattern feverup.com/en/<city>).
// Elsewhere fall back to a Ticketmaster search (test).
const FEVER_CITIES: Record<string, string> = {
  'new york': 'new-york', manhattan: 'new-york', brooklyn: 'new-york', queens: 'new-york',
  'los angeles': 'los-angeles', chicago: 'chicago', miami: 'miami', 'san francisco': 'san-francisco',
  boston: 'boston', washington: 'washington-dc', seattle: 'seattle', austin: 'austin',
  london: 'london', paris: 'paris', madrid: 'madrid', barcelona: 'barcelona', lisbon: 'lisbon',
  berlin: 'berlin', rome: 'rome', milan: 'milan', amsterdam: 'amsterdam', sydney: 'sydney',
};
export const tonight = (city: string): Link => {
  const slug = FEVER_CITIES[city.trim().toLowerCase()];
  return slug
    ? link('fever', 'Fever', `https://feverup.com/en/${slug}`)
    : link('ticketmaster', 'Ticketmaster', `https://www.ticketmaster.com/search?q=${q(city)}`);
};
export const ticketmaster = (phrase: string, city: string) =>
  link('ticketmaster', 'Ticketmaster', `https://www.ticketmaster.com/search?q=${q(`${phrase} ${city}`.trim())}`);


// ---------- nearby places (no partner, no commission: just useful) ----------
// With no location given, both apps search around where the person is; for a saved
// city we pass its centre (Apple) or its name (Google). Apple Maps web addresses
// always open the Maps app on iPhone.
export type MapsApp = 'apple' | 'google';
// iPhone users can pick (Apple Maps by default); Android always uses Google Maps.
export const defaultMapsApp = (): MapsApp => (Platform.OS === 'ios' ? 'apple' : 'google');

export const maps = (what: string, near?: { lat: number; lon: number; city?: string }, app: MapsApp = defaultMapsApp()): Link => {
  if (app === 'apple' && Platform.OS === 'ios') {
    const center = near ? `&center=${near.lat.toFixed(4)},${near.lon.toFixed(4)}` : '';
    return { partner: 'applemaps', label: 'Maps', url: `https://maps.apple.com/search?query=${q(what)}${center}` };
  }
  const where = near ? (near.city ? ` near ${near.city}` : ` near ${near.lat.toFixed(4)},${near.lon.toFixed(4)}`) : '';
  const url = `https://www.google.com/maps/search/?api=1&query=${q(what + where)}`;
  // On iPhone, open the Google Maps app itself when it's installed (its documented URL scheme).
  // On Android the web address already opens the Maps app.
  const appUrl = Platform.OS === 'ios' ? `comgooglemaps://?q=${q(what + where)}` : undefined;
  return { partner: 'googlemaps', label: 'Maps', url, app: appUrl };
};
