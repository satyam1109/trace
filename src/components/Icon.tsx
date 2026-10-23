import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { paths } from './iconPaths';
import { colors } from '../theme';

export function Icon({
  name,
  size = 20,
  color = colors.primary,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name] || paths.wallet}
        stroke={color}
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function Brand({
  size = 36,
  color = colors.accent,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M8 12h25 M6 20h19 M4 28h13"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <Path
        d="m24 23 5 5 9-11"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
