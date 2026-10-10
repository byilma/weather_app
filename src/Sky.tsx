// The background: a living sky. Colours come from skyclock.ts (score + time of day).
// Motion is deliberately slow and faint: a sun/moon glow that breathes, and haze
// that drifts across over a minute or two. It all stops if Reduce Motion is on.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import type { SkyLook } from './skyclock';

type Colors = [string, string, string];
const LOCATIONS: [number, number, number] = [0, 0.55, 1];

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export function Sky({ look, children }: { look: SkyLook; children: ReactNode }) {
  const reduce = useReduceMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <Gradient colors={look.colors} reduce={reduce} />
      {size.w > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Haze w={size.w} h={size.h} amount={look.haze} reduce={reduce} />
          {look.fall && !reduce && <Fall kind={look.fall} w={size.w} h={size.h} />}
          <Glow w={size.w} h={size.h} glow={look.glow} reduce={reduce} />
        </View>
      )}
      {children}
    </View>
  );
}

// Three-stop gradient. When the colours change (another day or city), the old
// sky fades out over the new one instead of snapping.
function Gradient({ colors, reduce }: { colors: Colors; reduce: boolean }) {
  const key = colors.join();
  const [current, setCurrent] = useState<Colors>(colors);
  const [previous, setPrevious] = useState<Colors | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (key === current.join()) return;
    setPrevious(current);
    setCurrent(colors);
    fade.setValue(1);
    const anim = Animated.timing(fade, { toValue: 0, duration: reduce ? 0 : 600, useNativeDriver: true });
    anim.start(({ finished }) => finished && setPrevious(null));
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <>
      <LinearGradient colors={current} locations={LOCATIONS} style={StyleSheet.absoluteFill} />
      {previous && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="none">
          <LinearGradient colors={previous} locations={LOCATIONS} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </>
  );
}

const svgId = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, '');

// The sun or moon: a large soft light that breathes very slowly.
function Glow({ w, h, glow, reduce }: { w: number; h: number; glow: SkyLook['glow']; reduce: boolean }) {
  const id = svgId(useId());
  const d = Math.max(w, h) * 0.9; // diameter of the glow
  const x = useRef(new Animated.Value(glow.x * w - d / 2)).current;
  const y = useRef(new Animated.Value(glow.y * h - d / 2)).current;
  const breathe = useRef(new Animated.Value(1)).current;

  // Glide to a new position (another day, or the sun moving on).
  useEffect(() => {
    const opts = { duration: reduce ? 0 : 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true };
    Animated.parallel([
      Animated.timing(x, { toValue: glow.x * w - d / 2, ...opts }),
      Animated.timing(y, { toValue: glow.y * h - d / 2, ...opts }),
    ]).start();
  }, [glow.x, glow.y, w, h, d, reduce, x, y]);

  // Breathe: 7 seconds in, 7 seconds out, between 65% and 100%.
  useEffect(() => {
    if (reduce) {
      breathe.setValue(1);
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 0.65, duration: 7000, easing: ease, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 7000, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, breathe]);

  return (
    <Animated.View
      style={{ position: 'absolute', width: d, height: d, opacity: breathe, transform: [{ translateX: x }, { translateY: y }] }}
    >
      <Svg width={d} height={d}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glow.color} stopOpacity={glow.strength} />
            <Stop offset="0.45" stopColor={glow.color} stopOpacity={glow.strength * 0.35} />
            <Stop offset="1" stopColor={glow.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={d / 2} cy={d / 2} rx={d / 2} ry={d / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

// Haze: three faint bands drifting sideways at different speeds. Thicker when cloudy.
const BANDS = [
  { y: 0.16, height: 0.2, seconds: 60, from: -0.3 },
  { y: 0.44, height: 0.16, seconds: 85, from: 0.25 },
  { y: 0.7, height: 0.22, seconds: 110, from: -0.1 },
];

function Haze({ w, h, amount, reduce }: { w: number; h: number; amount: number; reduce: boolean }) {
  const opacity = 0.02 + 0.1 * amount;
  return (
    <>
      {BANDS.map((b, i) => (
        <Band key={i} w={w} h={h} band={b} opacity={opacity} reduce={reduce} />
      ))}
    </>
  );
}

function Band({ w, h, band, opacity, reduce }: {
  w: number; h: number; band: (typeof BANDS)[number]; opacity: number; reduce: boolean;
}) {
  const id = svgId(useId());
  const bw = w * 1.6;
  const bh = h * band.height;
  const drift = useRef(new Animated.Value(band.from)).current;

  useEffect(() => {
    if (reduce) return;
    const ease = Easing.inOut(Easing.sin);
    const half = (band.seconds * 1000) / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 0.35, duration: half, easing: ease, useNativeDriver: true }),
        Animated.timing(drift, { toValue: -0.35, duration: half, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, band.seconds, drift]);

  const translateX = drift.interpolate({ inputRange: [-1, 1], outputRange: [-w, w] });
  return (
    <Animated.View
      style={{
        position: 'absolute', left: (w - bw) / 2, top: band.y * h - bh / 2, width: bw, height: bh,
        transform: [{ translateX }],
      }}
    >
      <Svg width={bw} height={bh}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={opacity} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={bw / 2} cy={bh / 2} rx={bw / 2} ry={bh / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

// Rain or snow: a few faint particles, slower and sparser than the real thing,
// so it reads as "it's raining" without pulling the eye. Off with Reduce Motion.
const RAIN = 12;
const SNOW = 16;
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; // same layout every time
  return x - Math.floor(x);
};

function Fall({ kind, w, h }: { kind: 'rain' | 'snow'; w: number; h: number }) {
  const n = kind === 'rain' ? RAIN : SNOW;
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        kind === 'rain' ? <Drop key={`r${i}`} i={i} w={w} h={h} /> : <Flake key={`s${i}`} i={i} w={w} h={h} />
      ))}
    </>
  );
}

function useLoop(duration: number, delay: number) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);
  return t;
}

function Drop({ i, w, h }: { i: number; w: number; h: number }) {
  const len = 22 + rand(i, 1) * 14;
  const duration = 1700 + rand(i, 2) * 900;
  const t = useLoop(duration, rand(i, 3) * duration);
  const x = rand(i, 4) * (w + 0.2 * h);
  return (
    <Animated.View
      style={{
        position: 'absolute', left: 0, top: 0, width: 1.5, height: len, borderRadius: 1,
        backgroundColor: '#ffffff', opacity: 0.1 + rand(i, 5) * 0.06,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [x, x - 0.2 * h] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-len, h + len] }) },
          { rotate: '11deg' },
        ],
      }}
    />
  );
}

function Flake({ i, w, h }: { i: number; w: number; h: number }) {
  const size = 3 + rand(i, 1) * 2.5;
  const duration = 9000 + rand(i, 2) * 6000;
  const t = useLoop(duration, rand(i, 3) * duration);
  const x = rand(i, 4) * w;
  const sway = 10 + rand(i, 6) * 10;
  return (
    <Animated.View
      style={{
        position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#ffffff', opacity: 0.3 + rand(i, 5) * 0.25,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [x, x + sway, x, x - sway, x] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-size, h + size] }) },
        ],
      }}
    />
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, overflow: 'hidden' } });
