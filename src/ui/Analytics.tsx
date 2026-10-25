import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../components/Icon';
import {
  analyticsCategories,
  categoryChanges,
  comparePeriods,
  monthRange,
  periodSummary,
  rangeDays,
  spendingBuckets,
  type DateRange,
} from '../finance/analytics';
import {
  formatMoney,
  localDate,
  methodLabels,
  monthKey,
  monthLabel,
  monthPlan,
  shiftMonth,
  sum,
  type Currency,
} from '../finance/model';
import {
  Amount,
  Button,
  Copy,
  Empty,
  FormSheet,
  Progress,
  Sheet,
} from './components';
import { ThemeContext, ui } from './theme';
import { dashboardColors as c } from './dashboardTheme';
import { GlassMotionContext, GlassPressable } from './GlassPressable';
import { useFinance } from './store';
import { useToday } from './useToday';
import { MonthPicker } from './MonthPicker';
import DateField from './DateField';
import { Donut, Trend } from './AnalyticsCharts';
import type { HistoryFilter } from './Transactions';

type Tab = 'Overview' | 'Categories' | 'Compare';
type Group = 'Daily' | 'Weekly' | 'Monthly';
const shortDate = (value: string) =>
  new Date(value + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
const rangeLabel = (r: DateRange) =>
  `${shortDate(r.from)}–${shortDate(r.to)} ${r.to.slice(0, 4)}`;
const fullRangeLabel = (r: DateRange) =>
  `${r.from.slice(-2).replace(/^0/, '')}–${r.to
    .slice(-2)
    .replace(/^0/, '')} ${new Date(r.to + 'T00:00:00').toLocaleDateString(
    'en-IN',
    { month: 'short', year: 'numeric' },
  )}`;
const categoryColors: Record<string, string> = {
  food: '#E5BE76',
  groceries: '#B9ABE5',
  clothes: '#9FC3EC',
  travel: '#D6C19B',
  other: '#88AFBA',
  uncategorised: '#8FA1B8',
  bills: '#A7C7C5',
  health: '#D8AEB5',
  entertainment: '#BBAACC',
};
function MotionPanel({
  children,
  reduceMotion,
  identity,
}: {
  children: React.ReactNode;
  reduceMotion: boolean;
  identity: string;
}) {
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    opacity.stopAnimation();
    opacity.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion)
      Animated.timing(opacity, {
        toValue: 1,
        duration: 190,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    return () => opacity.stopAnimation();
  }, [identity, opacity, reduceMotion]);
  return (
    <Animated.View
      style={[
        s.stack,
        {
          opacity,
          transform: [
            {
              translateY: opacity.interpolate({
                inputRange: [0, 1],
                outputRange: [5, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.disclosure}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(v => !v)}
        style={s.disclosureHeading}
      >
        <Copy bold size={15}>
          {title}
        </Copy>
        <View style={open ? s.rotate : undefined}>
          <Icon name="down" color={c.muted} size={18} />
        </View>
      </Pressable>
      {open ? <View style={s.disclosureBody}>{children}</View> : null}
    </View>
  );
}
function MoneyBar({
  label,
  value,
  max,
  currency,
  color,
  note,
  onPress,
}: {
  label: string;
  value: number;
  max: number | null;
  currency: Currency;
  color: string;
  note?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={s.spread}>
        <Copy size={14} style={ui.fill}>
          {label}
        </Copy>
        <Amount value={value} currency={currency} size={20} fit />
      </View>
      {max !== null ? (
        <Progress
          value={max ? (value / max) * 100 : value > 0 ? 100 : 0}
          color={color}
        />
      ) : null}
      {note ? (
        <Copy muted size={11}>
          {note}
        </Copy>
      ) : null}
    </>
  );
  return onPress ? (
    <GlassPressable
      label={`View ${label} payments`}
      onPress={onPress}
      radius={15}
      contentStyle={s.moneyBar}
    >
      {body}
    </GlassPressable>
  ) : (
    <View style={s.moneyBar}>{body}</View>
  );
}
function RangeEditor({
  range,
  onApply,
  onClose,
}: {
  range: DateRange;
  onApply: (range: DateRange | null) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(range.from),
    [to, setTo] = useState(range.to);
  return (
    <FormSheet
      title="Date range"
      saveLabel="Apply date range"
      onClose={onClose}
      onSave={async () => {
        const days = rangeDays({ from, to });
        if (!days.length || days.length > 366 || to > localDate())
          throw Error(
            'Choose valid dates in order, no later than today, covering up to 366 days.',
          );
        onApply({ from, to });
      }}
    >
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
      <Copy muted size={12}>
        Overview and Categories use these dates. Compare keeps its own month
        selectors.
      </Copy>
      <Button
        label="Reset to selected month"
        secondary
        onPress={() => {
          onApply(null);
          onClose();
        }}
      />
    </FormSheet>
  );
}
function deltaText(delta: number, base: number, currency: Currency) {
  const percentage = base ? Math.abs((delta / base) * 100) : null;
  const percent =
    percentage === null
      ? ''
      : ` · ${
          percentage > 0 && percentage < 0.1 ? '<0.1' : +percentage.toFixed(1)
        }%`;
  return delta === 0
    ? 'Same recorded spending'
    : `${formatMoney(Math.abs(delta), currency)} ${
        delta > 0 ? 'higher' : 'lower'
      }${percent}`;
}

export function Analytics({
  month,
  onMonthChange,
  onHistory,
  reduceMotion = true,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  onHistory: (filter?: HistoryFilter) => void;
  reduceMotion?: boolean;
}) {
  const { transactions, finance, preferences } = useFinance();
  const today = useToday(),
    currency = preferences.currency;
  const [tab, setTab] = useState<Tab>('Overview'),
    [group, setGroup] = useState<Group>('Daily');
  const [customRange, setCustomRange] = useState<DateRange | null>(null),
    [rangeOpen, setRangeOpen] = useState(false);
  const [manualBaseline, setManualBaseline] = useState<string | null>(null),
    [picker, setPicker] = useState<'target' | 'baseline' | null>(null);
  const [selected, setSelected] = useState<number | null>(null),
    [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    category: string;
    compare?: boolean;
  } | null>(null);
  useEffect(() => {
    setCustomRange(null);
    setSelected(null);
  }, [month]);
  const range = useMemo(
    () => customRange || monthRange(month, today),
    [customRange, month, today],
  );
  const data = useMemo(
    () => periodSummary(transactions, range, currency),
    [transactions, range, currency],
  );
  const dates = useMemo(() => rangeDays(range), [range]);
  const daily = useMemo(
    () => spendingBuckets(data.expenses, dates),
    [data.expenses, dates],
  );
  const cats = useMemo(
    () =>
      analyticsCategories(data.expenses, finance).map(cat => ({
        ...cat,
        color: categoryColors[cat.id] || cat.color,
      })),
    [data.expenses, finance],
  );
  const lastCompletedMonth = shiftMonth(monthKey(today), -1);
  const defaultBaseline = shiftMonth(month, -1);
  const baseline =
    manualBaseline &&
    manualBaseline !== month &&
    manualBaseline <= lastCompletedMonth
      ? manualBaseline
      : defaultBaseline > lastCompletedMonth
      ? lastCompletedMonth
      : defaultBaseline;
  const targetRange = useMemo(
    () => monthRange(month, today, 'day-number'),
    [month, today],
  );
  const referenceRange = useMemo(
    () => monthRange(baseline, today, 'full'),
    [baseline, today],
  );
  const overviewReferenceRange = useMemo(
    () => monthRange(shiftMonth(month, -1), today, 'full'),
    [month, today],
  );
  const comparison = useMemo(
    () => comparePeriods(transactions, targetRange, referenceRange, currency),
    [transactions, targetRange, referenceRange, currency],
  );
  const overviewComparison = useMemo(
    () => comparePeriods(transactions, range, overviewReferenceRange, currency),
    [transactions, range, overviewReferenceRange, currency],
  );
  const changes = useMemo(
    () =>
      categoryChanges(
        comparison.target.expenses,
        comparison.reference.expenses,
        finance,
      ),
    [comparison, finance],
  );
  const plan = monthPlan(finance, month, currency);
  const activeCategory =
    cats.find(cat => cat.id === selectedCategory) || cats[0];
  const buckets = useMemo(() => {
    if (group === 'Daily')
      return dates.map((date, i) => ({
        label: shortDate(date),
        value: daily[i],
        range: { from: date, to: date },
      }));
    if (group === 'Weekly')
      return Array.from({ length: Math.ceil(dates.length / 7) }, (_, i) => {
        const from = dates[i * 7],
          to = dates[Math.min(dates.length - 1, i * 7 + 6)];
        return {
          label: `${Number(from.slice(-2))}–${Number(to.slice(-2))}`,
          value: daily.slice(i * 7, i * 7 + 7).reduce((a, b) => a + b, 0),
          range: { from, to },
        };
      });
    const months = customRange
      ? [...new Set(dates.map(d => d.slice(0, 7)))]
      : Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
    return months.map(m => {
      const r = customRange
        ? {
            from: m === range.from.slice(0, 7) ? range.from : m + '-01',
            to:
              m === range.to.slice(0, 7)
                ? range.to
                : monthRange(m, today, 'full').to,
          }
        : monthRange(m, today);
      return {
        label: monthLabel(m, true).split(' ')[0],
        value: periodSummary(transactions, r, currency).spent,
        range: r,
      };
    });
  }, [
    group,
    dates,
    daily,
    customRange,
    month,
    range,
    today,
    transactions,
    currency,
  ]);
  const selectedBucket = selected === null ? null : buckets[selected];
  const history = (r: DateRange, extra: HistoryFilter = {}) =>
    onHistory({ ...r, type: 'expense', ...extra });
  const largest = cats[0],
    average = dates.length ? Math.round(data.spent / dates.length) : 0;
  const hasCompare = comparison.hasCurrent && comparison.hasPrevious;
  const decrease = changes.find(cat => cat.delta < 0),
    increase = changes.find(cat => cat.delta > 0);
  const takeaway =
    decrease && increase
      ? `${decrease.name} fell by ${formatMoney(
          -decrease.delta,
          currency,
        )}, while ${increase.name} rose by ${formatMoney(
          increase.delta,
          currency,
        )}.`
      : changes[0]?.delta
      ? `${changes[0].name} had the largest ${
          changes[0].delta > 0 ? 'increase' : 'decrease'
        }: ${formatMoney(Math.abs(changes[0].delta), currency)}.`
      : 'Recorded category totals are unchanged.';
  const detailRange = detail?.compare ? comparison.target.range : range;
  const detailRows = (
    detail?.compare ? comparison.target.expenses : data.expenses
  ).filter(t => t.expenseCategory === detail?.category);
  const detailCategory = [...cats, ...changes].find(
    cat => cat.id === detail?.category,
  );
  const vendors = useMemo(() => {
    const map = new Map<
      string,
      { name: string; amount: number; count: number }
    >();
    for (const tx of detailRows) {
      const name = tx.recipient.trim() || 'Unknown recipient',
        key = name.replace(/\s+/g, ' ').toLowerCase();
      const old = map.get(key);
      if (old) {
        old.amount += tx.amountPaise;
        old.count++;
      } else map.set(key, { name, amount: tx.amountPaise, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [detailRows]);
  const openHistory = (r: DateRange, extra: HistoryFilter = {}) => {
    setDetail(null);
    history(r, extra);
  };
  return (
    <ThemeContext.Provider value={{ colors: c, dark: true }}>
      <GlassMotionContext.Provider value={reduceMotion}>
        <View style={s.stack} testID="analytics-screen">
          <View style={s.tabs} accessibilityRole="tablist">
            {(['Overview', 'Categories', 'Compare'] as Tab[]).map(label => (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: tab === label }}
                aria-selected={tab === label}
                onPress={() => {
                  setTab(label);
                  setSelected(null);
                }}
                style={[s.tab, tab === label && s.activeTab]}
              >
                <Copy
                  size={13}
                  bold={tab === label}
                  color={tab === label ? c.ink : c.muted}
                >
                  {label}
                </Copy>
              </Pressable>
            ))}
          </View>
          {tab !== 'Compare' ? (
            <View style={s.spread}>
              <Copy muted size={12}>
                {fullRangeLabel(range)}
              </Copy>
              <GlassPressable
                label="Choose analytics date range"
                onPress={() => setRangeOpen(true)}
                contentStyle={s.rangeButton}
                radius={16}
              >
                <Copy size={12} color={c.gold}>
                  {customRange ? 'Custom range' : 'Date range'}
                </Copy>
                <Icon name="down" size={14} color={c.gold} />
              </GlassPressable>
            </View>
          ) : null}
          <MotionPanel identity={`${tab}-${month}`} reduceMotion={reduceMotion}>
            {tab === 'Overview' ? (
              <>
                <View style={s.hero}>
                  <Copy size={11} color={c.muted} bold style={s.eyebrow}>
                    {customRange ? 'SPENT IN THIS RANGE' : 'SPENT THIS MONTH'}
                  </Copy>
                  <Amount
                    value={data.spent}
                    currency={currency}
                    size={52}
                    fit
                    label="Spending in selected range"
                  />
                  {!customRange &&
                  overviewComparison.hasCurrent &&
                  overviewComparison.hasPrevious ? (
                    <View style={s.spread}>
                      <View style={s.badge}>
                        <Copy size={12} bold color={c.gold}>
                          {deltaText(
                            overviewComparison.delta,
                            overviewComparison.previous,
                            currency,
                          )}
                        </Copy>
                      </View>
                      <Copy muted size={11}>
                        vs full {monthLabel(shiftMonth(month, -1), true)}
                      </Copy>
                    </View>
                  ) : (
                    <Copy muted size={12}>
                      {data.expenses.length
                        ? `${data.expenses.length} recorded payments`
                        : 'No expenses recorded in this period'}
                    </Copy>
                  )}
                </View>
                {data.expenses.length ? (
                  <>
                    <View style={s.card} testID="spending-trend-card">
                      <Copy bold size={17}>
                        Spending over time
                      </Copy>
                      <View style={s.chartTabs}>
                        {(['Daily', 'Weekly', 'Monthly'] as Group[]).map(p => (
                          <Pressable
                            key={p}
                            accessibilityRole="button"
                            accessibilityLabel={p}
                            accessibilityState={{ selected: group === p }}
                            onPress={() => {
                              setGroup(p);
                              setSelected(null);
                            }}
                            style={[
                              s.groupButton,
                              group === p && s.activeGroup,
                            ]}
                          >
                            <Copy
                              size={12}
                              color={group === p ? c.ink : c.muted}
                            >
                              {p}
                            </Copy>
                          </Pressable>
                        ))}
                      </View>
                      {group === 'Monthly' && !customRange ? (
                        <Copy muted size={11}>
                          Last six calendar months
                        </Copy>
                      ) : null}
                      <Trend
                        values={buckets.map(b => b.value)}
                        labels={buckets.map(b => b.label)}
                        selected={selected}
                        onSelect={setSelected}
                        currency={currency}
                      />
                      <View style={s.chartFooter}>
                        {selectedBucket ? (
                          <>
                            <View style={ui.fill}>
                              <Copy muted size={11}>
                                {rangeLabel(selectedBucket.range)}
                              </Copy>
                              <Amount
                                value={selectedBucket.value}
                                currency={currency}
                                size={22}
                              />
                            </View>
                            <GlassPressable
                              label="View selected period payments"
                              radius={14}
                              contentStyle={s.rangeButton}
                              onPress={() => history(selectedBucket.range)}
                            >
                              <Copy size={12} color={c.gold}>
                                View payments
                              </Copy>
                              <Icon name="arrow" color={c.gold} size={16} />
                            </GlassPressable>
                          </>
                        ) : (
                          <>
                            <Amount
                              value={average}
                              currency={currency}
                              size={19}
                            />
                            <Copy muted size={12} style={ui.fill}>
                              / day
                            </Copy>
                            <Copy muted size={11}>
                              Tap or drag to explore
                            </Copy>
                          </>
                        )}
                      </View>
                      {selectedBucket ? (
                        <View style={s.spread}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Previous chart period"
                            disabled={selected === 0}
                            onPress={() =>
                              setSelected(v => Math.max(0, (v ?? 1) - 1))
                            }
                            style={s.chartStep}
                          >
                            <Copy
                              size={12}
                              color={selected === 0 ? c.muted : c.gold}
                            >
                              ← Previous
                            </Copy>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Next chart period"
                            disabled={selected === buckets.length - 1}
                            onPress={() =>
                              setSelected(v =>
                                Math.min(buckets.length - 1, (v ?? 0) + 1),
                              )
                            }
                            style={s.chartStep}
                          >
                            <Copy
                              size={12}
                              color={
                                selected === buckets.length - 1
                                  ? c.muted
                                  : c.gold
                              }
                            >
                              Next →
                            </Copy>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                    {largest ? (
                      <GlassPressable
                        label={`Explore largest category ${largest.name}`}
                        onPress={() => setDetail({ category: largest.id })}
                        contentStyle={s.insight}
                        radius={23}
                      >
                        <View style={s.insightIcon}>
                          <Icon name={largest.icon} color={c.navy} size={20} />
                        </View>
                        <View style={ui.fill}>
                          <Copy bold size={13} color={c.navy}>
                            {largest.name} is your largest category
                          </Copy>
                          <Copy size={12} color="#486078">
                            {formatMoney(largest.amount, currency)} ·{' '}
                            {Math.round((largest.amount / data.spent) * 100)}%
                            of spending
                          </Copy>
                        </View>
                        <Icon name="arrow" size={18} color="#76551D" />
                      </GlassPressable>
                    ) : null}
                    <View style={s.stackTight}>
                      <View style={s.spread}>
                        <Copy bold size={19}>
                          Where it went
                        </Copy>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="View all categories"
                          onPress={() => setTab('Categories')}
                          style={s.chartStep}
                        >
                          <Copy size={12} color={c.gold}>
                            View all →
                          </Copy>
                        </Pressable>
                      </View>
                      {cats.slice(0, 3).map(cat => (
                        <GlassPressable
                          key={cat.id}
                          label={`View ${cat.name} spending`}
                          radius={16}
                          contentStyle={s.categoryPreview}
                          onPress={() => setDetail({ category: cat.id })}
                        >
                          <View
                            style={[
                              s.categoryIcon,
                              { backgroundColor: cat.color + '22' },
                            ]}
                          >
                            <Icon name={cat.icon} color={cat.color} size={20} />
                          </View>
                          <View style={[ui.fill, s.stackSmall]}>
                            <View style={s.spread}>
                              <Copy bold size={14}>
                                {cat.name}
                              </Copy>
                              <Amount
                                value={cat.amount}
                                currency={currency}
                                size={17}
                                fit
                              />
                            </View>
                            <Progress
                              value={(cat.amount / data.spent) * 100}
                              color={cat.color}
                            />
                          </View>
                          <Icon name="arrow" color={c.muted} size={16} />
                        </GlassPressable>
                      ))}
                    </View>
                    <View style={s.spread}>
                      <Copy muted size={12}>
                        Highest spending day
                      </Copy>
                      <Copy size={12}>
                        {shortDate(dates[daily.indexOf(Math.max(...daily))])} ·{' '}
                        {formatMoney(Math.max(...daily), currency)}
                      </Copy>
                    </View>
                  </>
                ) : (
                  <Empty
                    title="Insights grow with your history"
                    copy="Detected expenses and manual payments will appear here. Income and lending are kept separate."
                    icon="activity"
                  />
                )}
              </>
            ) : null}
            {tab === 'Categories' ? (
              <>
                <Copy bold size={23}>
                  Where your money went
                </Copy>
                {data.spent > 0 ? (
                  <>
                    <Donut
                      items={cats}
                      currency={currency}
                      selected={activeCategory?.id || null}
                      onSelect={setSelectedCategory}
                    />
                    <View style={s.stackSmall}>
                      {cats.map(cat => (
                        <GlassPressable
                          key={cat.id}
                          label={`Select ${cat.name} category`}
                          radius={17}
                          contentStyle={[
                            s.categoryRow,
                            activeCategory?.id === cat.id && s.selectedCategory,
                          ]}
                          onPress={() => setSelectedCategory(cat.id)}
                        >
                          <View
                            style={[s.dot, { backgroundColor: cat.color }]}
                          />
                          <Copy bold size={14} style={ui.fill}>
                            {cat.name}
                          </Copy>
                          <Amount
                            value={cat.amount}
                            currency={currency}
                            size={17}
                            fit
                          />
                          <Copy muted size={12}>
                            {Math.round((cat.amount / data.spent) * 100)}%
                          </Copy>
                          <Icon
                            name="arrow"
                            size={16}
                            color={
                              activeCategory?.id === cat.id ? c.gold : c.muted
                            }
                          />
                        </GlassPressable>
                      ))}
                    </View>
                    {activeCategory ? (
                      <Button
                        label={`Explore ${activeCategory.name} spending`}
                        secondary
                        onPress={() =>
                          setDetail({ category: activeCategory.id })
                        }
                      />
                    ) : null}
                  </>
                ) : (
                  <Empty
                    title="No category spending yet"
                    copy="Choose a period with recorded expenses to see the breakdown."
                  />
                )}
                <Disclosure title="Payment methods">
                  {Object.entries(methodLabels).map(([method, label]) => {
                    const amount = sum(
                      data.expenses.filter(t => t.method === method),
                    );
                    return amount ? (
                      <MoneyBar
                        key={method}
                        label={label}
                        value={amount}
                        max={data.spent}
                        currency={currency}
                        color={c.gold}
                        onPress={() => history(range, { method })}
                      />
                    ) : null;
                  })}
                  {!data.spent ? (
                    <Copy muted>No expenses recorded.</Copy>
                  ) : null}
                </Disclosure>
              </>
            ) : null}
            {tab === 'Compare' ? (
              <>
                <View style={s.compareSelectors}>
                  <GlassPressable
                    label="Choose spending month"
                    style={ui.fill}
                    contentStyle={s.periodSelector}
                    radius={22}
                    onPress={() => setPicker('target')}
                  >
                    <Copy muted size={10}>
                      SPENDING MONTH
                    </Copy>
                    <View style={s.spread}>
                      <Copy bold size={14}>
                        {monthLabel(month, true)}
                      </Copy>
                      <Icon name="down" color={c.gold} size={15} />
                    </View>
                    <Copy muted size={11}>
                      {fullRangeLabel(comparison.target.range)}
                    </Copy>
                  </GlassPressable>
                  <GlassPressable
                    label="Choose comparison month"
                    style={ui.fill}
                    contentStyle={s.periodSelector}
                    radius={22}
                    onPress={() => setPicker('baseline')}
                  >
                    <Copy muted size={10}>
                      FULL MONTH
                    </Copy>
                    <View style={s.spread}>
                      <Copy bold size={14}>
                        {monthLabel(baseline, true)}
                      </Copy>
                      <Icon name="down" color={c.gold} size={15} />
                    </View>
                    <Copy muted size={11}>
                      {fullRangeLabel(comparison.reference.range)}
                    </Copy>
                  </GlassPressable>
                </View>
                <View style={s.hero}>
                  <Copy muted bold size={11} style={s.eyebrow}>
                    RECORDED SPENDING
                  </Copy>
                  <Amount
                    value={comparison.current}
                    currency={currency}
                    size={49}
                    fit
                    label="Comparison target spending"
                  />
                  {hasCompare ? (
                    <Copy
                      bold
                      color={comparison.delta > 0 ? c.danger : c.gold}
                      size={14}
                    >
                      {deltaText(
                        comparison.delta,
                        comparison.previous,
                        currency,
                      )}
                    </Copy>
                  ) : (
                    <Copy muted size={13}>
                      {comparison.hasCurrent
                        ? 'No expenses recorded in the comparison month'
                        : 'No expenses recorded in the spending period'}
                    </Copy>
                  )}
                  <Copy muted size={12}>
                    Full {monthLabel(baseline, true)} versus{' '}
                    {fullRangeLabel(comparison.target.range)}.
                  </Copy>
                </View>
                <View style={s.card}>
                  <Copy bold size={17}>
                    Spending side by side
                  </Copy>
                  <MoneyBar
                    label={monthLabel(month, true)}
                    value={comparison.current}
                    max={Math.max(comparison.current, comparison.previous)}
                    currency={currency}
                    color={c.gold}
                    note={`${fullRangeLabel(comparison.target.range)} · ${
                      comparison.target.expenses.length
                    } payments`}
                    onPress={() => history(comparison.target.range)}
                  />
                  <MoneyBar
                    label={monthLabel(baseline, true)}
                    value={comparison.previous}
                    max={Math.max(comparison.current, comparison.previous)}
                    currency={currency}
                    color="#8FA8C1"
                    note={`${fullRangeLabel(comparison.reference.range)} · ${
                      comparison.reference.expenses.length
                    } payments`}
                    onPress={() => history(comparison.reference.range)}
                  />
                </View>
                {hasCompare ? (
                  <View style={s.takeaway}>
                    <Icon name="info" size={18} color={c.gold} />
                    <Copy size={13} style={ui.fill}>
                      {takeaway}
                    </Copy>
                  </View>
                ) : (
                  <Copy muted size={12}>
                    A comparison needs two months with recorded expenses.
                    Missing records are not treated as a spending decrease.
                  </Copy>
                )}
                <View style={s.stackTight}>
                  <Copy bold size={19}>
                    What changed
                  </Copy>
                  <Copy muted size={12}>
                    Largest differences first · recorded expenses
                  </Copy>
                  {changes.map(cat => (
                    <GlassPressable
                      key={cat.id}
                      label={`Compare ${cat.name}`}
                      radius={17}
                      contentStyle={s.changeRow}
                      onPress={() =>
                        setDetail({ category: cat.id, compare: true })
                      }
                    >
                      <View style={s.spread}>
                        <Copy bold size={14} style={ui.fill}>
                          {cat.name}
                        </Copy>
                        <Copy
                          bold
                          size={14}
                          color={cat.delta > 0 ? c.danger : c.gold}
                        >
                          {cat.delta === 0
                            ? 'No change'
                            : `${cat.delta > 0 ? '+' : '−'}${formatMoney(
                                Math.abs(cat.delta),
                                currency,
                              )}`}
                        </Copy>
                        <Icon name="arrow" size={15} color={c.muted} />
                      </View>
                      <Copy muted size={12}>
                        {formatMoney(cat.current, currency)} vs{' '}
                        {formatMoney(cat.previous, currency)}
                        {cat.previous === 0 ? ' · No prior records' : ''}
                      </Copy>
                    </GlassPressable>
                  ))}
                </View>
                <Disclosure title="Income & surplus">
                  {[
                    { title: monthLabel(month, true), data: comparison.target },
                    {
                      title: monthLabel(baseline, true),
                      data: comparison.reference,
                    },
                  ].map(period => (
                    <View key={period.title} style={s.stackTight}>
                      <Copy bold>
                        {period.title} · {fullRangeLabel(period.data.range)}
                      </Copy>
                      {period.data.incomeRecorded ? (
                        <>
                          <MoneyBar
                            label="Recorded income"
                            value={period.data.earned}
                            max={Math.max(
                              period.data.earned,
                              period.data.spent,
                            )}
                            currency={currency}
                            color="#A7C7C5"
                          />
                          <MoneyBar
                            label="Expenses"
                            value={period.data.spent}
                            max={Math.max(
                              period.data.earned,
                              period.data.spent,
                            )}
                            currency={currency}
                            color={c.gold}
                          />
                          <View style={s.spread}>
                            <Copy muted size={12}>
                              {period.data.earned >= period.data.spent
                                ? 'Recorded surplus'
                                : 'Recorded deficit'}
                            </Copy>
                            <Amount
                              value={Math.abs(
                                period.data.earned - period.data.spent,
                              )}
                              currency={currency}
                              size={22}
                            />
                          </View>
                        </>
                      ) : (
                        <Copy muted>Income not recorded</Copy>
                      )}
                    </View>
                  ))}
                  <Copy muted size={11}>
                    Surplus is recorded income minus expenses, not a verified
                    bank balance. Lending and own transfers are excluded.
                  </Copy>
                </Disclosure>
                <Disclosure title="Budget vs actual">
                  <Copy muted size={12}>
                    {fullRangeLabel(comparison.target.range)} · against the full
                    monthly limit
                  </Copy>
                  {plan.budget !== null ? (
                    <MoneyBar
                      label="Overall monthly budget"
                      value={comparison.current}
                      max={plan.budget}
                      currency={currency}
                      color={
                        comparison.current > plan.budget ? c.danger : c.gold
                      }
                      note={`${formatMoney(
                        comparison.current,
                        currency,
                      )} of ${formatMoney(plan.budget, currency)}${
                        comparison.current > plan.budget ? ' · Over budget' : ''
                      }`}
                    />
                  ) : (
                    <Copy muted>No overall budget set for this month.</Copy>
                  )}
                  {analyticsCategories(comparison.target.expenses, finance).map(
                    cat => (
                      <MoneyBar
                        key={cat.id}
                        label={cat.name}
                        value={cat.amount}
                        max={plan.limits[cat.id] ?? null}
                        currency={currency}
                        color={
                          plan.limits[cat.id] !== undefined &&
                          cat.amount > plan.limits[cat.id]
                            ? c.danger
                            : c.gold
                        }
                        note={
                          plan.limits[cat.id] !== undefined
                            ? `Limit ${formatMoney(
                                plan.limits[cat.id],
                                currency,
                              )}`
                            : 'No category limit set'
                        }
                      />
                    ),
                  )}
                </Disclosure>
              </>
            ) : null}
          </MotionPanel>
        </View>
        {rangeOpen ? (
          <RangeEditor
            range={range}
            onApply={setCustomRange}
            onClose={() => setRangeOpen(false)}
          />
        ) : null}
        {picker ? (
          <MonthPicker
            month={picker === 'target' ? month : baseline}
            title={picker === 'target' ? 'Spending month' : 'Comparison month'}
            maxMonth={
              picker === 'target'
                ? monthKey(today)
                : shiftMonth(monthKey(today), -1)
            }
            disabledMonth={picker === 'baseline' ? month : undefined}
            onSelect={m => {
              if (picker === 'target') onMonthChange(m);
              else setManualBaseline(m);
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        ) : null}
        {detail && detailCategory ? (
          <Sheet title={detailCategory.name} onClose={() => setDetail(null)}>
            <Copy muted size={12}>
              {fullRangeLabel(detailRange)}
            </Copy>
            <Amount value={sum(detailRows)} currency={currency} size={38} fit />
            <Copy muted>{detailRows.length} recorded payments</Copy>
            <Button
              label="View category payments"
              onPress={() =>
                openHistory(detailRange, { category: detail.category })
              }
            />
            {detail.compare ? (
              <>
                <Copy muted size={12}>
                  Full {monthLabel(baseline, true)}
                </Copy>
                <Amount
                  value={sum(
                    comparison.reference.expenses.filter(
                      t => t.expenseCategory === detail.category,
                    ),
                  )}
                  currency={currency}
                  size={28}
                />
                <Button
                  label="View comparison month payments"
                  secondary
                  onPress={() =>
                    openHistory(comparison.reference.range, {
                      category: detail.category,
                    })
                  }
                />
              </>
            ) : null}
            <Copy bold size={18}>
              {detail.compare ? 'Vendors · spending period' : 'Top vendors'}
            </Copy>
            {vendors.length ? (
              vendors.slice(0, 8).map(v => (
                <View key={v.name} style={s.vendorRow}>
                  <View style={ui.fill}>
                    <Copy bold size={14}>
                      {v.name}
                    </Copy>
                    <Copy muted size={11}>
                      {v.count} payments
                    </Copy>
                  </View>
                  <Amount value={v.amount} currency={currency} size={19} fit />
                </View>
              ))
            ) : (
              <Copy muted>No payments in the target period.</Copy>
            )}
          </Sheet>
        ) : null}
      </GlassMotionContext.Provider>
    </ThemeContext.Provider>
  );
}
const s = StyleSheet.create({
  stack: { gap: 24 },
  stackTight: { gap: 13 },
  stackSmall: { gap: 6 },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 9,
    flexWrap: 'wrap',
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 23,
    backgroundColor: '#142E45',
    gap: 3,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
  },
  activeTab: { backgroundColor: '#294A63' },
  hero: { gap: 12, paddingTop: 2, paddingBottom: 1 },
  eyebrow: { letterSpacing: 1.5 },
  badge: {
    backgroundColor: c.goldSoft,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: c.surface,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 29,
    padding: 18,
    gap: 17,
  },
  rangeButton: {
    minHeight: 44,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chartTabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: c.bg,
    borderRadius: 18,
    padding: 3,
    gap: 2,
  },
  groupButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  activeGroup: { backgroundColor: c.subtle },
  chartFooter: {
    borderTopWidth: 1,
    borderColor: c.line,
    paddingTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  chartStep: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 5 },
  insight: {
    backgroundColor: '#FAF4E9',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  insightIcon: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: '#F4DEAF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPreview: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryRow: {
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedCategory: { backgroundColor: c.surface, borderColor: '#647E95' },
  dot: { width: 13, height: 13, borderRadius: 7 },
  compareSelectors: { flexDirection: 'row', gap: 10 },
  periodSelector: {
    backgroundColor: c.surface,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: c.line,
    flex: 1,
  },
  moneyBar: { gap: 9, paddingVertical: 7 },
  takeaway: {
    backgroundColor: c.surface,
    padding: 16,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  changeRow: {
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  disclosure: { borderTopWidth: 1, borderColor: c.line },
  disclosureHeading: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  disclosureBody: { paddingVertical: 10, gap: 22 },
  rotate: { transform: [{ rotate: '180deg' }] },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
});
