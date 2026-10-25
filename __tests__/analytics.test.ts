import {
  analyticsCategories,
  categoryChanges,
  compareMonths,
  monthRange,
  periodSummary,
  rangeDays,
  spendingBuckets,
} from '../src/finance/analytics';
import { initialFinance, sum } from '../src/finance/model';
import type { Transaction } from '../src/types';
const tx = (
  date: string,
  amount: number,
  patch: Partial<Transaction> = {},
): Transaction => ({
  id: date,
  source: 'sms',
  amountPaise: amount,
  bank: 'HDFC Bank',
  account: '1234',
  method: 'UPI',
  recipient: 'Shop',
  category: 'expense',
  expenseCategory: 'groceries',
  remarks: '',
  reference: '',
  receivedAt: new Date(date + 'T12:00:00').getTime(),
  transactionAt: null,
  autoSaveAt: 0,
  confirmed: true,
  demo: true,
  location: null,
  locationStatus: 'sample',
  ...patch,
});
const now = new Date(2026, 9, 25, 18);
test('comparison includes late baseline payments and excludes target payments after its cutoff', () => {
  const rows = [
    tx('2026-09-01', 10000),
    tx('2026-09-30', 90000),
    tx('2026-10-01', 20000),
    tx('2026-10-25', 30000),
    tx('2026-10-26', 70000),
  ];
  const c = compareMonths(rows, '2026-10', 'INR', now);
  expect(c).toMatchObject({
    current: 50000,
    previous: 100000,
    delta: -50000,
    percent: -50,
    days: 25,
  });
  expect(c.target.range).toEqual({ from: '2026-10-01', to: '2026-10-25' });
  expect(c.reference.range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
});
test('manually selected months use independent target and full baseline ranges', () => {
  const c = compareMonths(
    [tx('2026-08-25', 20000), tx('2026-08-31', 90000), tx('2026-06-30', 50000)],
    '2026-08',
    'INR',
    now,
    '2026-06',
  );
  expect(c.current).toBe(20000);
  expect(c.previous).toBe(50000);
  expect(c.target.range.to).toBe('2026-08-25');
  expect(c.reference.range.to).toBe('2026-06-30');
});
test('calendar views retain full historical months and current-month elapsed days', () => {
  expect(monthRange('2026-08', now).to).toBe('2026-08-31');
  expect(monthRange('2026-10', now).to).toBe('2026-10-25');
});
test('leap months, short targets and year boundaries are independent of baseline day counts', () => {
  expect(monthRange('2024-02', new Date(2026, 0, 31), 'day-number').to).toBe(
    '2024-02-29',
  );
  expect(monthRange('2025-02', new Date(2026, 0, 31), 'day-number').to).toBe(
    '2025-02-28',
  );
  const c = compareMonths([], '2026-01', 'INR', new Date(2026, 0, 25));
  expect(c.reference.range).toEqual({ from: '2025-12-01', to: '2025-12-31' });
});
test('range iteration validates dates, includes the final day and caps very long input', () => {
  expect(rangeDays({ from: '2024-02-28', to: '2024-03-01' })).toEqual([
    '2024-02-28',
    '2024-02-29',
    '2024-03-01',
  ]);
  expect(rangeDays({ from: '2026-02-30', to: '2026-03-01' })).toEqual([]);
  expect(rangeDays({ from: '2026-10-25', to: '2026-10-24' })).toEqual([]);
  expect(rangeDays({ from: '2020-01-01', to: '2030-01-01' })).toHaveLength(367);
});
test('totals separate currency and consumption from income, lending and own transfers', () => {
  const r = periodSummary(
    [
      tx('2026-10-25', 10000),
      tx('2026-10-25', 20000, { currency: 'USD' }),
      tx('2026-10-25', 30000, { category: 'income' }),
      tx('2026-10-25', 40000, { category: 'lent' }),
      tx('2026-10-25', 50000, { category: 'transfer' }),
    ],
    monthRange('2026-10', now),
    'INR',
    now,
  );
  expect(r.spent).toBe(10000);
  expect(r.earned).toBe(30000);
  expect(r.incomeRecorded).toBe(true);
});
test('recorded transaction time overrides SMS receipt time and future records are not counted', () => {
  const c = compareMonths(
    [
      tx('2026-10-25', 10000, {
        transactionAt: new Date(2026, 8, 30, 13).getTime(),
      }),
      tx('2026-10-25', 20000, {
        transactionAt: new Date(2026, 9, 25, 19).getTime(),
      }),
    ],
    '2026-10',
    'INR',
    now,
  );
  expect(c.current).toBe(0);
  expect(c.previous).toBe(10000);
});
test('missing prior expenses have no invented percentage and missing income remains distinct', () => {
  const c = compareMonths([tx('2026-10-25', 10000)], '2026-10', 'INR', now);
  expect(c.percent).toBeNull();
  expect(c.hasPrevious).toBe(false);
  expect(c.target.incomeRecorded).toBe(false);
});
test('category deltas include categories on either side and sort by rupee impact', () => {
  const rows = categoryChanges(
    [
      tx('2026-10-25', 20000, { expenseCategory: 'food' }),
      tx('2026-10-25', 30000),
    ],
    [
      tx('2026-09-30', 10000, { expenseCategory: 'food' }),
      tx('2026-09-30', 90000, { expenseCategory: 'clothes' }),
    ],
    initialFinance(),
  );
  expect(rows.map(r => [r.id, r.delta])).toEqual([
    ['clothes', -90000],
    ['groceries', 30000],
    ['food', 10000],
  ]);
  expect(rows.reduce((s, r) => s + r.delta, 0)).toBe(-50000);
});
test('category charts retain unknown legacy categories and their total matches the ledger', () => {
  const expenses = [
    tx('2026-10-25', 10000),
    tx('2026-10-25', 20000, { expenseCategory: 'custom_removed' }),
  ];
  const categories = analyticsCategories(expenses, initialFinance());
  expect(categories.reduce((n, c) => n + c.amount, 0)).toBe(sum(expenses));
  expect(categories[0].id).toBe('custom_removed');
});
test('daily buckets include zero-spend days and use the selected local date', () => {
  expect(
    spendingBuckets(
      [tx('2026-10-24', 10000), tx('2026-10-25', 20000)],
      ['2026-10-23', '2026-10-24', '2026-10-25'],
    ),
  ).toEqual([0, 10000, 20000]);
});
