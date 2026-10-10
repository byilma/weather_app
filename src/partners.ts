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

export type Link = { partner: string; label: string; url: string };

const q = encodeURIComponent;
const withAffiliate = (partner: string, url: string) => {
  const extra = AFFILIATE[partner];
  if (!extra) return url;
  return url + (url.includes('?') ? '&' : '?') + extra;
};
const link = (partner: string, label: string, url: string): Link => ({ partner, label, url: withAffiliate(partner, url) });

// Rides. Uber's format is from its deep-link docs; opens the app if installed.
export const uber = () => link('uber', 'Uber', 'https://m.uber.com/ul/?action=setPickup&pickup=my_location');
// Lyft universal link (test).
export const lyft = () => link('lyft', 'Lyft', 'https://lyft.com/ride?id=lyft');

// Delivery.
export const uberEats = () => link('ubereats', 'Uber Eats', 'https://www.ubereats.com/');
export const doorDash = () => link('doordash', 'DoorDash', 'https://www.doordash.com/');

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

