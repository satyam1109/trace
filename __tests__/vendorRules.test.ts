import { learnVendor, normaliseVendor } from '../src/services/vendorRules';
import type { Transaction, VendorRule } from '../src/types';

const tx = (patch: Partial<Transaction> = {}): Transaction => ({
  id: 'test',
  source: 'sms',
  recipient: 'Sharma Stores',
  vendorName: 'Sharma Stores',
  category: 'expense',
  expenseCategory: 'groceries',
  amountPaise: 6400,
  bank: 'HDFC Bank',
  account: '1234',
  method: 'UPI',
  remarks: '',
  reference: '123456',
  receivedAt: 0,
  transactionAt: null,
  autoSaveAt: 0,
  confirmed: false,
  demo: true,
  location: null,
  locationStatus: 'sample',
  ...patch,
});
test('normalisation matches case and repeated Unicode spaces, preserving identifiers', () => {
  expect(normaliseVendor('  SHARMA\u00a0 STORES\t  12 ')).toBe(
    'sharma stores 12',
  );
  expect(normaliseVendor('NJ*Sharma-12@UPI')).toBe('nj*sharma-12@upi');
  expect(normaliseVendor('Sharma 12')).not.toBe(normaliseVendor('Sharma 21'));
  expect(normaliseVendor('Sharma Medical')).not.toBe(
    normaliseVendor('Sharma Stores'),
  );
});
test.each([
  [false, {}],
  [true, { expenseCategory: 'uncategorised' }],
  [true, { vendorName: '' }],
  [true, { category: 'lent' }],
  [true, { category: 'income', expenseCategory: 'income_salary' }],
  [true, { expenseCategory: 'custom_deleted' }],
] as [boolean, Partial<Transaction>][])(
  'only an explicit valid expense selection creates memory: %p %p',
  (selected, patch) => {
    const rules = {};
    expect(learnVendor(rules, tx(patch), selected, [])).toBe(rules);
  },
);
test('manual selection upserts one rule; automatic selections cannot overwrite or recreate it', () => {
  let rules: Record<string, VendorRule> = learnVendor({}, tx(), true, []);
  expect(Object.keys(rules)).toEqual(['sharma stores']);
  expect(learnVendor(rules, tx({ expenseCategory: 'food' }), false, [])).toBe(
    rules,
  );
  rules = learnVendor(
    rules,
    tx({ vendorName: ' SHARMA  STORES ', expenseCategory: 'food' }),
    true,
    [],
  );
  expect(Object.keys(rules)).toHaveLength(1);
  expect(rules['sharma stores'].category).toBe('food');
  expect(learnVendor({}, tx(), false, [])).toEqual({});
});
test('display-name changes keep the original SMS identity; manual expenses use the entered name', () => {
  expect(
    Object.keys(
      learnVendor({}, tx({ recipient: 'My grocery shop' }), true, []),
    ),
  ).toEqual(['sharma stores']);
  expect(
    Object.keys(
      learnVendor(
        {},
        tx({ source: 'manual', recipient: 'Other shop' }),
        true,
        [],
      ),
    ),
  ).toEqual(['other shop']);
});
test('custom categories must exist and sample history is never learned implicitly', () => {
  expect(
    learnVendor({}, tx({ expenseCategory: 'custom_supplies' }), true, [
      { id: 'custom_supplies' },
    ])['sharma stores'].category,
  ).toBe('custom_supplies');
  expect(learnVendor({}, tx({ confirmed: true }), false, [])).toEqual({});
});
