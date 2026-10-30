import type {
  DemoResult,
  ManualExpense,
  Snapshot,
  Transaction,
  TransactionCategory,
} from '../types';
import { learnVendor, normaliseVendor, isRememberable } from './vendorRules';
import type { VendorRule } from '../types';
import { validateManual } from './manualExpense';
import { starterPayments } from '../demo';
import { parseDemo } from './demoParser';
import {
  initialFinance,
  initialPreferences,
  normaliseFinance,
  removeTransactionState,
  type FinanceState,
  type Preferences,
} from '../finance/model';
import { isExpenseCategory, type ExpenseCategory } from '../categories';

export const isBrowser = true;
const storageKey = 'trace.browser-demo.v1';
const planningKey = 'trace.finance.demo.v1';
const preferencesKey = 'trace.preferences.v1';
const vendorKey = 'trace.vendor-rules.demo.v1';
const readVendors = (): Record<string, VendorRule> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(vendorKey) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, rule]) => {
        const value = rule as VendorRule;
        return (
          value &&
          typeof value.name === 'string' &&
          typeof value.key === 'string' &&
          typeof value.category === 'string'
        );
      }),
    ) as Record<string, VendorRule>;
  } catch {
    return {};
  }
};
const writeVendors = (rules: Record<string, VendorRule>) =>
  localStorage.setItem(vendorKey, JSON.stringify(rules));
function remembered(name: string) {
  const rules = readVendors(),
    key = normaliseVendor(name);
  const rule = Object.hasOwn(rules, key) ? rules[key] : undefined;
  return rule && isRememberable(rule.category, readFinance().categories)
    ? rule.category
    : undefined;
}
function learn(tx: Transaction, selected: boolean) {
  const rules = readVendors();
  const next = learnVendor(rules, tx, selected, readFinance().categories);
  if (next !== rules) {
    writeVendors(next);
    tx.categorySource = 'manual';
  }
}

const readFinance = () =>
  normaliseFinance(JSON.parse(localStorage.getItem(planningKey) || '{}'));
const readPreferences = (): Preferences => ({
  ...initialPreferences,
  ...JSON.parse(localStorage.getItem(preferencesKey) || '{}'),
});

function restore(): Transaction[] {
  const existing = localStorage.getItem(storageKey);
  if (existing !== null) {
    const data: unknown = JSON.parse(existing);
    if (!Array.isArray(data)) {
      throw new Error('Could not read this browser’s demo records.');
    }
    return data
      .filter(
        (item): item is Transaction =>
          item?.demo === true &&
          typeof item.id === 'string' &&
          Number.isSafeInteger(item.amountPaise) &&
          typeof item.receivedAt === 'number',
      )
      .map(item => ({
        ...item,
        source: item.source === 'manual' ? 'manual' : 'sms',
        category: ['expense', 'lent', 'income', 'transfer'].includes(
          item.category,
        )
          ? item.category
          : 'expense',
        currency: item.currency || 'INR',
        expenseCategory: isExpenseCategory(item.expenseCategory)
          ? item.expenseCategory
          : 'uncategorised',
        remarks:
          typeof item.remarks === 'string' ? item.remarks.slice(0, 500) : '',
        location: item.location || null,
        locationStatus: item.location
          ? 'captured'
          : item.source === 'manual'
          ? 'manual'
          : 'sample',
      }));
  }
  const seeded = starterPayments.map((sample, index) => {
    const payment = parseDemo(sample.sender, sample.message)!;
    const when = new Date();
    when.setDate(when.getDate() - [0, 0, 1, 2, 3, 4, 6][index]);
    when.setHours(
      [10, 9, 18, 13, 16, 20, 11][index],
      [42, 18, 30, 12, 44, 8, 5][index],
      0,
      0,
    );
    // A morning preview must not seed payments later than the current time.
    const at = Math.min(when.getTime(), Date.now());
    return {
      ...payment,
      source: 'sms',
      id: `demo-seed-${index}`,
      receivedAt: at,
      transactionAt: null,
      autoSaveAt: at - 1,
      confirmed: true,
      category: 'expense',
      expenseCategory: [
        'food',
        'groceries',
        'travel',
        'clothes',
        'bills',
        'food',
        'other',
      ][index] as ExpenseCategory,
      remarks: '',
      demo: true,
      location: null,
      locationStatus: 'sample',
    } satisfies Transaction;
  });
  localStorage.setItem(storageKey, JSON.stringify(seeded));
  return seeded;
}

const write = (items: Transaction[]) =>
  localStorage.setItem(storageKey, JSON.stringify(items));

export const ledger = {
  async getVendorRules(_demo: boolean): Promise<VendorRule[]> {
    return Object.values(readVendors());
  },
  async editVendorRule(_demo: boolean, key: string, category: ExpenseCategory) {
    if (!isRememberable(category, readFinance().categories))
      throw Error('Choose an existing expense category.');
    const rules = readVendors();
    if (!Object.hasOwn(rules, key))
      throw Error('Vendor rule no longer exists.');
    writeVendors({ ...rules, [key]: { ...rules[key], category } });
  },
  async forgetVendorRule(_demo: boolean, key: string) {
    const rules = readVendors();
    delete rules[key];
    writeVendors(rules);
  },
  async clearVendorRules(_demo: boolean) {
    localStorage.removeItem(vendorKey);
  },
  async saveFinance(_demo: boolean, state: FinanceState) {
    localStorage.setItem(planningKey, JSON.stringify(state));
    const rules = readVendors();
    const kept = Object.fromEntries(
      Object.entries(rules).filter(([, rule]) =>
        isRememberable(rule.category, state.categories),
      ),
    );
    if (Object.keys(kept).length !== Object.keys(rules).length)
      writeVendors(kept);
  },
  async savePreferences(preferences: Preferences) {
    localStorage.setItem(
      preferencesKey,
      JSON.stringify({ ...preferences, appLock: false }),
    );
  },
  async editTransaction(input: Transaction, categorySelected = false) {
    const rows = restore();
    const old = rows.find(t => t.id === input.id);
    if (!old) throw Error('Entry no longer exists.');
    validateManual({
      amount: (input.amountPaise / 100).toFixed(2),
      method: input.method,
      recipient: input.recipient,
      category: input.category,
      expenseCategory: input.expenseCategory,
      remarks: input.remarks,
      occurredAt: input.transactionAt || input.receivedAt,
      demo: true,
    });
    const repayments = readFinance().repayments.filter(
      r => r.transactionId === input.id,
    );
    const repaid = repayments.reduce((s, r) => s + r.amount, 0);
    if (
      repaid &&
      (input.category !== 'lent' ||
        input.amountPaise < repaid ||
        repayments.some(r => r.at < (input.transactionAt || input.receivedAt)))
    )
      throw Error('Keep the repaid principal and original lending date.');
    const edited: Transaction = {
      ...old,
      ...input,
      source: old.source,
      currency: old.currency || 'INR',
      demo: true,
      confirmed: true,
      vendorName:
        old.vendorName ?? (old.source === 'sms' ? old.recipient : undefined),
    };
    learn(edited, categorySelected);
    write(rows.map(t => (t.id === input.id ? edited : t)));
  },
  async resetAllData() {
    write([]);
    localStorage.removeItem(vendorKey);
    localStorage.setItem(planningKey, JSON.stringify(initialFinance()));
    localStorage.setItem(preferencesKey, JSON.stringify(initialPreferences));
  },
  async authenticate() {
    throw Error('Device biometric/PIN unlock is available in the Android app.');
  },
  async requestNotifications() {
    return false;
  },
  async createManual(input: ManualExpense): Promise<Transaction> {
    const amountPaise = validateManual(input);
    const now = Date.now();
    const transaction: Transaction = {
      id: `manual-${crypto.randomUUID()}`,
      currency: input.currency || 'INR',
      source: 'manual',
      amountPaise,
      bank: 'Manual entry',
      account: '',
      reference: '',
      method: input.method,
      recipient: input.recipient.trim().slice(0, 100),
      category: input.category,
      expenseCategory: input.expenseCategory,
      remarks: input.remarks.trim().slice(0, 500),
      receivedAt: now,
      transactionAt: input.occurredAt,
      autoSaveAt: now,
      confirmed: true,
      demo: true,
      location: null,
      locationStatus: 'manual',
    };
    const match =
      input.category === 'expense' && !input.categorySelected
        ? remembered(transaction.recipient)
        : undefined;
    if (match) {
      transaction.expenseCategory = match;
      transaction.categorySource = 'vendor';
    }
    learn(transaction, !!input.categorySelected);
    write([transaction, ...restore()]);
    return transaction;
  },
  async getSnapshot(): Promise<Snapshot> {
    return {
      planning: { live: initialFinance(), demo: readFinance() },
      preferences: readPreferences(),
      transactions: restore().sort((a, b) => b.receivedAt - a.receivedAt),
      detectionEnabled: false,
      smsGranted: false,
      notificationsGranted: false,
      overlayGranted: false,
      nativeAvailable: false,
      locationEnabled: false,
      locationForegroundGranted: false,
      locationBackgroundGranted: false,
      locationServicesEnabled: false,
      smsDiagnostics: null,
    };
  },
  async ingestDemo(sender: string, message: string): Promise<DemoResult> {
    const parsed = parseDemo(sender, message);
    if (!parsed) {
      return {
        transaction: null,
        duplicate: false,
        reason: 'Message ignored. No supported successful debit found.',
      };
    }
    const now = Date.now();
    const transaction: Transaction = {
      ...parsed,
      source: 'sms',
      id: `demo-${crypto.randomUUID()}`,
      receivedAt: now,
      transactionAt: null,
      autoSaveAt: now + 5_000,
      confirmed: false,
      category: 'expense',
      expenseCategory: remembered(parsed.recipient) || 'uncategorised',
      vendorName: parsed.recipient,
      categorySource: remembered(parsed.recipient) ? 'vendor' : 'uncategorised',
      remarks: '',
      demo: true,
      location: null,
      locationStatus: 'sample',
    };
    write([transaction, ...restore()]);
    return { transaction, duplicate: false, reason: '' };
  },
  async updateTransaction(
    id: string,
    recipient: string,
    category: TransactionCategory,
    expenseCategory: ExpenseCategory,
    remarks: string,
    categorySelected = false,
  ) {
    if (!['expense', 'lent', 'income', 'transfer'].includes(category)) {
      throw new Error('Choose a supported transaction category.');
    }
    if (!isExpenseCategory(expenseCategory))
      throw new Error('Choose a supported expense category.');
    const rows = restore();
    const old = rows.find(item => item.id === id);
    if (!old) return;
    const tx: Transaction = {
      ...old,
      recipient: recipient.trim().slice(0, 100),
      category,
      expenseCategory,
      remarks: remarks.trim().slice(0, 500),
      confirmed: true,
      vendorName:
        old.vendorName ?? (old.source === 'sms' ? old.recipient : undefined),
    };
    learn(tx, categorySelected);
    write(rows.map(item => (item.id === id ? tx : item)));
  },
  async discardTransaction(id: string) {
    write(restore().filter(item => item.id !== id));
    localStorage.setItem(
      planningKey,
      JSON.stringify(removeTransactionState(readFinance(), id)),
    );
  },
  async clearTransactions(_demoOnly: boolean) {
    write([]);
    localStorage.setItem(
      planningKey,
      JSON.stringify({ ...readFinance(), repayments: [] }),
    );
  },
  async setDetectionEnabled(_enabled: boolean) {
    throw new Error('Live SMS detection is available in the Android app.');
  },
  async openOverlaySettings() {
    throw new Error('Install the Android app to enable floating prompts.');
  },
  async requestPermissions() {
    return false;
  },
  async requestLocationPermission() {
    return false;
  },
  async setLocationEnabled(_enabled: boolean) {
    throw new Error('Location capture is available in the Android app.');
  },
  async openLocationPermissionSettings() {
    throw new Error('Location settings require the Android app.');
  },
  async openDeviceLocationSettings() {
    throw new Error('Location settings require the Android app.');
  },
};
