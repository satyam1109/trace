import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from './Svg';
import { formatMoney, type Currency } from '../finance/model';
import { Amount, Copy } from './components';
import { useTheme } from './theme';

const compactMoney = (v: number, currency: Currency) => {
  const mark = formatMoney(0, currency).replace(/[\d,.\s]/g, '');
  const amount = v / 100;
  return `${mark}${
    amount >= 1e7
      ? `${+(amount / 1e7).toFixed(1)}Cr`
      : amount >= 1e5
      ? `${+(amount / 1e5).toFixed(1)}L`
      : amount >= 1000
      ? `${+(amount / 1000).toFixed(1)}k`
      : Math.round(amount)
  }`;
};
export function Trend({
  values,
  labels,
  selected,
  onSelect,
  currency,
}: {
  values: number[];
  labels: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  currency: Currency;
}) {
  const { colors: c } = useTheme();
  const [width, setWidth] = useState(330);
  const handler = useRef(onSelect);
  handler.current = onSelect;
  const chartWidth = useRef(width);
  chartWidth.current = width;
  const count = useRef(values.length);
  count.current = values.length;
  const choose = (x: number) =>
    handler.current(
      Math.max(
        0,
        Math.min(
          count.current - 1,
          Math.round(
            ((((Number.isFinite(x) ? x : 0) / chartWidth.current) * 330 - 42) /
              280) *
              (count.current - 1),
          ),
        ),
      ),
    );
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  const surface = useRef<React.ComponentRef<typeof View>>(null);
  const origin = useRef<number | null>(null);
  const locate = useRef(choose);
  locate.current = (pageX: number) => {
    if (!Number.isFinite(pageX)) {
      chooseRef.current(0);
      return;
    }
    surface.current?.measureInWindow((x, _y, w) => {
      origin.current = x;
      if (w > 0) chartWidth.current = w;
      chooseRef.current(pageX - x);
    });
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderGrant: e => locate.current(e.nativeEvent.pageX),
        onPanResponderMove: e => {
          if (origin.current !== null)
            chooseRef.current(e.nativeEvent.pageX - origin.current);
        },
        onPanResponderRelease: e => {
          if (origin.current !== null)
            chooseRef.current(e.nativeEvent.pageX - origin.current);
          origin.current = null;
        },
      }),
    [],
  );
  const top = 16,
    base = 146,
    left = 42,
    right = 322,
    max = Math.max(100, ...values);
  const points = values.map((v, i) => [
    values.length === 1
      ? (left + right) / 2
      : left + (i / (values.length - 1)) * (right - left),
    base - (v / max) * (base - top),
  ]);
  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
    .join(' ');
  const selectedPoint = selected === null ? null : points[selected];
  return (
    <View {...pan.panHandlers}>
      <Pressable
        ref={surface}
        accessibilityRole="button"
        accessibilityLabel="Spending trend. Tap or drag to explore payments."
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        onPress={e => locate.current(e.nativeEvent.pageX)}
      >
        <Svg width="100%" height={174} viewBox="0 0 330 174">
          {[0, 0.5, 1].map(r => (
            <React.Fragment key={r}>
              <Line
                x1={left}
                x2={right}
                y1={top + (base - top) * r}
                y2={top + (base - top) * r}
                stroke={c.line}
                strokeWidth={0.6}
              />
              <SvgText
                x={0}
                y={top + (base - top) * r + 4}
                fill={c.muted}
                fontSize={10}
              >
                {compactMoney(max * (1 - r), currency)}
              </SvgText>
            </React.Fragment>
          ))}
          {path ? (
            <>
              <Path
                d={`${path} L${points[points.length - 1][0]},${base} L${
                  points[0][0]
                },${base}Z`}
                fill={c.gold}
                opacity={0.07}
              />
              <Path
                d={path}
                fill="none"
                stroke={c.gold}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          ) : null}
          {selectedPoint ? (
            <>
              <Line
                x1={selectedPoint[0]}
                x2={selectedPoint[0]}
                y1={top}
                y2={base}
                stroke={c.muted}
                strokeWidth={0.8}
                strokeDasharray="3 4"
              />
              <Circle
                cx={selectedPoint[0]}
                cy={selectedPoint[1]}
                r={5}
                stroke={c.bg}
                strokeWidth={2}
                fill={c.gold}
              />
            </>
          ) : values.length === 1 ? (
            <Circle cx={points[0][0]} cy={points[0][1]} r={4} fill={c.gold} />
          ) : null}
          {[
            ...new Set([
              0,
              Math.floor((values.length - 1) / 2),
              values.length - 1,
            ]),
          ]
            .filter(i => i >= 0)
            .map(i => (
              <SvgText
                key={i}
                x={points[i][0]}
                y={169}
                fontSize={10}
                fill={c.muted}
                textAnchor={
                  values.length === 1
                    ? 'middle'
                    : i === 0
                    ? 'start'
                    : i === values.length - 1
                    ? 'end'
                    : 'middle'
                }
              >
                {labels[i]}
              </SvgText>
            ))}
        </Svg>
      </Pressable>
    </View>
  );
}
export function Donut({
  items,
  currency,
  selected,
  onSelect,
}: {
  items: { id: string; amount: number; color: string; name: string }[];
  currency: Currency;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const surface = useRef<React.ComponentRef<typeof View>>(null);
  const total = items.reduce((s, i) => s + i.amount, 0),
    circ = 2 * Math.PI * 87;
  let offset = 0;
  return (
    <View style={styles.donut}>
      <Pressable
        ref={surface}
        accessibilityRole="button"
        accessibilityLabel="Spending by category. Tap a segment to explore."
        onPress={e => {
          const { pageX, pageY } = e.nativeEvent;
          if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) {
            if (items[0]) onSelect(items[0].id);
            return;
          }
          surface.current?.measureInWindow((left, top, w, h) => {
            const x = ((pageX - left) * 260) / w,
              y = ((pageY - top) * 260) / h;
            const distance = Math.hypot(x - 130, y - 130);
            if (distance < 64 || distance > 111) return;
            const angle =
              (Math.atan2(y - 130, x - 130) + Math.PI / 2 + Math.PI * 2) %
              (Math.PI * 2);
            let start = 0;
            for (const item of items) {
              start += (item.amount / total) * Math.PI * 2;
              if (angle < start) {
                onSelect(item.id);
                break;
              }
            }
          });
        }}
      >
        <Svg width={260} height={260} viewBox="0 0 260 260">
          {items.map(item => {
            const n = (item.amount / total) * circ,
              off = offset;
            offset += n;
            return (
              <Circle
                key={item.id}
                cx={130}
                cy={130}
                r={87}
                fill="none"
                stroke={item.color}
                strokeWidth={item.id === selected ? 31 : 26}
                strokeDasharray={`${Math.max(0.2, n - Math.min(4, n * 0.3))} ${
                  circ - Math.max(0.2, n - Math.min(4, n * 0.3))
                }`}
                strokeDashoffset={-off}
                rotation={-90}
                origin="130,130"
              />
            );
          })}
        </Svg>
      </Pressable>
      <View pointerEvents="none" style={styles.donutLabel}>
        <Amount
          value={total}
          currency={currency}
          size={29}
          weight="400"
          fit
          label="Category spending total"
        />
        <Copy muted size={12}>
          Recorded spending
        </Copy>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  donut: { alignSelf: 'center', width: 260, height: 260 },
  donutLabel: {
    position: 'absolute',
    left: 49,
    right: 49,
    top: 103,
    alignItems: 'center',
    gap: 4,
  },
});
