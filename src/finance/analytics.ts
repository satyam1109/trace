import type { Transaction } from '../types';
import { transactionTime } from '../types';
import {
  allCategories,
  currencyOf,
  localDate,
  monthDate,
  monthKey,
  shiftMonth,
  sum,
  type Category,
  type Currency,
  type FinanceState,
} from './model';

export type DateRange = { from: string; to: string };
export type MonthScope = 'calendar' | 'day-number' | 'full';
const daysInMonth = (month: string) => {
  const d = monthDate(month);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};
export function monthRange(
  month: string,
  now = new Date(),
  scope: MonthScope = 'calendar',
): DateRange {
  const last = daysInMonth(month);
  const day =
    scope === 'day-number' || (scope === 'calendar' && month === monthKey(now))
      ? Math.min(now.getDate(), last)
      : last;
  return {
    from: `${month}-01`,
    to: `${month}-${String(day).padStart(2, '0')}`,
  };
}
function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return localDate(date) === value ? date : null;
}
export function rangeDays(range: DateRange, max = 366): string[] {
  const start = parseDay(range.from),
    end = parseDay(range.to);
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (
    const d = new Date(start);
    d <= end && dates.length <= max;
    d.setDate(d.getDate() + 1)
  )
    dates.push(localDate(d));
  return dates;
}
export function periodSummary(
  items: Transaction[],
  range: DateRange,
  currency: Currency,
  now = new Date(),
) {
  const start = parseDay(range.from),
    end = parseDay(range.to);
  end?.setDate(end.getDate() + 1);
  const rows =
    start && end && start < end
      ? items.filter(t => {
          const at = transactionTime(t);
          return (
            currencyOf(t) === currency &&
            at >= start.getTime() &&
            at < end.getTime() &&
            at <= now.getTime()
          );
        })
      : [];
  const expenses = rows.filter(t => t.category === 'expense'),
    income = rows.filter(t => t.category === 'income');
  return {
    range,
    rows,
    expenses,
    income,
    spent: sum(expenses),
    earned: sum(income),
    incomeRecorded: income.length > 0,
  };
}
export function analyticsCategories(
  expenses: Transaction[],
  state: FinanceState,
) {
  const known = new Map(allCategories(state).map(c => [c.id, c]));
  const totals = new Map<string, Category & { amount: number }>();
  for (const tx of expenses) {
    const cat = known.get(tx.expenseCategory) || {
      id: tx.expenseCategory,
      name: 'Uncategorised · legacy',
      color: '#8F9FC4',
      icon: 'wallet',
    };
    const old = totals.get(cat.id);
    if (old) old.amount += tx.amountPaise;
    else totals.set(cat.id, { ...cat, amount: tx.amountPaise });
  }
  return [...totals.values()].sort(
    (a, b) => b.amount - a.amount || a.name.localeCompare(b.name),
  );
}
/** Baseline always includes every calendar day. Target is explicitly independent. */
export function compareMonths(
  items: Transaction[],
  month: string,
  currency: Currency,
  now = new Date(),
  baseline = shiftMonth(month, -1),
  scope: MonthScope = 'day-number',
) {
  return comparePeriods(
    items,
    monthRange(month, now, scope),
    monthRange(baseline, now, 'full'),
    currency,
    now,
  );
}
export function comparePeriods(
  items: Transaction[],
  targetRange: DateRange,
  referenceRange: DateRange,
  currency: Currency,
  now = new Date(),
) {
  const target = periodSummary(items, targetRange, currency, now);
  const reference = periodSummary(items, referenceRange, currency, now);
  const delta = target.spent - reference.spent;
  return {
    target,
    reference,
    current: target.spent,
    previous: reference.spent,
    days: Number(target.range.to.slice(-2)),
    previousMonth: referenceRange.from.slice(0, 7),
    delta,
    percent: reference.spent
      ? Math.round((delta / reference.spent) * 100)
      : null,
    hasCurrent: target.expenses.length > 0,
    hasPrevious: reference.expenses.length > 0,
  };
}
export function categoryChanges(
  current: Transaction[],
  previous: Transaction[],
  state: FinanceState,
) {
  const a = analyticsCategories(current, state),
    b = analyticsCategories(previous, state);
  const byId = new Map(b.map(c => [c.id, c]));
  const ids = [...new Set([...a.map(c => c.id), ...b.map(c => c.id)])];
  const currentById = new Map(a.map(c => [c.id, c]));
  return ids
    .map(id => {
      const c = currentById.get(id),
        p = byId.get(id),
        cat = (c || p)!;
      return {
        ...cat,
        current: c?.amount || 0,
        previous: p?.amount || 0,
        delta: (c?.amount || 0) - (p?.amount || 0),
      };
    })
    .sort(
      (x, y) =>
        Math.abs(y.delta) - Math.abs(x.delta) || x.name.localeCompare(y.name),
    );
}
export function spendingBuckets(expenses: Transaction[], dates: string[]) {
  const totals = new Map<string, number>();
  for (const t of expenses) {
    const key = localDate(new Date(transactionTime(t)));
    totals.set(key, (totals.get(key) || 0) + t.amountPaise);
  }
  return dates.map(d => totals.get(d) || 0);
}
