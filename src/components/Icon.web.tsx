import React from 'react';
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
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d={paths[name] || paths.wallet}
        stroke={color}
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M8 12h25 M6 20h19 M4 28h13"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="m24 23 5 5 9-11"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
