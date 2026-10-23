import React from 'react';
export default function Svg(props: React.SVGProps<SVGSVGElement>) {
  return React.createElement('svg', props);
}
export function Circle({
  rotation,
  origin,
  ...props
}: React.SVGProps<SVGCircleElement> & { rotation?: number; origin?: string }) {
  return React.createElement('circle', {
    ...props,
    ...(rotation !== undefined
      ? {
          transform: `rotate(${rotation} ${(origin || '0,0').replace(
            ',',
            ' ',
          )})`,
        }
      : {}),
  });
}
export const Line = (props: React.SVGProps<SVGLineElement>) =>
  React.createElement('line', props);
export const Path = (props: React.SVGProps<SVGPathElement>) =>
  React.createElement('path', props);
export const Text = (props: React.SVGProps<SVGTextElement>) =>
  React.createElement('text', props);
