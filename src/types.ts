export type PaymentMethod =
  | 'UPI'
  | 'CARD'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'BANK'
  | 'CASH';
export type TransactionCategory = 'expense' | 'lent' | 'income' | 'transfer';

export type Transaction = {
  id: string;
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
  source: 'sms' | 'manual';
  amountPaise: number;
  bank: string;
  account: string;
  method: PaymentMethod;
  recipient: string;
  vendorName?: string;
  categorySource?: 'vendor' | 'manual' | 'uncategorised';
  category: TransactionCategory;
  expenseCategory: ExpenseCategory;
  remarks: string;
  reference: string;
  receivedAt: number;
  transactionAt: number | null;
  autoSaveAt: number;
  confirmed: boolean;
  demo: boolean;
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAt: number;
    fixAt: number;
    approximate: boolean;
    source: 'sms_receipt';
  } | null;
  locationStatus: string;
};

export type Snapshot = {
  transactions: Transaction[];
  planning?: {
    live: import('./finance/model').FinanceState;
    demo: import('./finance/model').FinanceState;
  };
  preferences?: import('./finance/model').Preferences;
  launchRoute?: {
    screen: string;
    month: string;
    currency: import('./finance/model').Currency;
    category: string;
  };
  detectionEnabled: boolean;
  smsGranted: boolean;
  notificationsGranted: boolean;
  overlayGranted: boolean;
  nativeAvailable: boolean;
  locationEnabled: boolean;
  locationForegroundGranted: boolean;
  locationBackgroundGranted: boolean;
  locationServicesEnabled: boolean;
  smsDiagnostics: {
    receivedCount: number;
    lastReceivedAt: number | null;
    lastResult: string;
  } | null;
};

export type DemoResult = {
  transaction: Transaction | null;
  duplicate: boolean;
  reason: string;
};
import type { ExpenseCategory } from './categories';

export type ManualExpense = {
  categorySelected?: boolean;
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
  amount: string;
  method: PaymentMethod;
  recipient: string;
  category: TransactionCategory;
  expenseCategory: ExpenseCategory;
  remarks: string;
  occurredAt: number;
  demo: boolean;
};
export type VendorRule = {
  key: string;
  name: string;
  category: ExpenseCategory;
};
export const transactionTime = (item: Transaction) =>
  item.transactionAt ?? item.receivedAt;
