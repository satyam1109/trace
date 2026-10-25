import type { Transaction, VendorRule } from '../types';
import type { ExpenseCategory } from '../categories';

// Mirror VendorIdentity.kt. Preserve punctuation, meaningful words and numbers.
export const normaliseVendor = (name: string) =>
  name
    .replace(/[\s\p{Z}]+/gu, ' ')
    .trim()
    .toLowerCase();

export function vendorFor(tx: Transaction): string {
  return tx.source === 'manual' ? tx.recipient : tx.vendorName ?? tx.recipient;
}
export function isRememberable(
  category: string,
  custom: { id: string }[],
): category is ExpenseCategory {
  return (
    [
      'food',
      'clothes',
      'groceries',
      'travel',
      'bills',
      'health',
      'entertainment',
      'other',
    ].includes(category) || custom.some(c => c.id === category)
  );
}
/** Browser demo only. Android uses indexed, keyed lookups and encrypted Room rows. */
export function learnVendor(
  rules: Record<string, VendorRule>,
  tx: Transaction,
  selected: boolean,
  custom: { id: string }[],
): Record<string, VendorRule> {
  const name = vendorFor(tx),
    key = normaliseVendor(name);
  if (
    !selected ||
    tx.category !== 'expense' ||
    !key ||
    !isRememberable(tx.expenseCategory, custom)
  )
    return rules;
  return {
    ...rules,
    [key]: {
      key,
      name: name.trim().slice(0, 100),
      category: tx.expenseCategory,
    },
  };
}
