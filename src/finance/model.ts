import type { Transaction, PaymentMethod } from '../types';
import { transactionTime } from '../types';
import { expenseCategories } from '../categories';
export type ThemePreference = 'system' | 'light' | 'dark';
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';
export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};
export type MonthPlan = {
  budget: number | null;
  limits: Record<string, number>;
  savingsTarget: number | null;
};
export type Goal = {
  id: string;
  name: string;
  target: number;
  currency: Currency;
  due: string;
  icon: string;
};
export type Contribution = {
  id: string;
  goalId: string;
  amount: number;
  at: number;
  note: string;
};
export type Repayment = {
  id: string;
  transactionId: string;
  amount: number;
  at: number;
  method: PaymentMethod;
  note: string;
};
export type FinanceState = {
  version: 1;
  months: Record<string, MonthPlan>;
  defaults: Record<string, MonthPlan & { from: string }>;
  categories: Category[];
  goals: Goal[];
  contributions: Contribution[];
  repayments: Repayment[];
};
export type Preferences = {
  theme: ThemePreference;
  currency: Currency;
  name: string;
  alerts: boolean;
  thresholds: number[];
  appLock: boolean;
};
export const initialPreferences: Preferences = {
  theme: 'system',
  currency: 'INR',
  name: '',
  alerts: true,
  thresholds: [70, 90, 100],
  appLock: false,
};
export const initialFinance = (): FinanceState => ({
  version: 1,
  months: {},
  defaults: {},
  categories: [],
  goals: [],
  contributions: [],
  repayments: [],
});
export const emptyMonth = (): MonthPlan => ({
  budget: null,
  limits: {},
  savingsTarget: null,
});
export const id = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
export const monthKey = (date: Date | number = new Date()) => {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const monthDate = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1);
};
export const shiftMonth = (month: string, by: number) => {
  const d = monthDate(month);
  d.setMonth(d.getMonth() + by);
  return monthKey(d);
};
export const monthLabel = (month: string, short = false) =>
  monthDate(month).toLocaleDateString('en-IN', {
    month: short ? 'short' : 'long',
    year: 'numeric',
  });
export const localDate = (date: Date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
export const dateText = (at: number) =>
  new Date(at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const timeText = (at: number) =>
  new Date(at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
export const currencyOf = (t: Transaction): Currency => t.currency || 'INR';
export const formatMoney = (
  amount: number,
  currency: Currency = 'INR',
  hidden = false,
) =>
  hidden
    ? '••••'
    : new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-GB', {
        style: 'currency',
        currency,
        maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
      }).format(amount / 100);
export function parseAmount(input: string, allowZero = false): number {
  const text = input.trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text))
    throw Error('Enter an amount with up to two decimal places.');
  const [w, f = ''] = text.split('.');
  const amount = Number(w) * 100 + Number(f.padEnd(2, '0'));
  if (amount < (allowZero ? 0 : 1) || amount > 10_000_000_000)
    throw Error('Enter a valid amount greater than zero.');
  return amount;
}
export const methodLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  DEBIT_CARD: 'Debit card',
  CREDIT_CARD: 'Credit card',
  CARD: 'Card · unspecified',
  BANK: 'Bank transfer',
};
const categoryIcons: Record<string, string> = {
  uncategorised: 'wallet',
  food: 'coffee',
  clothes: 'bag',
  groceries: 'bag',
  travel: 'car',
  bills: 'phone',
  health: 'shield',
  entertainment: 'play',
  other: 'wallet',
};
const categoryColors = [
  '#8F9FC4',
  '#C7A15A',
  '#B1A3C5',
  '#6F859C',
  '#8F9FC4',
  '#B1A3C5',
  '#6F859C',
  '#C7A15A',
  '#8F9FC4',
];
export const baseCategories: Category[] = expenseCategories.map((c, i) => ({
  id: c.value,
  name:
    c.value === 'uncategorised'
      ? 'Uncategorised'
      : c.value === 'food'
      ? 'Food & drink'
      : c.label,
  icon: categoryIcons[c.value] || 'wallet',
  color: categoryColors[i],
}));
export const incomeCategories: Category[] = [
  { id: 'income_salary', name: 'Salary', icon: 'bank', color: '#6F859C' },
  {
    id: 'income_freelance',
    name: 'Freelance',
    icon: 'wallet',
    color: '#B1A3C5',
  },
  {
    id: 'income_other',
    name: 'Other income',
    icon: 'wallet',
    color: '#8F9FC4',
  },
];
export const allCategories = (state: FinanceState) => [
  ...baseCategories,
  ...state.categories,
];
export const categoryFor = (state: FinanceState, category: string) =>
  [...allCategories(state), ...incomeCategories].find(c => c.id === category) ||
  baseCategories[0];
export function monthPlan(
  state: FinanceState,
  month: string,
  currency: Currency,
): MonthPlan {
  const existing = state.months[`${currency}:${month}`];
  if (existing) return existing;
  const d = state.defaults[currency];
  return d && month >= d.from
    ? {
        budget: d.budget,
        limits: { ...d.limits },
        savingsTarget: d.savingsTarget,
      }
    : emptyMonth();
}
/** Freeze past default budgets before defaults change; past months must not be rewritten. */
export function setMonthPlan(
  state: FinanceState,
  month: string,
  currency: Currency,
  plan: MonthPlan,
  asDefault = false,
  now = monthKey(),
): FinanceState {
  const months = { ...state.months },
    defaults = { ...state.defaults };
  const old = defaults[currency];
  if (asDefault && month !== now)
    throw Error('Monthly defaults can only be changed for the current month.');
  if (asDefault && old) {
    let m = old.from;
    for (let i = 0; m <= now && i < 1200; i++, m = shiftMonth(m, 1)) {
      const key = `${currency}:${m}`;
      if (!months[key])
        months[key] = {
          budget: old.budget,
          limits: { ...old.limits },
          savingsTarget: old.savingsTarget,
        };
    }
  }
  months[`${currency}:${month}`] = plan;
  if (asDefault)
    defaults[currency] = { ...plan, limits: { ...plan.limits }, from: now };
  return { ...state, months, defaults };
}
export function inMonth(t: Transaction, month: string, currency: Currency) {
  return monthKey(transactionTime(t)) === month && currencyOf(t) === currency;
}
export const sum = (items: Transaction[]) =>
  items.reduce((s, t) => s + t.amountPaise, 0);
export function summary(
  items: Transaction[],
  month: string,
  currency: Currency,
) {
  const rows = items.filter(t => inMonth(t, month, currency));
  const expenses = rows.filter(t => t.category === 'expense'),
    income = rows.filter(t => t.category === 'income');
  return {
    rows,
    expenses,
    income,
    spent: sum(expenses),
    earned: sum(income),
    incomeRecorded: income.length > 0,
    surplus: sum(income) - sum(expenses),
  };
}
export const returned = (state: FinanceState, t: Transaction) =>
  state.repayments
    .filter(r => r.transactionId === t.id)
    .reduce((s, r) => s + r.amount, 0);
export const outstanding = (state: FinanceState, t: Transaction) =>
  Math.max(0, t.amountPaise - returned(state, t));
export const allocated = (state: FinanceState, goalId: string) =>
  state.contributions
    .filter(c => c.goalId === goalId)
    .reduce((s, c) => s + c.amount, 0);
export function addRepayment(
  state: FinanceState,
  tx: Transaction,
  r: Repayment,
): FinanceState {
  if (tx.category !== 'lent' || r.transactionId !== tx.id)
    throw Error('Choose a lending transaction.');
  if (
    !Number.isSafeInteger(r.amount) ||
    r.amount < 1 ||
    r.amount > outstanding(state, tx)
  )
    throw Error('Repayment cannot exceed the outstanding amount.');
  if (
    !Number.isSafeInteger(r.at) ||
    r.at > Date.now() ||
    r.at < transactionTime(tx)
  )
    throw Error('Choose a repayment date between the lending date and now.');
  return { ...state, repayments: [r, ...state.repayments] };
}
export function removeTransactionState(
  state: FinanceState,
  txId: string,
): FinanceState {
  return {
    ...state,
    repayments: state.repayments.filter(r => r.transactionId !== txId),
  };
}
export function categoryTotals(expenses: Transaction[], state: FinanceState) {
  return allCategories(state)
    .map(c => ({
      ...c,
      amount: expenses
        .filter(t => t.expenseCategory === c.id)
        .reduce((s, t) => s + t.amountPaise, 0),
    }))
    .sort((a, b) => b.amount - a.amount);
}
export function comparison(
  items: Transaction[],
  month: string,
  currency: Currency,
  now = new Date(),
) {
  const currentMonth = monthKey(now);
  const end =
    month === currentMonth
      ? now.getDate()
      : new Date(
          monthDate(month).getFullYear(),
          monthDate(month).getMonth() + 1,
          0,
        ).getDate();
  const prev = shiftMonth(month, -1);
  const previousDays = new Date(
    monthDate(prev).getFullYear(),
    monthDate(prev).getMonth() + 1,
    0,
  ).getDate();
  const cut = Math.min(end, previousDays);
  const scoped = (m: string) =>
    items.filter(
      t =>
        t.category === 'expense' &&
        currencyOf(t) === currency &&
        monthKey(transactionTime(t)) === m &&
        new Date(transactionTime(t)).getDate() <= cut,
    );
  const current = sum(scoped(month)),
    previous = sum(scoped(prev));
  return {
    current,
    previous,
    days: cut,
    previousMonth: prev,
    delta: current - previous,
    percent: previous
      ? Math.round(((current - previous) / previous) * 100)
      : null,
    hasPrevious: scoped(prev).length > 0,
  };
}
export type BudgetWarning = {
  id: string;
  name: string;
  spent: number;
  limit: number;
  percent: number;
  level: number;
};
export function budgetWarnings(
  expenses: Transaction[],
  plan: MonthPlan,
  categories: Category[],
  thresholds = [70, 90, 100],
): BudgetWarning[] {
  const totals = [
    {
      id: 'overall',
      name: 'Monthly budget',
      spent: sum(expenses),
      limit: plan.budget || 0,
    },
    ...categories.map(c => ({
      id: c.id,
      name: c.name,
      spent: sum(expenses.filter(t => t.expenseCategory === c.id)),
      limit: plan.limits[c.id] || 0,
    })),
  ];
  return totals
    .filter(v => v.limit > 0)
    .map(v => ({
      ...v,
      percent: Math.round((v.spent / v.limit) * 100),
      level: Math.max(
        0,
        ...thresholds.filter(t => v.spent * 100 >= v.limit * t),
      ),
    }))
    .filter(v => v.level > 0)
    .sort((a, b) => b.percent - a.percent);
}
export function normaliseFinance(value: Partial<FinanceState>): FinanceState {
  const empty = initialFinance();
  return {
    ...empty,
    ...value,
    version: 1,
    months: value.months || {},
    defaults: value.defaults || {},
    categories: value.categories || [],
    goals: value.goals || [],
    contributions: value.contributions || [],
    repayments: value.repayments || [],
  };
}
