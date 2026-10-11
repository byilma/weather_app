// The background: a living sky. Colours come from skyclock.ts (this hour's weather
// + time of day). Motion is deliberately slow and faint: a sun/moon glow that
// breathes, clouds that drift across over a couple of minutes, stars that twinkle
// on clear nights. It all stops if Reduce Motion is on.

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
          {look.stars > 0.02 && <Stars w={size.w} h={size.h} amount={look.stars} reduce={reduce} />}
          <Clouds w={size.w} h={size.h} amount={look.haze} night={look.night} pale={look.ink === 'dark'} reduce={reduce} />
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

// Clouds: soft puffs drifting left to right, wrapping around. None on a clear
// day, up to six when it's overcast. Greyer and fainter at night.
const CLOUDS = [
  { y: 0.1, size: 0.62, seconds: 150, start: 0.15 },
  { y: 0.3, size: 0.48, seconds: 190, start: 0.65 },
  { y: 0.2, size: 0.7, seconds: 170, start: 0.45 },
  { y: 0.52, size: 0.5, seconds: 210, start: 0.9 },
  { y: 0.04, size: 0.55, seconds: 230, start: 0.35 },
  { y: 0.42, size: 0.66, seconds: 200, start: 0.05 },
];

function Clouds({ w, h, amount, night, pale, reduce }: {
  w: number; h: number; amount: number; night: number; pale: boolean; reduce: boolean;
}) {
  if (amount < 0.12) return null;
  const count = Math.min(CLOUDS.length, Math.max(1, Math.round(amount * CLOUDS.length)));
  // White on a pale sky needs more body to show; on a dark sky a little goes a long way.
  const opacity = (pale ? 0.16 + 0.16 * amount : 0.07 + 0.09 * amount) * (1 - 0.45 * night);
  const color = night > 0.5 ? '#c9ccd6' : '#ffffff';
  return (
    <>
      {CLOUDS.slice(0, count).map((c, i) => (
        <Cloud key={i} w={w} h={h} cloud={c} opacity={opacity} color={color} reduce={reduce} />
      ))}
    </>
  );
}

function Cloud({ w, h, cloud, opacity, color, reduce }: {
  w: number; h: number; cloud: (typeof CLOUDS)[number]; opacity: number; color: string; reduce: boolean;
}) {
  const id = svgId(useId());
  const cw = w * cloud.size * 1.5;
  const ch = cw * 0.42;
  const pos = useRef(new Animated.Value(cloud.start)).current; // 0 = just off the left edge, 1 = off the right

  useEffect(() => {
    if (reduce) return;
    const full = cloud.seconds * 1000;
    pos.setValue(cloud.start);
    const anim = Animated.sequence([
      Animated.timing(pos, { toValue: 1, duration: full * (1 - cloud.start), easing: Easing.linear, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pos, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(pos, { toValue: 1, duration: full, easing: Easing.linear, useNativeDriver: true }),
        ]),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reduce, cloud.seconds, cloud.start, pos]);

  const translateX = pos.interpolate({ inputRange: [0, 1], outputRange: [-cw, w] });
  // Three overlapping soft ellipses make a puff.
  const puffs = [
    { cx: 0.32, cy: 0.62, rx: 0.3, ry: 0.36 },
    { cx: 0.55, cy: 0.45, rx: 0.32, ry: 0.45 },
    { cx: 0.74, cy: 0.64, rx: 0.26, ry: 0.32 },
  ];
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: cloud.y * h, width: cw, height: ch, transform: [{ translateX }] }}>
      <Svg width={cw} height={ch}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.6" stopColor={color} stopOpacity={opacity * 0.55} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {puffs.map((p, i) => (
          <Ellipse key={i} cx={p.cx * cw} cy={p.cy * ch} rx={p.rx * cw} ry={p.ry * ch} fill={`url(#${id})`} />
        ))}
      </Svg>
    </Animated.View>
  );
}

// Stars: a sprinkle of tiny dots in the upper sky on clear nights. A few twinkle,
// very slowly. They fade in through dusk and out at dawn.
const STARS = 42;

function Stars({ w, h, amount, reduce }: { w: number; h: number; amount: number; reduce: boolean }) {
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: amount }]} pointerEvents="none">
      {Array.from({ length: STARS }, (_, i) => (
        <Star key={i} i={i} w={w} h={h} reduce={reduce} />
      ))}
    </View>
  );
}

function Star({ i, w, h, reduce }: { i: number; w: number; h: number; reduce: boolean }) {
  const size = 1.2 + rand(i, 7) * 1.6;
  const base = 0.35 + rand(i, 8) * 0.5;
  const twinkles = i % 3 === 0;
  const glow = useRef(new Animated.Value(base)).current;

  useEffect(() => {
    if (reduce || !twinkles) return;
    const half = 2500 + rand(i, 9) * 3000;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(rand(i, 10) * 4000),
        Animated.timing(glow, { toValue: base * 0.3, duration: half, easing: ease, useNativeDriver: true }),
        Animated.timing(glow, { toValue: base, duration: half, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, twinkles, i, base, glow]);

  // Denser near the top, thinning toward the middle of the screen.
  const y = rand(i, 11) ** 1.6 * h * 0.62;
  return (
    <Animated.View
      style={{
        position: 'absolute', left: rand(i, 12) * w, top: y, width: size, height: size,
        borderRadius: size / 2, backgroundColor: '#ffffff', opacity: glow,
      }}
    />
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
