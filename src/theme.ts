// Look and feel in one place: the sky colours, the typefaces, the type scale.

// Each score gets a sky: [overhead, horizon]. Deeper overhead, paler toward the
// horizon, like the real thing. 1 is a low storm ceiling, 5 is concrete grey,
// 10 is a clear deep blue. White text stays readable on every stop.
export const SKY: [string, string][] = [
  ['#1d1c24', '#36343f'], // placeholder for index 0 (never shown)
  ['#1d1c24', '#36343f'], // 1
  ['#24232c', '#3d3c48'], // 2
  ['#2c2d36', '#454753'], // 3
  ['#353944', '#4e5361'], // 4
  ['#3d4450', '#555d69'], // 5
  ['#334e58', '#4a6570'], // 6
  ['#1f5753', '#346a67'], // 7
  ['#12566a', '#266b81'], // 8
  ['#0f5287', '#266799'], // 9
  ['#0b4a9b', '#2462ad'], // 10
];
export const skyFor = (score: number) => SKY[Math.max(1, Math.min(10, Math.round(score)))];

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

// White at a few strengths, so hierarchy comes from tone, not more colours.
export const INK = {
  full: '#ffffff',
  strong: 'rgba(255,255,255,0.88)',
  soft: 'rgba(255,255,255,0.7)',
  faint: 'rgba(255,255,255,0.35)',
  onWhite: '#14181f',
  shade: 'rgba(0,0,0,0.18)',
};
