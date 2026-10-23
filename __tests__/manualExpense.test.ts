import {
  localPaymentTime,
  validateManual,
} from '../src/services/manualExpense';
import type { ManualExpense } from '../src/types';
const input: ManualExpense = {
  amount: '787.34',
  method: 'CASH',
  recipient: 'Example',
  category: 'expense',
  expenseCategory: 'food',
  remarks: 'Lunch',
  occurredAt: new Date(2026, 0, 10, 12, 30).getTime(),
  demo: false,
};
it.each([
  ['0.01', 1],
  ['787.34', 78734],
  ['1.1', 110],
  ['100000000', 10000000000],
])('stores %s in exact paise', (amount, expected) => {
  expect(validateManual({ ...input, amount: String(amount) })).toBe(expected);
});
it.each(['0', '-1', '1.001', '1e3', '1,000', 'NaN', '100000000.01', '', '1.'])(
  'rejects invalid amount %s',
  amount => {
    expect(() => validateManual({ ...input, amount })).toThrow();
  },
);
it('validates method, category and past timestamp independently', () => {
  for (const change of [
    { method: 'BITCOIN' },
    { category: 'invalid' },
    { expenseCategory: 'invalid' },
    { occurredAt: NaN },
    { occurredAt: Date.now() + 60000 },
  ])
    expect(() =>
      validateManual({ ...input, ...change } as ManualExpense),
    ).toThrow();
});
it('parses local dates and rejects impossible or normalised dates', () => {
  expect(localPaymentTime('2026-01-10', '12:30')).toBe(input.occurredAt);
  for (const [date, time] of [
    ['2026-02-30', '12:30'],
    ['2026-13-01', '12:30'],
    ['2026-01-01', '24:00'],
    ['2026-01-01', '1:30'],
  ])
    expect(() => localPaymentTime(date, time)).toThrow();
});
