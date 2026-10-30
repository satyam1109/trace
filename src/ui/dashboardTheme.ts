import { palettes, type Palette } from './theme';
export const dashboardColors = {
  bg: '#0D2339',
  surface: '#1A334A',
  subtle: '#2A4359',
  ink: '#F7F9FC',
  muted: '#B4C5D6',
  line: '#30495F',
  navy: '#0D2339',
  onNavy: '#F7F9FC',
  gold: '#E5BE76',
  onAccent: '#0D2339',
  goldInk: '#E5BE76',
  goldSoft: '#2B3C48',
  danger: '#FFB4AB',
  dangerSoft: '#492F3A',
  positive: '#BCD2B8',
  scrim: '#000000A8',
} satisfies Palette;
export function activityPalette(dark: boolean): Palette {
  return dark
    ? {
        ...palettes.dark,
        surface: '#192F44',
        bg: '#192F44',
        subtle: '#294158',
        line: '#354C60',
      }
    : {
        ...palettes.light,
        surface: '#FAF4E9',
        bg: '#FAF4E9',
        subtle: '#F0E8DC',
        line: '#E4DBCE',
      };
}
