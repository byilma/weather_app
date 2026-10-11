import { createContext, useContext } from 'react';

// Look and feel in one place: the typefaces and the text colours.

// Two families. Big Shoulders (tall, condensed, scoreboard-like) is only for the
// verdict: the score and its word. Figtree does all the talking.
export const FONT_ASSETS = {
  'Score-Black': require('@expo-google-fonts/big-shoulders/900Black/BigShoulders_900Black.ttf'),
  'Score-ExtraBold': require('@expo-google-fonts/big-shoulders/800ExtraBold/BigShoulders_800ExtraBold.ttf'),
  'Score-Bold': require('@expo-google-fonts/big-shoulders/700Bold/BigShoulders_700Bold.ttf'),
  'Text-Medium': require('@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf'),
  'Text-MediumItalic': require('@expo-google-fonts/figtree/500Medium_Italic/Figtree_500Medium_Italic.ttf'),
  'Text-SemiBold': require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf'),
  'Text-Bold': require('@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf'),
};

export const F = {
  score: 'Score-Black',
  scoreXB: 'Score-ExtraBold',
  scoreB: 'Score-Bold',
  text: 'Text-Medium',
  italic: 'Text-MediumItalic',
  semi: 'Text-SemiBold',
  bold: 'Text-Bold',
};

// Text and controls in a few strengths, so hierarchy comes from tone, not more
// colours. Two sets: white for dark skies (night, storms), deep navy for the
// pale daytime sky. The sky decides which one is in use (skyclock.ts).
export type Ink = {
  full: string; strong: string; soft: string; faint: string;
  onFull: string; // text on a solid button filled with `full`
  shade: string; // frosted pill or panel
  chip: string; // a selected chip
  line: string; // hairline dividers
  statusBar: 'light' | 'dark';
};
export const LIGHT_INK: Ink = {
  full: '#ffffff',
  strong: 'rgba(255,255,255,0.88)',
  soft: 'rgba(255,255,255,0.7)',
  faint: 'rgba(255,255,255,0.35)',
  onFull: '#14181f',
  shade: 'rgba(0,0,0,0.18)',
  chip: 'rgba(255,255,255,0.16)',
  line: 'rgba(255,255,255,0.2)',
  statusBar: 'light',
};
export const DARK_INK: Ink = {
  full: '#141c2b',
  strong: 'rgba(20,28,43,0.86)',
  soft: 'rgba(20,28,43,0.64)',
  faint: 'rgba(20,28,43,0.28)',
  onFull: '#ffffff',
  shade: 'rgba(255,255,255,0.34)',
  chip: 'rgba(255,255,255,0.4)',
  line: 'rgba(20,28,43,0.14)',
  statusBar: 'dark',
};

const InkContext = createContext<Ink>(LIGHT_INK);
export const InkProvider = InkContext.Provider;
export const useInk = () => useContext(InkContext);

/**
 * Styles that follow the current ink. Call the result as a hook inside the ink
 * provider, or use `.for(ink)` above it. Each ink's styles are built once.
 */
export function themed<T>(make: (ink: Ink) => T) {
  const cache = new Map<Ink, T>();
  const forInk = (ink: Ink): T => {
    let styles = cache.get(ink);
    if (!styles) {
      styles = make(ink);
      cache.set(ink, styles);
    }
    return styles;
  };
  return Object.assign(() => forInk(useInk()), { for: forInk });
}
