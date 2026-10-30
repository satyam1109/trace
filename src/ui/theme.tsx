import React, { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';
export const palettes = {
  light: {
    bg: '#FAF9F6',
    surface: '#F0EFEB',
    subtle: '#E9E8E3',
    ink: '#202329',
    muted: '#6E7279',
    line: '#E6E5E0',
    navy: '#252A31',
    onNavy: '#FFFFFF',
    gold: '#252A31',
    onAccent: '#FFFFFF',
    goldInk: '#343B45',
    goldSoft: '#E9EDF4',
    danger: '#A54238',
    dangerSoft: '#F8E7E3',
    positive: '#365B63',
    scrim: '#0D152680',
  },
  dark: {
    bg: '#17191C',
    surface: '#25282D',
    subtle: '#30343A',
    ink: '#F1F0EC',
    muted: '#A5A9AF',
    line: '#35383D',
    navy: '#20252D',
    onNavy: '#F1F0EC',
    gold: '#E3E7EE',
    onAccent: '#20252D',
    goldInk: '#E3E7EE',
    goldSoft: '#262E3B',
    danger: '#FFB4AB',
    dangerSoft: '#4B2F33',
    positive: '#A9D0D5',
    scrim: '#000000A8',
  },
};
export type Palette = typeof palettes.light;
export const ThemeContext = createContext<{ colors: Palette; dark: boolean }>({
  colors: palettes.light,
  dark: false,
});
export const useTheme = () => useContext(ThemeContext);
export const ui = StyleSheet.create({
  fill: { flex: 1 },
  page: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  card: { padding: 18, borderRadius: 22, borderWidth: 1, gap: 14 },
  text: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  heading: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  amount: {
    fontSize: 44,
    lineHeight: 54,
    fontWeight: '700',
    letterSpacing: -1.3,
    fontVariant: ['tabular-nums'],
  },
  field: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 52,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    minHeight: 50,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  buttonText: { fontWeight: '700', fontSize: 15, lineHeight: 22 },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  iconBox: {
    height: 42,
    width: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 20,
    minHeight: 40,
    justifyContent: 'center',
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: 12,
  },
  modalScrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    maxHeight: '94%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  formBody: { padding: 20, paddingTop: 12, paddingBottom: 32, gap: 18 },
  error: { padding: 14, borderRadius: 14 },
});
export function Theme({
  dark,
  children,
}: {
  dark: boolean;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider
      value={{ colors: dark ? palettes.dark : palettes.light, dark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
