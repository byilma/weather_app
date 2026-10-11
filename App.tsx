import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, AppState, LayoutAnimation, PanResponder, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { fetchForecast, liveNow, type Forecast } from './src/weather';
import { calloutForToday, groupDays, vibeForDay, type Callout, type CalloutIcon, type DayVibe } from './src/vibe';
import { currentPlace, DEFAULT_PLACE, distanceKm, NEAR_KM, placeKey, type Place } from './src/places';
import { CitySearch, type CityRow } from './src/CitySearch';
import { loadCities, loadMapsApp, MAX_CITIES, saveCities, saveMapsApp } from './src/storage';
import { defaultMapsApp, type MapsApp } from './src/partners';
import { track } from './src/track';
import { Sky } from './src/Sky';
import { ShareCard } from './src/ShareCard';
import { PlansSheet } from './src/PlansSheet';
import { plansFor, type PlanKind } from './src/plans';
import { skyLook, type SkyWeather } from './src/skyclock';
import { DARK_INK, F, FONT_ASSETS, InkProvider, LIGHT_INK, themed, useInk, type Ink } from './src/theme';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ICON: Record<CalloutIcon, keyof typeof Ionicons.glyphMap> = {
  rain: 'rainy-outline', snow: 'snow-outline', storm: 'thunderstorm-outline', cold: 'thermometer-outline', sun: 'sunny-outline',
};
const tap = () => Haptics.selectionAsync().catch(() => {});

export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}

function Home() {
  const [fontsReady] = useFonts(FONT_ASSETS);
  const [current, setCurrent] = useState<Place | null>(null); // where the phone is (null if location is off)
  const [saved, setSaved] = useState<Place[]>([]); // the user's cities, remembered on the phone
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0); // which city page is showing
  const [forecasts, setForecasts] = useState<Record<string, Forecast>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState(0); // which day is shown big
  const [showVibe, setShowVibe] = useState(false); // the one-liner under the word
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [plansOpen, setPlansOpen] = useState<{ focus?: PlanKind } | null>(null);
  const [mapsApp, setMapsApp] = useState<MapsApp>(defaultMapsApp());
  const [, setTick] = useState(0); // re-render each minute so the sky and "now" keep moving
  const inflight = useRef(new Set<string>());
  const forecastsRef = useRef(forecasts);
  forecastsRef.current = forecasts;

  // Start: where the phone is, plus the saved cities.
  useEffect(() => {
    loadMapsApp().then((app) => app && setMapsApp(app));
    Promise.all([currentPlace(), loadCities()]).then(([here, list]) => {
      setCurrent(here);
      setSaved(list);
      setStarted(true);
    });
    track('app_open');
  }, []);

  // Pages to swipe through: where you are first, then your cities in the order you added them.
  const pages = useMemo<Place[]>(() => {
    const list = current ? [current, ...saved] : saved;
    return list.length ? list : [DEFAULT_PLACE];
  }, [current, saved]);
  const pageIndex = Math.min(index, pages.length - 1);
  const place = started ? pages[pageIndex] : null;
  const key = place ? placeKey(place) : '';
  const forecast = place ? (forecasts[key] ?? null) : null;

  // Fetch a city's forecast unless we have a fresh one (under 20 minutes old).
  const load = useCallback(async (p: Place, force = false) => {
    const k = placeKey(p);
    const have = forecastsRef.current[k];
    if (inflight.current.has(k) || (!force && have && Date.now() - have.fetchedAt < 20 * 60 * 1000)) return;
    inflight.current.add(k);
    try {
      const f = await fetchForecast(p.lat, p.lon);
      setForecasts((m) => ({ ...m, [k]: f }));
      setFailed((m) => ({ ...m, [k]: false }));
    } catch {
      setFailed((m) => ({ ...m, [k]: true }));
    } finally {
      inflight.current.delete(k);
    }
  }, []);

  // New page: load it, and quietly load its neighbours so the next swipe is instant.
  useEffect(() => {
    if (!place) return;
    setPicked(0);
    load(place);
    const next = pages[pageIndex + 1];
    const prev = pages[pageIndex - 1];
    if (next) load(next);
    if (prev) load(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // The clock: nudge the screen every minute (the sky drifts toward sunset, "now" moves on).
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Coming back to the app after a while: refresh if the forecast is over 30 minutes old.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setTick((n) => n + 1);
      track('app_open');
      if (place && forecast && Date.now() - forecast.fetchedAt > 30 * 60 * 1000) load(place, true);
    });
    return () => sub.remove();
  }, [place, forecast, load]);

  // Swipe left/right between cities.
  const nav = useRef({ index: pageIndex, count: pages.length });
  nav.current = { index: pageIndex, count: pages.length };
  const goTo = useCallback((i: number) => {
    const { count } = nav.current;
    if (i < 0 || i >= count) return;
    tap();
    setShowVibe(false);
    setIndex(i);
    track('city_swipe');
  }, []);
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        nav.current.count > 1 && Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) goTo(nav.current.index + 1);
        else if (g.dx > 50) goTo(nav.current.index - 1);
      },
    }),
  ).current;

  // From the city list: where you are, a saved city, or a new one (which gets saved).
  const choose = async (choice: Place | 'current') => {
    setSearching(false);
    if (choice === 'current') {
      const here = await currentPlace();
      if (!here) {
        setNotice('Location is off for this app. Turn it on in Settings, or search for a city.');
        return;
      }
      setNotice(null);
      setCurrent(here);
      setIndex(0);
      return;
    }
    setNotice(null);
    const existing = pages.findIndex((p) => placeKey(p) === placeKey(choice));
    if (existing >= 0) {
      setIndex(existing);
      return;
    }
    const next = [...saved, choice].slice(-MAX_CITIES);
    setSaved(next);
    saveCities(next);
    setIndex((current ? 1 : 0) + next.length - 1);
    track('city_add');
  };
  const removeCity = (p: Place) => {
    const k = placeKey(p);
    const removedAt = pages.findIndex((x) => placeKey(x) === k);
    const next = saved.filter((x) => placeKey(x) !== k);
    setSaved(next);
    saveCities(next);
    if (removedAt >= 0 && removedAt <= pageIndex) setIndex(Math.max(0, pageIndex - 1));
  };

  const groups = useMemo(() => (forecast ? groupDays(forecast.hours) : []), [forecast]);
  const days = useMemo(() => groups.map(vibeForDay), [groups]);
  const now = forecast ? liveNow(forecast) : null;
  const nowHour = now ? now.getHours() : -1;
  const callout = useMemo(
    () => (forecast && groups[0] ? calloutForToday(groups[0], liveNow(forecast)) : undefined),
    // Recompute when the hour turns over, not every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forecast, groups, nowHour],
  );

  const day = days[picked];
  const ready = fontsReady && !!day;
  const loadFailed = !!failed[key] && !forecast;

  // The sky: today follows the real clock (sunrise, sunset, night); other days show their daytime.
  const hoursOfDay = groups[picked] ?? [];
  const cloud =
    picked === 0
      ? (hoursOfDay.find((h) => h.time.getHours() === nowHour)?.cloud ?? 50)
      : hoursOfDay.filter((h) => h.isDay).reduce((a, h, _, arr) => a + h.cloud / arr.length, 0);
  // What's falling: right now for today, or on a mostly wet day.
  const nowHourData = picked === 0 ? hoursOfDay.find((h) => h.time.getHours() === nowHour) : undefined;
  const wetDayHours = hoursOfDay.filter((h) => h.isDay && h.rainChance >= 60);
  const wetness = (hs: typeof hoursOfDay): SkyWeather['wet'] =>
    hs.some((h) => h.sky === 'storm') ? 'storm' : hs.filter((h) => h.sky === 'snow').length > hs.length / 2 ? 'snow' : 'rain';
  const wet: SkyWeather['wet'] =
    picked === 0
      ? nowHourData && nowHourData.rainChance >= 50 && nowHourData.precip > 0
        ? wetness([nowHourData])
        : null
      : wetDayHours.length >= 4
        ? wetness(wetDayHours)
        : null;
  const look = skyLook({ cloud, wet }, picked === 0 ? now : null, forecast?.sun[picked]);
  const INK = look.ink === 'dark' ? DARK_INK : LIGHT_INK; // text that reads on this sky
  const styles = useStyles.for(INK);

  // The city name to use in partner searches. If the phone couldn't name where you are,
  // leave it out rather than searching for "Your location".
  const cityName = (p: Place | null | undefined) => (!p || (p.isCurrent && p.name === 'Your location') ? '' : p.name);

  const where = place ? { city: cityName(place), lat: place.lat, lon: place.lon, isHere: !!place.isCurrent, mapsApp } : null;

  // Plans are for where you are (or near it). A saved city far away just shows its weather.
  // If location is off we can't tell, so Plans stay on.
  const nearYou = !place || !current || !!place.isCurrent || distanceKm(current, place) <= NEAR_KM;
  const plans = useMemo(() => {
    if (!nearYou || !place || !forecast || !groups[0] || !days[0]) return [];
    return plansFor(groups[0], liveNow(forecast), days[0].score, where!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, nearYou, groups, days, forecast, nowHour, mapsApp]);

  // Today's score for each city in the list (when we have its forecast).
  const scoreRow = useCallback(
    (p: Place): CityRow => {
      const f = forecasts[placeKey(p)];
      const first = f ? groupDays(f.hours)[0] : undefined;
      const v = first ? vibeForDay(first) : undefined;
      return { place: p, score: v?.score, word: v?.word };
    },
    [forecasts],
  );

  const toggleVibe = async () => {
    tap();
    if (!(await AccessibilityInfo.isReduceMotionEnabled())) {
      LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    }
    if (!showVibe) track('vibe_reveal');
    setShowVibe((v) => !v);
  };
  const openPlans = (source: 'button' | 'alert', focus?: PlanKind) => {
    tap();
    track('plans_open', { source });
    setPlansOpen({ focus });
  };

  return (
    <InkProvider value={INK}>
    <Sky look={look}>
      <SafeAreaView style={styles.fill}>
        <StatusBar style={INK.statusBar} />
        <ScrollView
          contentContainerStyle={styles.page}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={INK.full}
              onRefresh={async () => {
                if (!place) return;
                setRefreshing(true);
                await load(place, true);
                setRefreshing(false);
              }}
            />
          }
        >
          <View style={styles.fillGrow} {...swipe.panHandlers}>
            {/* Top: where we are rating (tap for your cities), page dots, and share. */}
            <View style={styles.top}>
              <View style={styles.topSide}>
                {ready && plans.length > 0 && (
                  <Pressable
                    style={styles.plansPill}
                    onPress={() => openPlans('button')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Plans: ideas for what to do in this weather"
                  >
                    <Text style={styles.plansPillText}>Plans</Text>
                  </Pressable>
                )}
              </View>
              {place && fontsReady && (
                <Pressable
                  style={styles.place}
                  onPress={() => {
                    tap();
                    setSearching(true);
                    pages.forEach((p) => load(p)); // fill in scores for the city list
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`${place.name}. Your cities`}
                  accessibilityHint={pages.length > 1 ? 'Swipe left or right to change city' : undefined}
                >
                  <View style={styles.placeRow}>
                    {place.isCurrent && <Ionicons name="navigate" size={14} color={INK.full} />}
                    <Text style={styles.placeText} numberOfLines={1}>{place.name}</Text>
                    <Ionicons name="chevron-down" size={16} color={INK.strong} />
                  </View>
                  {pages.length > 1 && (
                    <View style={styles.pageDots}>
                      {pages.map((p, i) => (
                        <View key={placeKey(p)} style={[styles.pageDot, i === pageIndex && styles.pageDotOn]} />
                      ))}
                    </View>
                  )}
                </Pressable>
              )}
              <View style={[styles.topSide, styles.topRight]}>
                {ready && (
                  <Pressable
                    onPress={() => { tap(); track('share_open'); setSharing(true); }}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Share this day"
                  >
                    <Ionicons name="share-outline" size={22} color={INK.full} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Middle: the verdict. */}
            <View style={styles.hero}>
              {notice && <Text style={styles.notice}>{notice}</Text>}
              {loadFailed && <Text style={styles.notice}>Couldn't reach the weather. Pull down to try again.</Text>}
              {!ready && !loadFailed && <ActivityIndicator color={INK.full} size="large" />}
              {ready && (
                <Verdict
                  day={day}
                  label={picked === 0 ? `Today · ${DAY_FULL[day.date.getDay()]}` : DAY_FULL[day.date.getDay()]}
                  showVibe={showVibe}
                  onToggleVibe={toggleVibe}
                  callout={picked === 0 ? callout : undefined}
                  onAction={plans.length ? (kind) => openPlans('alert', kind) : undefined}
                />
              )}
            </View>

            {/* Bottom: the day as a skyline of hours, then the week. */}
            {ready && (
              <View>
                <Skyline day={day} now={picked === 0 ? now : null} />
                <View style={styles.week}>
                  {days.map((d, i) => (
                    <Pressable
                      key={i}
                      onPress={() => { tap(); setPicked(i); }}
                      style={[styles.dayChip, i === picked && styles.dayChipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: i === picked }}
                      accessibilityLabel={`${i === 0 ? 'Today' : DAY_FULL[d.date.getDay()]}, ${d.score} out of 10, ${d.word}`}
                    >
                      <Text style={styles.dayName}>{i === 0 ? 'Today' : DAY[d.date.getDay()]}</Text>
                      <Text style={styles.dayScore}>{d.score}</Text>
                      <Text style={styles.dayWord} numberOfLines={1}>{d.word}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <CitySearch
          visible={searching}
          background={look.colors[0]}
          onClose={() => setSearching(false)}
          onPick={choose}
          current={current ? scoreRow(current) : undefined}
          saved={saved.map(scoreRow)}
          onRemove={removeCity}
        />
        {place && (
          <PlansSheet
            visible={!!plansOpen}
            onClose={() => setPlansOpen(null)}
            plans={plans}
            focus={plansOpen?.focus}
            where={where!}
            onMapsApp={(app) => { tap(); setMapsApp(app); saveMapsApp(app); }}
            background={look.colors[0]}
            onLinkTap={(kind, l) =>
              track(kind === 'search' ? 'plans_search' : 'plan_tap', { kind, partner: l.partner })
            }
          />
        )}
        {ready && place && (
          <ShareCard
            visible={sharing}
            onClose={() => setSharing(false)}
            onShared={() => track('share_sent')}
            place={place.name}
            day={day}
            colors={look.colors}
          />
        )}
      </SafeAreaView>
    </Sky>
    </InkProvider>
  );
}

// The score, its word, and what to do about it.
function Verdict({ day, label, showVibe, onToggleVibe, callout, onAction }: {
  day: DayVibe; label: string; showVibe: boolean; onToggleVibe: () => void; callout?: Callout;
  onAction?: (kind: PlanKind) => void; // undefined for a far-away city (no rides there)
}) {
  const { width, height } = useWindowDimensions();
  // As tall as the phone allows, while leaving room for everything else on short phones.
  // "10" is wider than one digit, so it gets a little less.
  const size = Math.round(
    Math.min(height * 0.27, Math.max(130, height - 520), day.score === 10 ? width * 0.5 : width * 0.68),
  );
  const [wordWidth, setWordWidth] = useState(0);
  const styles = useStyles();
  const INK = useInk();

  return (
    <View style={styles.verdict}>
      <Text style={styles.when}>{label}</Text>

      {/* The number sits dead centre; "/10" hangs off its right edge. */}
      <View accessible accessibilityLabel={`${day.score} out of 10`}>
        <Text style={[styles.score, { fontSize: size, lineHeight: size * 1.02 }]}>
          {day.score}
        </Text>
        <Text style={[styles.outOf, { fontSize: size * 0.2, bottom: size * 0.1 }]}>/10</Text>
      </View>

      {/* Tap the word for the vibe. The dotted underline says "there's more here". */}
      <Pressable onPress={onToggleVibe} hitSlop={10} accessibilityRole="button" accessibilityHint="Shows a one-line take on the day">
        <Text style={styles.word} onLayout={(e) => setWordWidth(e.nativeEvent.layout.width)}>{day.word}</Text>
        <View style={styles.dots}>
          {Array.from({ length: Math.max(0, Math.floor(wordWidth / 8)) }, (_, i) => <View key={i} style={styles.dot} />)}
        </View>
      </Pressable>
      {showVibe && <Text style={styles.vibe}>{day.feeling}</Text>}

      <Text style={styles.line}>{day.line}</Text>

      {callout && (
        <View style={styles.callout}>
          <Ionicons name={ICON[callout.icon]} size={20} color={INK.full} />
          <Text style={styles.calloutText}>{callout.text}</Text>
          {callout.action && onAction && (
            <Pressable style={styles.button} onPress={() => onAction(callout.action!.kind)} accessibilityRole="button">
              <Text style={styles.buttonText}>{callout.action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// Each hour is a building: taller and brighter = a better hour.
// For today, hours already gone are dimmed and a dot marks now.
function Skyline({ day, now }: { day: DayVibe; now: Date | null }) {
  const { height } = useWindowDimensions();
  const tall = height < 700 ? 4 : 5.5; // shorter buildings on small phones
  const hours = day.hours.filter((h) => h.time.getHours() >= 6);
  const nowHour = now ? now.getHours() : -1;
  const styles = useStyles();
  return (
    <View style={styles.skyline} accessibilityLabel="Hour by hour, taller is better">
      <View style={[styles.buildings, { height: 20 + 10 * tall }]}>
        {hours.map((h) => {
          const hr = h.time.getHours();
          const past = now !== null && hr < nowHour;
          const isNow = hr === nowHour;
          return (
            <View key={hr} style={styles.col}>
              {isNow && <View style={styles.nowDot} />}
              <View
                style={[
                  styles.building,
                  { height: 10 + h.score * tall, opacity: past ? 0.22 : isNow ? 1 : 0.35 + h.score * 0.055 },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.ground} />
      <View style={styles.hourLabels}>
        {hours.map((h) => (
          <View key={h.time.getHours()} style={styles.hourSlot}>
            {h.time.getHours() % 3 === 0 && <Text style={styles.hourLabel}>{label(h.time.getHours())}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const label = (h: number) => (h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`);

const useStyles = themed((INK: Ink) => StyleSheet.create({
  fill: { flex: 1 },
  // flexGrow lets the page fill the screen, so the middle can centre and the week sits at the bottom.
  page: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10 },

  top: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  topSide: { width: 72 },
  topRight: { alignItems: 'flex-end' },
  place: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 10 },
  placeText: { color: INK.full, fontFamily: F.semi, fontSize: 18, flexShrink: 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageDots: { flexDirection: 'row', gap: 5, marginTop: 5 },
  pageDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: INK.faint },
  pageDotOn: { backgroundColor: INK.full },
  fillGrow: { flexGrow: 1 },
  plansPill: { alignSelf: 'flex-start', backgroundColor: INK.shade, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  plansPillText: { color: INK.full, fontFamily: F.bold, fontSize: 15 },

  hero: { flex: 1, justifyContent: 'center', paddingVertical: 16 },
  notice: { color: INK.strong, fontFamily: F.text, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  verdict: { alignItems: 'center' },
  when: { color: INK.strong, fontFamily: F.semi, fontSize: 17 },
  score: { color: INK.full, fontFamily: F.score, textAlign: 'center', includeFontPadding: false },
  outOf: { color: INK.soft, fontFamily: F.scoreB, position: 'absolute', left: '100%', marginLeft: 4 },
  word: { color: INK.full, fontFamily: F.scoreXB, fontSize: 52, lineHeight: 56, textAlign: 'center', marginTop: -4 },
  dots: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', height: 3, marginTop: 1 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: INK.faint },
  vibe: {
    color: INK.full, fontFamily: F.italic, fontSize: 18, lineHeight: 25,
    textAlign: 'center', marginTop: 12, maxWidth: 340,
  },
  line: { color: INK.strong, fontFamily: F.semi, fontSize: 18, marginTop: 14, textAlign: 'center' },

  callout: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26,
    backgroundColor: INK.shade, borderRadius: 999, paddingVertical: 7, paddingLeft: 16, paddingRight: 7,
  },
  calloutText: { color: INK.full, fontFamily: F.bold, fontSize: 16, paddingVertical: 7, paddingRight: 6 },
  button: { backgroundColor: INK.full, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  buttonText: { color: INK.onFull, fontFamily: F.bold, fontSize: 15 },

  skyline: { marginBottom: 18 },
  buildings: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 1 },
  building: { alignSelf: 'stretch', backgroundColor: INK.full, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  nowDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: INK.full, marginBottom: 5 },
  ground: { height: StyleSheet.hairlineWidth * 2, backgroundColor: INK.faint },
  hourLabels: { flexDirection: 'row', marginTop: 5, height: 15 },
  hourSlot: { flex: 1, marginHorizontal: 1 },
  // Centred under its building, free to be wider than the building itself.
  hourLabel: {
    position: 'absolute', left: '50%', width: 40, marginLeft: -20,
    color: INK.full, fontFamily: F.text, fontSize: 11, textAlign: 'center',
  },

  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayChip: { alignItems: 'center', paddingTop: 8, paddingBottom: 9, borderRadius: 16, width: '13.6%' },
  dayChipOn: { backgroundColor: INK.chip },
  dayName: { color: INK.full, fontFamily: F.semi, fontSize: 12 },
  dayScore: { color: INK.full, fontFamily: F.scoreXB, fontSize: 28, lineHeight: 32, marginTop: 1 },
  dayWord: { color: INK.full, fontFamily: F.text, fontSize: 10 },
}));
