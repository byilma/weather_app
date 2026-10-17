# Skyscore: handoff, A to Z

Everything you (and your coding agent) need to pick this up and keep building. Read this first, then `README.md` (file map) and `AGENTS.md` (Expo rules).

Owner: Binyam Yilma (skyscore.app@gmail.com). Repo: `github.com/byilma/weather_app` (public). State as of October 17, 2026: feature-complete for a first TestFlight build; never shipped to a store.

---

## 1. What it is, in one breath

A weather app that answers one question: **how good is today to be outside?** It shows a score from 1 to 10, one word ("Crisp", "Swampy", "Gorgeous"), what to wear, and at most one heads-up. The background is the real sky, live. A **Plans** sheet suggests what to do in this weather and hands off to Maps or a partner app (Uber, DoorDash, OpenTable…).

## 2. Product principles (the filter for every change)

1. **Insanely simple.** Less is more. Most weather apps show too much data and too little you can act on. If a feature adds data without adding a decision, it doesn't ship.
2. **One screen.** Score, word, wear line, one callout, the day's hours, the week. Everything else is one tap away (the vibe line, Plans, cities, share).
3. **Utility before money.** Plans are ranked by usefulness right now, never by payout. Most Plans open Maps and earn nothing, on purpose.
4. **Motion is subtle.** Things breathe and drift over seconds to minutes. Everything stops with Reduce Motion.
5. **Always readable.** Small text holds 4.5:1 contrast in every sky, every hour (enforced in code, see §6).
6. **Change it everywhere.** When the look or wording changes, update every place it shows: app, share card, icon, website, privacy page, App Store screenshots and listing. No piecemeal updates.
7. **Private by design.** No accounts. Location is used only to fetch the forecast. Analytics are anonymous and never include location.

## 3. Stack

- Expo SDK 57, React Native 0.86 (New Architecture), React 19, TypeScript 6. Check `package.json` for exact versions.
- **Single screen, no router.** `App.tsx` holds the whole home screen. Sheets and pickers are `Modal`s. (`AGENTS.md` describes Expo Router; this app doesn't use it. Adopt it only if a second real screen appears.)
- Native modules: `expo-location`, `expo-linear-gradient`, `react-native-svg`, `expo-haptics`, `expo-sharing`, `react-native-view-shot`, `@react-native-async-storage/async-storage`, `expo-font` (Big Shoulders + Figtree via `@expo-google-fonts`), `@expo/vector-icons` (Ionicons).
- No `ios/` or `android/` folders: Continuous Native Generation. Configure native behavior in `app.json` only.
- No backend. The app talks directly to Open-Meteo (weather, geocoding) and PostHog (analytics).

## 4. Run it, check it

```bash
npm install
npx expo start          # scan the QR with Expo Go (iPhone camera) or the Expo Go app (Android)
npx tsc --noEmit        # typecheck: must pass
npx expo lint           # lint: must pass (config in eslint.config.js)
npx expo install <pkg>  # always use this to add packages (SDK-matched versions)
```

- Everything currently runs in **Expo Go**. Adding a library with custom native code means a development build (`eas build --profile development`).
- **There are no automated tests yet.** The engine files (`vibe.ts`, `plans.ts`, `skyclock.ts`) are pure functions with no React, so they are the place to start (Jest or Vitest). See §12.
- Web is listed in `app.json` platforms but not a product target; `react-dom`/`react-native-web` aren't installed. For quick visual checks you can install them without saving (`npm i --no-save react-dom react-native-web @expo/metro-runtime`), run `EXPO_OFFLINE=1 npx expo export -p web`, and drive it with Playwright while faking the clock and the Open-Meteo response. That's how every screenshot so far was checked.

## 5. File map

| File | What it does |
|---|---|
| `App.tsx` | The home screen: state, city swipe, sky inputs, layout (`Verdict`, `Skyline`, week chips), opens the sheets, tracking calls. |
| `src/weather.ts` | Open-Meteo forecast fetch → `Forecast { hours, sun, now, fetchedAt }`. `liveNow()` gives the location's wall-clock time. Commercial key switch. |
| `src/vibe.ts` | The engine: hour score, day score, the word, the vibe line, what to wear, the one callout. |
| `src/skyclock.ts` | The sky's colors from weather + time of day, the text-color decision, the contrast guard, stars. |
| `src/Sky.tsx` | Draws the sky: gradient crossfade, sun/moon glow, drifting clouds, stars, rain/snow. |
| `src/theme.ts` | Fonts and the two text palettes (`DARK_INK`, `LIGHT_INK`), `InkProvider`/`useInk`, `themed()` style helper. |
| `src/plans.ts` | Plans: which ideas fit right now, ranked; Plans search (app names, intents, fallbacks). |
| `src/partners.ts` | Every outbound link. `AFFILIATE` params, `openLink()` (app first, web fallback), Maps links. |
| `src/PlansSheet.tsx` | The Plans bottom sheet: top 3 ideas, "More ideas", search, Maps app toggle, disclosure. |
| `src/CitySearch.tsx` | City picker: current location, saved cities with today's score, search, remove. Open-Meteo credit. |
| `src/places.ts` | Phone location + reverse geocode, city search, `placeKey`, `distanceKm`, `NEAR_KM`. |
| `src/storage.ts` | AsyncStorage: saved cities, anonymous id, Maps app choice. |
| `src/track.ts` | Anonymous event counting to PostHog. |
| `src/ShareCard.tsx` | "Share today": square card → PNG → share sheet. |
| `docs/` | Website + privacy policy, served by GitHub Pages. |
| `store/` | App Store listing text and the five screenshots (two iPhone sizes each). |
| `assets/` | App icon set (iOS, Android adaptive layers, monochrome, favicon). |

## 6. How it works

### 6.1 Data

- **Forecast:** `GET {host}/v1/forecast` with `hourly=apparent_temperature,temperature_2m,precipitation_probability,precipitation,wind_gusts_10m,dew_point_2m,cloud_cover,is_day,weather_code`, `daily=sunrise,sunset`, 7 days, `timezone=auto`, °F, mph, inches.
- **Time zones (important gotcha):** Open-Meteo returns local wall-clock times with no offset. `parseLocal()` builds `Date`s from the parts so the phone's time zone never shifts them. "Now" at the location is `utc_offset_seconds` applied to UTC, kept ticking with `liveNow(f)`. **Always compare forecast hours against `liveNow(forecast)`, never `new Date()`**, or cities in other time zones break.
- **Weather codes** → `sky`: 95+ = storm, 71/73/75/77/85/86 = snow, else other.
- **Caching:** forecasts are kept in memory per `placeKey` (lat/lon to 2 decimals). Refetch if older than 20 minutes when a page opens, or 30 minutes when the app returns to the foreground. Pull to refresh forces it. Neighbouring city pages are prefetched.
- **Geocoding:** Open-Meteo geocoding API (free, no key) for city search; `expo-location` reverse geocode for the phone's own place name.

### 6.2 The score (`vibe.ts`)

**Hour score:**
1. Start from a comfort curve on feels-like °F (the `COMFORT` table; linear between points). 64–76° = 10. Heat falls off faster than cold.
2. Rain/snow takes a share of the score: `s *= 1 − likely × heavy`, where `likely = clamp((rainChance − 10)/60)` and `heavy = 0.5 (snow 0.35) + min(0.25, precip × 2.5)`.
3. Then: storm −1.5; gusts over 20 mph up to −3; dew point over 65°F up to −2; overcast daytime −0.7; sun on a cool day +0.6; sun on a hot day −0.6.
4. Round and clamp to 1–10.

**Day score:** over waking hours (8 AM–8 PM): `round(mean − 0.25 × (mean − worst))`, so one miserable stretch drags the day a little.

Sanity checks used while tuning: 72°F with 50% rain → 7; 52°F rain all day → 2; 88°F humid and sunny → 3.

**The word** (first rule that matches): Stormy → Snowy → Soggy/Miserable (6+ wet hours) → Scorcher → Swampy → Brutal → Bundle up → Raw → Blustery → Crisp → Gorgeous (9+) → Pleasant (7+) → Iffy → Gloomy → Meh.

**What to wear:** from the day's low and high feels-like: Heavy coat / Winter coat / Layers (15°+ swing) / Jacket / Light jacket / T-shirt / Shorts, plus "and umbrella" (40%+ rain) or "and boots" (snow).

**The vibe line:** three human lines per word in `FEELINGS`, picked by date so it's stable for the day. Hidden until you tap the word.

**The one callout** (today only, first that applies):
1. Rain/snow/storm arriving later. Its button is "Get a ride" in a weekday commute window (7–9 AM, 4–6 PM), otherwise "Order in" if 5–10 PM.
2. Wet now: "Rain until 3 PM" or "Rain all day", with Order in (evening) or Get a ride.
3. A feels-like drop of 18°+ ahead: "Much colder by 8 PM".
4. Otherwise the best window ahead if it scores 7+: "Best: 1 PM – 6 PM".

The callout's button opens Plans with that idea expanded.

### 6.3 The sky (`skyclock.ts` + `Sky.tsx`)

- **Inputs:** `{ cloud, wet }`. For today: the current hour's cloud cover. `wet` is set when that hour has ≥50% chance and precip > 0 (storm or snow by weather code, else rain). For other days: average daytime cloud, and wet if ≥4 daytime hours have ≥60% chance. Today follows the real clock; other days show their daytime sky. The score does **not** tint the sky; the number carries the verdict.
- **Phases:** night → blue hour → dawn → day → golden → sunset → dusk → night, keyed to that day's real sunrise and sunset (e.g. golden hour blends in from 90 minutes before sunset and peaks 40 minutes before). Colors blend between keyframes minute by minute.
- **Palettes:** each phase has a clear and an overcast three-stop gradient (top, middle, horizon) in `PHASE`. Cloud cover blends between them (`overcast = clamp((cloud − 20)/70)`). Rain, storm and snow have their own daytime palettes (`WET`), faded toward the cloudy night as it gets dark. Clear day = pale blue to peach; overcast = dove grey; rain = slate; storm = charcoal; snow = pale grey; clear night = navy with stars; cloudy night = charcoal.
- **Text color:** weighted luminance (middle counts double) ≥ 0.2 → dark navy text; otherwise white. Rain and storm always use white. Then a guard nudges the sky: lighten until luminance ≥ 0.3 under dark text; darken under white text (max luminance 0.14 / 0.13 / 0.11 by stop). Checked across every 5 minutes of a day, every cloud level and every wet type: secondary text never drops below 4.5:1.
- **Theming:** `look.ink` picks `DARK_INK` or `LIGHT_INK`, provided via `InkProvider`. Components get styles from `themed((INK) => StyleSheet.create(...))`; call the result as a hook (`useStyles()`) inside the provider, or `.for(ink)` above it. **Never hard-code white or navy text; use `useInk()` / themed styles.** The share card's controls sit on a dark scrim and always use `LIGHT_INK`.
- **Motion:** sun/moon glow breathes (7 s in, 7 s out) and moves along a sunrise-to-sunset arc. Up to six cloud puffs drift across (150–230 s per pass), more with more cloud. 42 stars, every third twinkling slowly; they show when it's dark and clear. Rain streaks and snowflakes are sparse and slow. All native-driver `Animated`; everything stops with Reduce Motion.

### 6.4 Plans (`plans.ts`, `partners.ts`, `PlansSheet.tsx`)

- **When shown:** the Plans pill (top left) appears only for where you are, or a saved city within 150 km (`NEAR_KM`). If location is off, it stays on.
- **Ideas:** ride, order in, coffee, movie, museum, park, ice cream, brunch, eat outside, bar, something on tonight, late-night food. Each gets a usefulness score from the moment (wet now or later, time of day, commute, hot/cold, weekend, score). Ideas at 0 or below are dropped, the rest sorted. The sheet shows the top 3 plus "More ideas". Rules were checked across 8 scenarios (rainy commute, hot Saturday, 1 AM, etc.).
- **Links:** places (coffee, movie, park…) open **Apple Maps** (iPhone default) or **Google Maps** (Android, or by toggle on iPhone; saved per phone). Partner ideas offer two providers: Uber/Lyft, Uber Eats/DoorDash, Maps/OpenTable. "Something on tonight" goes to Fever (big cities, slug map) or Ticketmaster.
- **Opening apps:** `openLink()` tries the app's own address first (`uber://`, `lyft://`, `ubereats://`, `doordash://`, `comgooglemaps://`) and falls back to the website if that fails. No `canOpenURL` check, so no `LSApplicationQueriesSchemes` is needed. OpenTable, Viator, Fever and Ticketmaster have no documented in-app search address, so they open the web (their pages often hand off to the app).
- **Search:** app names and prefixes ("ube" → Uber) and intents ("taxi" → Uber + Lyft, "delivery" → Uber Eats + DoorDash) open the apps, with a nearby Maps search as fallback. Anything else → Nearby (Maps), Tickets (Ticketmaster), Things to do (Viator), Restaurants (OpenTable).
- **Money:** `AFFILIATE` in `partners.ts` holds each partner's tracking parameters, appended to both app and web links. All empty today. The sheet shows "Some links may earn us a commission." Research so far: Uber and DoorDash pay only for new users; Viator ~8%; Fever, SeatGeek, Ticketmaster via Impact; Airbnb has no open program; Skyscanner pays per click. A "plan a trip" module was built and deliberately scrapped as too complicated.

### 6.5 Cities

- Pages = [phone location, ...saved cities] (max 12, stored on the phone). Swipe left/right (PanResponder: horizontal 50 px), page dots under the place name.
- Tap the place name → `CitySearch`: current location, your cities with today's score and word, × to remove, search to add. Adding a city saves it and jumps to it.
- Location off → New York by default, with a notice when you pick "Current location".

### 6.6 Share

"Share today" (top right) previews a square card (place, date, score, word, vibe line, "Skyscore" wordmark) in the current sky colors, captures it at 1080×1080 and opens the system share sheet. `APP_LINK` (empty) prints a download link on the card once the app is in the stores.

### 6.7 Analytics (`track.ts`)

- PostHog capture API, US cloud, project 657614. The public project key is in code by design (it can only send events).
- Events: `app_open`, `city_swipe`, `city_add`, `vibe_reveal`, `plans_open {source}`, `plan_tap {kind, partner}`, `plans_search {partner}`, `share_open`, `share_sent`.
- Each carries a random anonymous id (stored on the phone) and `$process_person_profile: false`. **Never add location, coordinates or city names to events**; the privacy policy and App Store answers promise that.
- Failures are swallowed: counting must never break the app.

### 6.8 Look and type

- **Fonts:** Big Shoulders (condensed, scoreboard-like) only for the score, the word and big titles. Figtree for everything else.
- **Text:** one color at a few strengths (full, strong, soft, faint) so hierarchy comes from tone, not more colors.
- **Layout:** score size `min(27% of height, height − 520 (≥130), 68% of width)`, a little smaller for "10". Haptic tick on every tap.
- **Inspiration for the current sky:** airy, pale, frosted-glass weather UI (blue to peach), not saturated blues.

## 7. Website, store, brand

- **Site:** `docs/index.html` (one page, its sky follows the visitor's clock with the app's palettes and readability rule) and `docs/privacy.html`. Hosted by GitHub Pages from `main` / `/docs` at **byilma.github.io/weather_app**. Self-contained HTML; Google Fonts is the only external load.
- **Store:** `store/listing.md` has name, subtitle ("Weather, rated 1 to 10"), promo text, description, keywords, URLs, age rating, and the App Privacy answers. `store/screenshots/` has five captioned shots at 1320×2868 (6.9") and 1206×2622 (6.3").
- **Icon:** a deep navy "10" on the clear-day sky (pale blue to peach) over a faint skyline of hours. Android adaptive background color `#bde0e6`.
- **Contact:** skyscore.app@gmail.com (site, privacy policy, listing).
- **Licensing:** Open-Meteo data is CC BY 4.0; the app credits "Weather data by Open-Meteo.com" in the city list. The free API is **non-commercial**; see §9.

## 8. Where things stand

**Works and has been checked on a phone (Expo Go):** score screen, swipe between cities, Plans and its links, share.

**Built since, checked only in web preview, not yet on a phone:**
- the live-weather sky
- dark/white text switching
- app-first links (`uber://` etc.)
- the new icon (Expo Go always shows its own icon; you'll see this one in the TestFlight build)

## 9. Before the first public release (must do)

1. **Open-Meteo commercial key.** Skyscore can earn commissions, so it counts as commercial. Subscribe to API Standard and set `OPEN_METEO_KEY` in `weather.ts`; the host switches automatically. The key ships inside the app; if that matters, put a tiny proxy in front of Open-Meteo instead.
2. **Bundle id.** `com.skyscore.app` in `app.json` is a placeholder; register the real one (ideally on a domain you own).
3. **Apple Developer + EAS.** Enroll (individual now; an LLC is planned and can take over later). Add `eas.json`, run `npx eas-cli@latest build -p ios`, upload to TestFlight, invite testers. No EAS config exists yet.
4. **Test every outbound link on real phones,** with and without each app installed. Those marked "test" in `partners.ts` came from public URL patterns, not official docs.
5. **PostHog data retention:** set it to 12 months to match the privacy policy (not confirmed done).
6. **App Privacy form:** answer from `store/listing.md` (coarse location for app functionality; product interaction for analytics; neither linked nor tracking).

## 10. Known gaps and risks

- **No tests.** Engine rules are only checked by hand-run simulations.
- **US units only** (°F, mph, inches) and English copy. Fine for a US launch; needs work for anywhere else.
- **Location off → New York.** Reasonable for a US-first beta; revisit for others.
- **App scheme fallback relies on `Linking.openURL` rejecting** when no app handles the scheme. Expected on iOS and Android, but verify on devices (§9.4).
- **Fever city slugs** are a hand-made list; unknown cities fall back to Ticketmaster.
- **WeatherKit** was considered and parked: it needs a server to sign JWTs plus Apple's attribution, so it isn't a drop-in swap. `weather.ts` keeps the rest of the app source-agnostic (everything downstream only sees `Hour[]`).
- **AGENTS.md** is generic Expo guidance (it mentions Expo Router); this app doesn't use the router.

## 11. Roadmap (owner's intent, not started)

Ship to TestFlight first and let testers decide what's next. Don't overbuild. Candidates in rough order:
1. **Plans that learn you, quietly and on the phone.** For example, reorder ideas by what this person actually taps, remember "always DoorDash". No account, nothing leaves the phone.
2. **Affiliate approvals** (start with Impact: Fever, SeatGeek, Ticketmaster; then Viator), then fill `AFFILIATE`.
3. **`APP_LINK` on the share card** once there's a store listing.
4. **More Plans ideas** only where they're genuinely useful in some weather.

## 12. Suggested first moves for a new engineer

1. Run it in Expo Go, `tsc` and `lint` clean.
2. Add unit tests for `scoreHour`, `vibeForDay`, `calloutForToday`, `plansFor`, `searchLinks`, `skyLook` (including the 4.5:1 contrast sweep). Freeze today's behavior before changing it.
3. Set up `eas.json` and get a TestFlight build out (§9.3).
4. Walk §9.4 on two phones.

## 13. Access you'll need from the owner

- GitHub: collaborator on `byilma/weather_app`.
- PostHog: invite to the Skyscore project (US).
- Apple Developer team, once enrolled (for EAS builds and TestFlight).
- Open-Meteo account, once the paid plan is bought.
