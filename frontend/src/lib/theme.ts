import { useContext } from 'react';
import { StyleSheet, useColorScheme, type TextStyle } from 'react-native';

import { resolveScheme } from './appearance';
import { AppearanceContext } from './appearanceContext';

/**
 * Grouped surfaces in the vein of Apple Fitness and Hevy: rounded cards on a soft gray (light) or near-black (dark)
 * ground, one blue accent, green for finished sets, a gold highlight for personal records.
 */
const light = {
  background: '#F2F3F7',
  surface: '#FFFFFF',
  /** Filled fields, tonal buttons, badges inside a card. */
  surfaceMuted: '#EEF0F4',
  /** Pop-up menus and their selected row. */
  menu: '#FFFFFF',
  menuSelected: '#EEF0F4',
  /** Round icon buttons in a title row, and their pressed or open state. */
  iconButton: '#FFFFFF',
  iconButtonActive: '#E3E6EB',
  text: '#0F1115',
  textMuted: '#5E6570',
  /** Placeholders and receding marks; large text or icons only. */
  textFaint: '#9098A3',
  rule: '#E3E6EB',
  ruleStrong: '#C9CED6',
  /** Accent for text, icons and outlines (5.3:1 or better on every light surface). */
  accent: '#1F55DB',
  /** Accent fill behind white text (buttons, the play badge); 5.2:1 with white. */
  accentFill: '#2563EB',
  accentPressed: '#1D4ED8',
  accentSoft: '#E6EEFF',
  onAccent: '#FFFFFF',
  success: '#1FA64B',
  successText: '#0E7A34',
  successSoft: '#E4F5E9',
  onSuccess: '#FFFFFF',
  highlight: '#FFF1B8',
  onHighlight: '#5C4300',
  record: '#B7791F',
  danger: '#C0271C',
  /** A solid red behind white text, e.g. a Delete button (5.9:1). */
  dangerFill: '#C0271C',
  dangerSoft: '#FDECEC',
  shadow: 'rgba(15, 17, 21, 0.06)',
};

const dark: typeof light = {
  background: '#0B0D10',
  surface: '#15181D',
  surfaceMuted: '#1F242B',
  menu: '#1F242B',
  menuSelected: '#2A3038',
  iconButton: '#1F242B',
  iconButtonActive: '#3A414B',
  text: '#F3F5F8',
  textMuted: '#9BA3AE',
  textFaint: '#6B7480',
  rule: '#262B33',
  ruleStrong: '#3A414B',
  accent: '#82A8FF',
  accentFill: '#3563E9',
  accentPressed: '#2F58D6',
  accentSoft: '#1A2440',
  onAccent: '#FFFFFF',
  success: '#30D158',
  successText: '#30D158',
  successSoft: '#13261A',
  onSuccess: '#0B0D10',
  highlight: '#3A3208',
  onHighlight: '#FFE066',
  record: '#FFD60A',
  danger: '#FF6B6B',
  // Darker than danger so white text on it stays readable (5.3:1).
  dangerFill: '#C9302C',
  dangerSoft: '#3A1E21',
  shadow: 'transparent',
};

export type Colors = typeof light;
export const palettes = { light, dark };

/** The scheme to draw with: the user's choice in Profile, or the phone's setting when they follow it. */
export function useScheme(): 'light' | 'dark' {
  const appearance = useContext(AppearanceContext);
  const system = useColorScheme();
  return appearance?.scheme ?? resolveScheme('system', system);
}

/** The palette for the current scheme. */
export function useColors(): Colors {
  return palettes[useScheme()];
}

/**
 * Styles that depend on the palette, built once per scheme:
 * `const useStyles = makeStyles((c) => ({ ... }))` at module level, then `const styles = useStyles()`.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: Colors) => T): () => T {
  const cache = new Map<Colors, T>();
  return function useStyles() {
    const c = useColors();
    let styles = cache.get(c);
    if (!styles) {
      styles = StyleSheet.create(factory(c));
      cache.set(c, styles);
    }
    return styles;
  };
}

/** A 4-point rhythm. Cards sit 16pt from the screen edge; titles and text blocks 20pt. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, gutter: 20, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { sm: 8, md: 12, lg: 16, card: 22, round: 999 };

/** Atkinson Hyperlegible Next: letterforms and digits built never to be mistaken for each other. */
export const fonts = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
};

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/** Type scale. Colors are applied where the style is used. */
export const type = {
  largeTitle: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  /** Column labels over a set table, e.g. SET · KG · REPS. */
  column: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.7, textTransform: 'uppercase' },
  numeral: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, fontVariant: tabular },
  stat: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, fontVariant: tabular },
  figure: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 50, letterSpacing: -0.8, fontVariant: tabular },
} satisfies Record<string, TextStyle>;
