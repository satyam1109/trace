import {
  addRepayment,
  allocated,
  budgetWarnings,
  comparison,
  currencyOf,
  initialFinance,
  monthPlan,
  outstanding,
  setMonthPlan,
  summary,
  type FinanceState,
} from '../src/finance/model';
import type { Transaction } from '../src/types';
function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't',
    source: 'manual',
    amountPaise: 10000,
    bank: '',
    account: '',
    method: 'CASH',
    recipient: 'Example',
    category: 'expense',
    expenseCategory: 'food',
    remarks: '',
    reference: '',
    receivedAt: new Date(2026, 9, 12, 12).getTime(),
    transactionAt: null,
    autoSaveAt: 0,
    confirmed: true,
    demo: true,
    location: null,
    locationStatus: 'manual',
    ...overrides,
  };
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 23, 12));
});
afterEach(() => jest.useRealTimers());
test('income, consumption, lending and transfers stay financially distinct', () => {
  const rows = [
    tx(),
    tx({ id: 'salary', category: 'income', amountPaise: 6000000 }),
    tx({ id: 'lent', category: 'lent', amountPaise: 350000 }),
    tx({ id: 'bill', category: 'transfer', amountPaise: 700000 }),
  ];
  const s = summary(rows, '2026-10', 'INR');
  expect(s.spent).toBe(10000);
  expect(s.earned).toBe(6000000);
  expect(s.surplus).toBe(5990000);
  expect(s.incomeRecorded).toBe(true);
  expect(summary([tx()], '2026-10', 'INR').incomeRecorded).toBe(false);
});
test('currencies are kept separate without relabelling legacy INR records', () => {
  expect(currencyOf(tx())).toBe('INR');
  const s = summary(
    [tx(), tx({ currency: 'USD', amountPaise: 2500 })],
    '2026-10',
    'USD',
  );
  expect(s.spent).toBe(2500);
});
test('budget defaults preserve historical months and reset spending per month', () => {
  let s = initialFinance();
  s = setMonthPlan(
    s,
    '2026-09',
    'INR',
    { budget: 100000, limits: { food: 20000 }, savingsTarget: 30000 },
    true,
    '2026-09',
  );
  s = setMonthPlan(
    s,
    '2026-11',
    'INR',
    { budget: 250000, limits: { food: 50000 }, savingsTarget: 70000 },
    true,
    '2026-11',
  );
  expect(monthPlan(s, '2026-09', 'INR').budget).toBe(100000);
  expect(monthPlan(s, '2026-10', 'INR').budget).toBe(100000);
  expect(monthPlan(s, '2026-12', 'INR').budget).toBe(250000);
  expect(monthPlan(s, '2026-08', 'INR').budget).toBeNull();
  expect(() =>
    setMonthPlan(
      s,
      '2026-09',
      'INR',
      { budget: 5, limits: {}, savingsTarget: null },
      true,
      '2026-11',
    ),
  ).toThrow();
});
test('category alerts use exact threshold crossing, not rounded display percentages', () => {
  const plan = { budget: 100000, limits: { food: 10000 }, savingsTarget: null };
  const cats = [{ id: 'food', name: 'Food', icon: 'coffee', color: '#C7A15A' }];
  expect(budgetWarnings([tx({ amountPaise: 6999 })], plan, cats)).toEqual([]);
  expect(budgetWarnings([tx({ amountPaise: 7000 })], plan, cats)[0].level).toBe(
    70,
  );
  expect(budgetWarnings([tx({ amountPaise: 9999 })], plan, cats)[0].level).toBe(
    90,
  );
  expect(
    budgetWarnings([tx({ amountPaise: 10000 })], plan, cats)[0].level,
  ).toBe(100);
  expect(budgetWarnings([tx({ amountPaise: 10000 })], plan, cats, [])).toEqual(
    [],
  );
});
test('repayments can be partial and never count as earned income', () => {
  const loan = tx({ category: 'lent', amountPaise: 350000 });
  let s = initialFinance();
  s = addRepayment(s, loan, {
    id: 'r',
    transactionId: loan.id,
    amount: 100000,
    at: new Date(2026, 9, 20).getTime(),
    method: 'UPI',
    note: '',
  });
  expect(outstanding(s, loan)).toBe(250000);
  expect(summary([loan], '2026-10', 'INR').earned).toBe(0);
  expect(() =>
    addRepayment(s, loan, {
      id: 'r2',
      transactionId: loan.id,
      amount: 250001,
      at: Date.now(),
      method: 'UPI',
      note: '',
    }),
  ).toThrow();
  expect(() =>
    addRepayment(s, loan, {
      id: 'r3',
      transactionId: loan.id,
      amount: 1,
      at: new Date(2026, 9, 1).getTime(),
      method: 'UPI',
      note: '',
    }),
  ).toThrow();
});
test('goal allocations are independent of the transaction ledger', () => {
  const s: FinanceState = {
    ...initialFinance(),
    contributions: [
      { id: 'c1', goalId: 'g', amount: 200000, at: Date.now(), note: '' },
      { id: 'c2', goalId: 'g', amount: 500000, at: Date.now(), note: '' },
    ],
  };
  expect(allocated(s, 'g')).toBe(700000);
  expect(summary([tx()], '2026-10', 'INR').spent).toBe(10000);
});
test('month comparison uses matching dates and excludes later previous-month payments', () => {
  const rows = [
    tx({ amountPaise: 20000, receivedAt: new Date(2026, 9, 20).getTime() }),
    tx({
      id: 'past',
      amountPaise: 10000,
      receivedAt: new Date(2026, 8, 20).getTime(),
    }),
    tx({
      id: 'later',
      amountPaise: 90000,
      receivedAt: new Date(2026, 8, 29).getTime(),
    }),
  ];
  const c = comparison(rows, '2026-10', 'INR', new Date(2026, 9, 23));
  expect(c).toMatchObject({
    current: 20000,
    previous: 10000,
    days: 23,
    delta: 10000,
    percent: 100,
  });
});
