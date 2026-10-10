# Skyscore — today's weather, rated 1 to 10

One screen: today's score (1-10), one word, one sentence, and at most one callout.

## Run it on your phone (5 minutes)
1. Install Node.js 20+ on your computer (nodejs.org).
2. Install **Expo Go** on your phone (App Store / Play Store).
3. In this folder:  `npm install`  then  `npx expo start`
4. Scan the QR code with your phone camera (iOS) or Expo Go (Android).

## Where things live
- `src/vibe.ts` — the vibe engine: hour score, day score, the word, the vibe line, the one callout (its button opens Plans). Tune the numbers here (the `COMFORT` table is the main dial).
- `src/weather.ts` — data source. Prototype uses Open-Meteo's free API (non-commercial only). Swap to Apple WeatherKit before monetized launch; nothing else has to change.
- `src/places.ts` — where we're rating: phone location (with city name) or a searched city. Falls back to New York if location is off.
- `src/CitySearch.tsx` — the city picker that opens when you tap the place name.
- `src/theme.ts` — the look: sky colours for each score, the two typefaces (Big Shoulders for the score, Figtree for everything else).
- `src/skyclock.ts` — the living sky's colours: the score sets the mood, sunrise/sunset set the light (dawn, golden hour, sunset, dusk, night). Tune the `PHASE` tints here.
- `src/Sky.tsx` — draws it: the gradient, a slowly breathing sun/moon glow, and faint haze that drifts with cloud cover. Motion stops when Reduce Motion is on.
- `src/ShareCard.tsx` — "share today": a square card previewed first, then sent to the share sheet as an image.
- `src/plans.ts` — Plans: which ideas to show and in what order (rain, evening, a nice afternoon…). Plain rules, easy to tune.
- `src/PlansSheet.tsx` — the Plans sheet: top three ideas, "More ideas", a search, and the commission disclosure.
- `src/partners.ts` — every outbound link (Uber, Lyft, Uber Eats, DoorDash, OpenTable, Viator, Fever, Ticketmaster). Paste affiliate tracking parameters into `AFFILIATE` once each partner approves you.
- `src/storage.ts` — what's remembered on the phone: saved cities (up to 12) and an anonymous id.
- `src/track.ts` — private tap counting (opens, Plans, which partner was tapped). Off until you paste a PostHog key; never sends location.
- `App.tsx` — the single screen: place (swipe between saved cities), score, word (tap it for the vibe), what to wear, one callout, the day's hours as a skyline, the week.

## Website
- `docs/index.html` and `docs/privacy.html` — the one-page Skyscore site and privacy policy. Host them anywhere static. On GitHub: Settings → Pages → "Deploy from a branch" → your main branch, `/docs` folder. Replace `[your email]` in both before sharing.

## Before the stores
- `com.skyscore.app` in `app.json` is a placeholder bundle id: register your own (e.g. with your domain) before the first build.
- Fill in `AFFILIATE` in `src/partners.ts` as partner programs approve you (start with Impact: Fever, SeatGeek, Ticketmaster, ClassPass; then Viator directly).
- Open each link marked "test" in `src/partners.ts` on a phone once.
- Paste a PostHog project key into `src/track.ts` to start counting taps (and mention anonymous usage analytics in the App Store privacy form).
- `npm i -g eas-cli`, `eas build`, `eas submit`.
