import DateField from './DateField';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from './Svg';
import { transactionTime } from '../types';
import {
  localDate,
  categoryTotals,
  comparison,
  currencyOf,
  formatMoney,
  methodLabels,
  monthDate,
  monthKey,
  monthLabel,
  monthPlan,
  shiftMonth,
  summary,
  sum,
} from '../finance/model';
import {
  Amount,
  Card,
  Chip,
  Copy,
  Empty,
  Progress,
  Section,
  Setting,
} from './components';
import { useTheme, ui } from './theme';
import { useFinance } from './store';
import type { HistoryFilter } from './Transactions';
export function Trend({
  values,
  onDay,
  labels,
}: {
  values: number[];
  labels?: string[];
  onDay?: (day: number) => void;
}) {
  const { colors: c } = useTheme();
  const [width, setWidth] = useState(330);
  const w = 330,
    h = 170,
    left = 36,
    right = 324,
    base = 142,
    top = 14,
    max = Math.max(1, ...values);
  const points = values.map((v, i) => [
      left +
        (values.length > 1 ? i / (values.length - 1) : 0.5) * (right - left),
      base - (v / max) * (base - top),
    ]),
    path = points
      .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
      .join(' ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Spending trend. Tap a day to view its transactions."
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      onPress={e =>
        onDay?.(
          Math.max(
            1,
            Math.min(
              values.length,
              Math.round(
                (((e.nativeEvent.locationX / width) * w - left) /
                  (right - left)) *
                  (values.length - 1),
              ) + 1,
            ),
          ),
        )
      }
    >
      <Svg width="100%" height={170} viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.5, 1].map(r => (
          <React.Fragment key={r}>
            <Line
              x1={left}
              x2={right}
              y1={top + (base - top) * r}
              y2={top + (base - top) * r}
              stroke={c.line}
              strokeWidth={0.7}
            />
            <SvgText
              x={0}
              y={top + (base - top) * r + 4}
              fill={c.muted}
              fontSize={10}
            >
              {Math.round((max * (1 - r)) / 100)}
            </SvgText>
          </React.Fragment>
        ))}
        <Path
          d={path + ` L${right},${base} L${left},${base}Z`}
          fill={c.gold}
          opacity={0.08}
        />
        <Path
          d={path}
          fill="none"
          stroke={c.gold}
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {values.length === 1 ? (
          <Circle cx={points[0][0]} cy={points[0][1]} r={4} fill={c.gold} />
        ) : null}
        {Array.from(
          new Set([1, Math.ceil(values.length / 2), values.length]),
        ).map((d, i) => (
          <SvgText
            key={i}
            x={
              values.length === 1
                ? (left + right) / 2
                : left + ((d - 1) / (values.length - 1)) * (right - left)
            }
            y={165}
            textAnchor={
              values.length === 1
                ? 'middle'
                : d === values.length
                ? 'end'
                : 'start'
            }
            fill={c.muted}
            fontSize={10}
          >
            {labels?.[d - 1] || d}
          </SvgText>
        ))}
      </Svg>
    </Pressable>
  );
}
function Bars({
  values,
  labels,
  colors,
}: {
  values: number[];
  labels: string[];
  colors?: string[];
}) {
  const { colors: c } = useTheme();
  const max = Math.max(1, ...values);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={values.length > 6}>
      <View
        style={{
          width: Math.max(310, values.length * 56),
          height: 200,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 12,
          paddingTop: 30,
        }}
      >
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 7 }}>
            <Copy muted size={10}>
              {formatMoney(v).replace('₹', '')}
            </Copy>
            <View
              accessibilityLabel={`${labels[i]}: ${v / 100}`}
              style={{
                height: Math.max(2, (v / max) * 132),
                width: '72%',
                backgroundColor:
                  colors?.[i] || (i === values.length - 1 ? c.gold : '#6F859C'),
                borderRadius: 7,
              }}
            />
            <Copy muted size={11}>
              {labels[i]}
            </Copy>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
function Donut({
  items,
}: {
  items: { amount: number; color: string; name: string }[];
}) {
  const { colors: c } = useTheme();
  const total = items.reduce((s, i) => s + i.amount, 0),
    circ = 2 * Math.PI * 47;
  let offset = 0;
  return (
    <View
      accessible
      accessibilityLabel={items
        .map(v => `${v.name}: ${Math.round((v.amount / (total || 1)) * 100)}%`)
        .join(', ')}
      style={{ alignItems: 'center' }}
    >
      <Svg width={150} height={150} viewBox="0 0 150 150">
        {items
          .filter(i => i.amount > 0)
          .map((it, i) => {
            const n = (it.amount / total) * circ,
              off = offset;
            offset += n;
            return (
              <Circle
                key={i}
                cx={75}
                cy={75}
                r={47}
                fill="none"
                stroke={it.color}
                strokeWidth={17}
                strokeDasharray={`${Math.max(0, n - 3)} ${
                  circ - Math.max(0, n - 3)
                }`}
                strokeDashoffset={-off}
                rotation={-90}
                origin="75,75"
              />
            );
          })}
        <SvgText
          x={75}
          y={76}
          fontSize={24}
          fontWeight="700"
          textAnchor="middle"
          fill={c.ink}
        >
          {Math.round(((items[0]?.amount || 0) / (total || 1)) * 100)}%
        </SvgText>
        <SvgText x={75} y={94} fontSize={10} textAnchor="middle" fill={c.muted}>
          largest category
        </SvgText>
      </Svg>
    </View>
  );
}
export function Analytics({
  month,
  onHistory,
}: {
  month: string;
  onHistory: (filter?: HistoryFilter) => void;
}) {
  const { transactions, finance, preferences } = useFinance(),
    { colors: c } = useTheme();
  const [tab, setTab] = useState('spending'),
    [period, setPeriod] = useState('daily'),
    [custom, setCustom] = useState(false),
    [from, setFrom] = useState(month + '-01'),
    [to, setTo] = useState(
      month === monthKey()
        ? new Date().getFullYear() +
            '-' +
            String(new Date().getMonth() + 1).padStart(2, '0') +
            '-' +
            String(new Date().getDate()).padStart(2, '0')
        : month +
            '-' +
            new Date(
              monthDate(month).getFullYear(),
              monthDate(month).getMonth() + 1,
              0,
            ).getDate(),
    );
  const currency = preferences.currency,
    monthly = summary(transactions, month, currency);
  const rangeValid =
    /^\d{4}-\d{2}-\d{2}$/.test(from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(to) &&
    from <= to;
  const rows =
    custom && rangeValid
      ? transactions.filter(
          t =>
            currencyOf(t) === currency &&
            (!from ||
              transactionTime(t) >= new Date(from + 'T00:00:00').getTime()) &&
            (!to ||
              transactionTime(t) <
                new Date(to + 'T00:00:00').getTime() + 86400000),
        )
      : custom
      ? []
      : monthly.rows;
  const expenses = rows.filter(t => t.category === 'expense'),
    income = rows.filter(t => t.category === 'income'),
    spent = sum(expenses),
    earned = sum(income),
    plan = monthPlan(finance, month, currency),
    cats = categoryTotals(expenses, finance),
    compare = comparison(transactions, month, currency);
  const days =
    month === monthKey()
      ? new Date().getDate()
      : new Date(
          monthDate(month).getFullYear(),
          monthDate(month).getMonth() + 1,
          0,
        ).getDate();
  const dates: string[] = [];
  const start = custom ? new Date(from + 'T00:00:00') : monthDate(month);
  const end = custom
    ? new Date(to + 'T00:00:00')
    : new Date(
        monthDate(month).getFullYear(),
        monthDate(month).getMonth(),
        days,
      );
  if (rangeValid)
    for (
      const d = new Date(start);
      d <= end && dates.length < 367;
      d.setDate(d.getDate() + 1)
    )
      dates.push(localDate(d));
  const tooLong = custom && dates.length > 366;
  const values = dates
    .slice(0, 366)
    .map(date =>
      sum(
        expenses.filter(t => localDate(new Date(transactionTime(t))) === date),
      ),
    );
  const weekValues = Array.from(
    { length: Math.ceil(values.length / 7) },
    (_, i) => values.slice(i * 7, i * 7 + 7).reduce((total, v) => total + v, 0),
  );
  const monthBuckets = custom
    ? Array.from(new Set(dates.map(d => d.slice(0, 7))))
    : Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const monthlyValues = monthBuckets.map(m =>
    sum(
      (custom
        ? expenses
        : transactions.filter(
            t => t.category === 'expense' && currencyOf(t) === currency,
          )
      ).filter(t => monthKey(transactionTime(t)) === m),
    ),
  );
  const averageDays = Math.max(1, dates.length);
  const plotLabel = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  return (
    <>
      <View style={ui.wrap}>
        {['spending', 'cash flow', 'compare'].map(t => (
          <Chip
            key={t}
            label={t[0].toUpperCase() + t.slice(1)}
            selected={tab === t}
            onPress={() => setTab(t)}
          />
        ))}
      </View>
      {tab !== 'compare' ? (
        <>
          <Chip
            label={custom ? 'Custom date range' : monthLabel(month)}
            onPress={() => setCustom(!custom)}
          />
          {custom ? (
            <Card>
              <DateField
                label="Analytics from date (YYYY-MM-DD)"
                value={from}
                onChangeText={setFrom}
              />
              <DateField
                label="Analytics to date (YYYY-MM-DD)"
                value={to}
                onChangeText={setTo}
              />
              {!rangeValid || tooLong ? (
                <Copy color={c.danger}>
                  Choose valid dates in order, covering no more than 366 days.
                </Copy>
              ) : null}
              <Copy size={12} muted>
                Charts and totals use the selected dates. Choose up to one year
                for a readable daily breakdown.
              </Copy>
            </Card>
          ) : null}
        </>
      ) : null}
      {!rows.length && tab !== 'compare' ? (
        <Empty
          title="Insights grow with your history"
          copy="Record expenses and income to see your spending patterns."
          icon="activity"
        />
      ) : null}
      {tab === 'spending' && rows.length && !tooLong ? (
        <>
          <Card>
            <Copy size={11} muted>
              RECORDED SPENDING{custom ? ' · SELECTED RANGE' : ''}
            </Copy>
            <Amount
              value={spent}
              currency={currency}
              size={34}
              label="Spending in selected range"
            />
            <Copy muted size={12}>
              {custom ? from + ' – ' + to : monthLabel(month)} ·{' '}
              {period === 'monthly'
                ? 'six monthly totals'
                : period[0].toUpperCase() + period.slice(1) + ' spending'}
            </Copy>
            {period === 'daily' ? (
              <Trend
                values={values}
                labels={custom ? dates.map(plotLabel) : undefined}
                onDay={d => {
                  const date = dates[d - 1];
                  onHistory({ from: date, to: date, type: 'expense' });
                }}
              />
            ) : period === 'weekly' ? (
              <Bars
                values={weekValues}
                labels={weekValues.map((_, i) =>
                  custom
                    ? plotLabel(dates[i * 7])
                    : `${i * 7 + 1}–${Math.min(days, i * 7 + 7)}`,
                )}
              />
            ) : (
              <Bars
                values={monthlyValues}
                labels={monthlyValues.map((_, i) =>
                  monthDate(monthBuckets[i]).toLocaleDateString('en-IN', {
                    month: 'short',
                  }),
                )}
              />
            )}
            <View style={ui.wrap}>
              {['daily', 'weekly', 'monthly'].map(p => (
                <Chip
                  key={p}
                  label={p[0].toUpperCase() + p.slice(1)}
                  selected={period === p}
                  onPress={() => setPeriod(p)}
                />
              ))}
            </View>
            <Copy muted size={11}>
              Current-month totals include elapsed dates only. Tap the daily
              trend to view its payments.
            </Copy>
          </Card>
          <Section title="Where it went" />
          {spent > 0 ? (
            <Card>
              <Donut items={cats} />
              {cats
                .filter(v => v.amount > 0)
                .map(cat => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${cat.name} spending`}
                    key={cat.id}
                    onPress={() =>
                      onHistory({
                        category: cat.id,
                        type: 'expense',
                        ...(custom ? { from, to } : {}),
                      })
                    }
                    style={{ gap: 9, paddingVertical: 7 }}
                  >
                    <View style={ui.spread}>
                      <Copy bold>{cat.name}</Copy>
                      <Copy bold>{formatMoney(cat.amount, currency)}</Copy>
                    </View>
                    <Progress
                      value={(cat.amount / spent) * 100}
                      color={cat.color}
                    />
                    <Copy size={11} muted>
                      {Math.round((cat.amount / spent) * 100)}% of recorded
                      expenses
                    </Copy>
                  </Pressable>
                ))}
            </Card>
          ) : (
            <Copy muted>No consumption expenses in this range.</Copy>
          )}
          <View style={ui.row}>
            <Card style={ui.fill}>
              <Copy muted size={11}>
                Daily average
              </Copy>
              <Amount
                value={Math.round(spent / Math.max(1, averageDays))}
                currency={currency}
                size={23}
              />
            </Card>
            <Card style={ui.fill}>
              <Copy muted size={11}>
                Highest day
              </Copy>
              <Copy bold>
                {expenses.length && dates.length
                  ? plotLabel(dates[values.indexOf(Math.max(...values))])
                  : '—'}
              </Copy>
              <Amount
                value={Math.max(0, ...values)}
                currency={currency}
                size={20}
              />
            </Card>
          </View>
        </>
      ) : null}
      {tab === 'cash flow' ? (
        <>
          <View style={ui.row}>
            <Card style={ui.fill}>
              <Copy muted size={11}>
                Income
              </Copy>
              <Amount value={earned} currency={currency} size={25} />
            </Card>
            <Card style={ui.fill}>
              <Copy muted size={11}>
                Expenses
              </Copy>
              <Amount value={spent} currency={currency} size={25} />
            </Card>
          </View>
          <Card>
            <Section title="Income vs expenses" />
            <Bars
              values={[earned, spent]}
              labels={['Income', 'Expenses']}
              colors={['#6F859C', c.gold]}
            />
            {income.length ? (
              <>
                <Amount value={earned - spent} currency={currency} size={28} />
                <Copy muted size={12}>
                  Recorded surplus · excludes lending, transfers and card-bill
                  repayments.
                </Copy>
              </>
            ) : (
              <Copy muted size={12}>
                Income has not been recorded for this period.
              </Copy>
            )}
          </Card>
          <Card>
            <Section title="Budget vs actual" />
            <Copy muted size={12}>
              {monthLabel(month)} · Calendar-month expenses
            </Copy>
            {categoryTotals(monthly.expenses, finance)
              .filter(cat => cat.amount > 0 || plan.limits[cat.id])
              .map(cat => (
                <View key={cat.id} style={{ gap: 8 }}>
                  <View style={ui.spread}>
                    <Copy>{cat.name}</Copy>
                    <Copy muted size={11}>
                      {formatMoney(cat.amount, currency)} /{' '}
                      {plan.limits[cat.id]
                        ? formatMoney(plan.limits[cat.id], currency)
                        : 'No limit'}
                    </Copy>
                  </View>
                  <Progress
                    value={
                      plan.limits[cat.id]
                        ? (cat.amount / plan.limits[cat.id]) * 100
                        : 0
                    }
                    color={
                      cat.amount > plan.limits[cat.id] ? c.danger : cat.color
                    }
                  />
                </View>
              ))}
            <Copy muted size={11}>
              Filled = spending · track = monthly category limit.
            </Copy>
          </Card>
          <Section title="Payment methods" />
          {Object.entries(methodLabels).map(([method, label]) => {
            const amount = sum(expenses.filter(t => t.method === method));
            return (
              <Setting
                key={method}
                title={label}
                subtitle={formatMoney(amount, currency)}
                onPress={() =>
                  onHistory({
                    method,
                    type: 'expense',
                    ...(custom ? { from, to } : {}),
                  })
                }
                icon={
                  method.includes('CARD')
                    ? 'card'
                    : method === 'CASH'
                    ? 'wallet'
                    : 'bank'
                }
              />
            );
          })}
        </>
      ) : null}
      {tab === 'compare' ? (
        <>
          <Copy muted>
            {monthLabel(month)} vs {monthLabel(compare.previousMonth)}
          </Copy>
          {compare.hasPrevious ? (
            <>
              <Card>
                <Amount
                  value={Math.abs(compare.delta)}
                  currency={currency}
                  size={34}
                />
                <Copy bold color={c.goldInk}>
                  {compare.delta >= 0 ? 'more' : 'less'} spending
                  {compare.percent !== null
                    ? ` · ${Math.abs(compare.percent)}%`
                    : ''}
                </Copy>
                <Bars
                  values={[compare.previous, compare.current]}
                  labels={[
                    monthLabel(compare.previousMonth, true),
                    monthLabel(month, true),
                  ]}
                />
                <Copy muted size={12}>
                  Compares days 1–{compare.days} in both months. Lending and
                  transfers are excluded.
                </Copy>
              </Card>
              <Section title="Category changes" />
              {allCategoriesForCompare(finance).map(cat => {
                const n = transactions.filter(
                  t =>
                    currencyOf(t) === currency &&
                    t.category === 'expense' &&
                    t.expenseCategory === cat.id &&
                    new Date(transactionTime(t)).getDate() <= compare.days,
                );
                const current = sum(
                    n.filter(t => monthKey(transactionTime(t)) === month),
                  ),
                  previous = sum(
                    n.filter(
                      t =>
                        monthKey(transactionTime(t)) === compare.previousMonth,
                    ),
                  );
                return current || previous ? (
                  <Setting
                    key={cat.id}
                    title={cat.name}
                    subtitle={`${formatMoney(
                      current,
                      currency,
                    )} vs ${formatMoney(previous, currency)}`}
                    value={`${current - previous >= 0 ? '+' : '−'}${formatMoney(
                      Math.abs(current - previous),
                      currency,
                    )}`}
                    onPress={() =>
                      onHistory({ category: cat.id, type: 'expense' })
                    }
                  />
                ) : null;
              })}
            </>
          ) : (
            <Empty
              title="A comparison needs two months"
              copy="Once both periods contain expenses, Trace will compare matching dates."
              icon="activity"
            />
          )}
        </>
      ) : null}
    </>
  );
}
const allCategoriesForCompare = (
  finance: import('../finance/model').FinanceState,
) => categoryTotals([], finance);
