export const expenseCategories = [
  { value: 'uncategorised', label: 'Expense' },
  { value: 'food', label: 'Food' },
  { value: 'clothes', label: 'Clothes' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'travel', label: 'Travel' },
  { value: 'bills', label: 'Bills & utilities' },
  { value: 'health', label: 'Health' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
] as const;

export type ExpenseCategory =
  | (typeof expenseCategories)[number]['value']
  | `custom_${string}`
  | 'income_salary'
  | 'income_freelance'
  | 'income_other';
export const isExpenseCategory = (value: unknown): value is ExpenseCategory =>
  expenseCategories.some(option => option.value === value) ||
  (typeof value === 'string' &&
    /^(custom_[a-z0-9_-]{1,64}|income_(salary|freelance|other))$/.test(value));
export const expenseCategoryLabel = (value: ExpenseCategory) =>
  expenseCategories.find(option => option.value === value)?.label || 'Expense';
