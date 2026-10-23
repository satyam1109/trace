import { isExpenseCategory } from '../categories';
import type { ManualExpense } from '../types';

export function validateManual(input: ManualExpense): number {
  const text = input.amount.trim();
  if (!/^[0-9]{1,9}(?:\.[0-9]{1,2})?$/.test(text))
    throw new Error('Enter an amount with up to two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount <= 0 || amount > 10_000_000_000)
    throw new Error('Enter an amount between ₹0.01 and ₹10,00,00,000.');
  if (
    !['CASH', 'UPI', 'CARD', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK'].includes(
      input.method,
    )
  )
    throw new Error('Choose a supported payment method.');
  if (
    !['expense', 'lent', 'income', 'transfer'].includes(input.category) ||
    !isExpenseCategory(input.expenseCategory)
  )
    throw new Error('Choose a supported category.');
  if (
    !Number.isSafeInteger(input.occurredAt) ||
    input.occurredAt < 946684800000 ||
    input.occurredAt > Date.now()
  )
    throw new Error('Choose a past or current payment time.');
  return amount;
}

export function localPaymentTime(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw new Error('Use YYYY-MM-DD for the date and HH:mm for the time.');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute
  )
    throw new Error('Enter a valid payment date and time.');
  return value.getTime();
}
