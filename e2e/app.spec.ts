import { test, expect, type Page } from '@playwright/test';
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const readEntries = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('trace.browser-demo.v1') || '[]'),
  );
const readFinance = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('trace.finance.demo.v1') || '{}'),
  );
const readVendors = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('trace.vendor-rules.demo.v1') || '{}'),
  );
async function select(page: Page, label: string, value: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('radio', { name: value, exact: true }).click();
}
async function home(page: Page) {
  await page.getByRole('button', { name: 'Home', exact: true }).click();
}
async function add(
  page: Page,
  amount: string,
  name: string,
  type = 'Expense',
  category?: string,
) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  if (type !== 'Expense') await select(page, 'Transaction type', type);
  await page
    .getByRole('textbox', { name: 'Amount (INR)', exact: true })
    .fill(amount);
  await page
    .getByRole('textbox', {
      name:
        type === 'Income' ? 'Received from · optional' : 'Recipient · optional',
      exact: true,
    })
    .fill(name);
  if (category) await select(page, 'Category', category);
  await page
    .getByRole('button', {
      name: type === 'Income' ? 'Save income' : 'Save expense',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', {
      name: `Edit ${name} ₹${Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: Number(amount) % 1 ? 2 : 0,
        maximumFractionDigits: 2,
      })}`,
      exact: true,
    }),
  ).toBeVisible();
}
async function detection(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('button', { name: 'Payment detection', exact: true })
    .click();
}
async function popup(page: Page) {
  await detection(page);
  await page
    .getByRole('button', { name: 'Preview payment popup', exact: true })
    .click();
  await expect(page.getByTestId('incoming-payment-popup')).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Manage budgets', exact: true }),
  ).toBeVisible();
});
test('Home is graph-free, narrow-screen safe and exposes budget and savings shortcuts', async ({
  page,
}) => {
  await expect(
    page.getByRole('button', { name: 'View monthly expenses', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Spent today', { exact: true })).toBeVisible();
  await expect(page.locator('svg[viewBox="0 0 330 170"]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Savings goals', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Income not recorded', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/ux-v2/home-light.png' });
});
test('today spending updates after an entry, stays independent of the selected month and respects privacy', async ({
  page,
}) => {
  await add(page, '42.50', 'Today test expense');
  await home(page);
  const total = await page.evaluate(() => {
    const today = new Date().toDateString();
    return JSON.parse(localStorage.getItem('trace.browser-demo.v1') || '[]')
      .filter(
        (t: any) =>
          t.category === 'expense' &&
          (!t.currency || t.currency === 'INR') &&
          new Date(t.transactionAt ?? t.receivedAt).toDateString() === today,
      )
      .reduce((sum: number, t: any) => sum + t.amountPaise, 0);
  });
  const expected = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: total % 100 === 0 ? 0 : 2,
  }).format(total / 100);
  await expect(page.getByLabel("Today's expenses", { exact: true })).toHaveText(
    expected,
  );
  await page.getByRole('button', { name: 'Hide amounts', exact: true }).click();
  await expect(page.getByLabel('Monthly expenses', { exact: true })).toHaveText(
    '••••',
  );
  await expect(page.getByLabel("Today's expenses", { exact: true })).toHaveText(
    '••••',
  );
  await page.getByRole('button', { name: 'Show amounts', exact: true }).click();
  const now = new Date();
  await page
    .getByRole('button', {
      name: now.toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      }),
      exact: true,
    })
    .click();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  await page
    .getByRole('button', {
      name: previous.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      }),
      exact: true,
    })
    .click();
  await expect(page.getByLabel('Monthly expenses', { exact: true })).toHaveText(
    '₹0',
  );
  await expect(page.getByLabel("Today's expenses", { exact: true })).toHaveText(
    expected,
  );
});
test('monthly and category budgets persist and reset separately across months', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Manage budgets', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Set monthly budget', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Overall monthly limit', exact: true })
    .fill('30000');
  await page
    .getByRole('switch', { name: 'Use as monthly default', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await page
    .getByRole('button', { name: 'Set Food & drink budget', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Category monthly limit', exact: true })
    .fill('8000');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  let state = await readFinance(page);
  expect(state.months['INR:' + currentMonth()]).toMatchObject({
    budget: 3000000,
    limits: { food: 800000 },
  });
  expect(state.defaults.INR.budget).toBe(3000000);
  await page.reload();
  await home(page);
  await page
    .getByRole('button', { name: 'Manage budgets', exact: true })
    .click();
  await expect(
    page.getByText('₹30,000', { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Set Food & drink budget', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Category monthly limit', exact: true }),
  ).toHaveValue('8000');
  await page
    .getByRole('button', { name: 'Close Food & drink budget', exact: true })
    .click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/ux-v2/budgets.png' });
});
test('manual income, expenses and transfers produce correct totals after reload', async ({
  page,
}) => {
  const before = await readEntries(page),
    spent = before.reduce(
      (s: number, t: any) => s + (t.category === 'expense' ? t.amountPaise : 0),
      0,
    );
  await add(page, '60000', 'October salary', 'Income', 'Salary');
  await add(page, '787.34', 'Cash lunch', 'Expense', 'Food & drink');
  await add(page, '1000', 'Card repayment', 'Own transfer / card bill');
  await page.reload();
  await home(page);
  await expect(page.getByLabel('Monthly expenses', { exact: true })).toHaveText(
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format((spent + 78734) / 100),
  );
  const rows = await readEntries(page);
  expect(rows.find((t: any) => t.recipient === 'October salary')).toMatchObject(
    { category: 'income', amountPaise: 6000000 },
  );
  expect(rows.find((t: any) => t.recipient === 'Cash lunch')).toMatchObject({
    category: 'expense',
    amountPaise: 78734,
    expenseCategory: 'food',
    method: 'CASH',
  });
  expect(rows.find((t: any) => t.recipient === 'Card repayment').category).toBe(
    'transfer',
  );
});
test('savings goals and contributions persist without increasing spending', async ({
  page,
}) => {
  const before = (await readEntries(page)).length;
  await page
    .getByRole('button', { name: 'Savings goals', exact: true })
    .click();
  await page.getByRole('button', { name: 'New goal', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Goal name', exact: true })
    .fill('Laptop');
  await page
    .getByRole('textbox', { name: 'Goal target amount', exact: true })
    .fill('80000');
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open Laptop goal', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Add contribution', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Contribution amount', exact: true })
    .fill('24000');
  await page
    .getByRole('button', { name: 'Save contribution', exact: true })
    .click();
  expect((await readEntries(page)).length).toBe(before);
  await page.reload();
  await page
    .getByRole('button', { name: 'Savings goals', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open Laptop goal', exact: true })
    .click();
  await expect(page.getByText('30% complete', { exact: true })).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/ux-v2/savings-goal.png' });
  const state = await readFinance(page);
  expect(state.goals[0]).toMatchObject({ name: 'Laptop', target: 8000000 });
  expect(state.contributions[0].amount).toBe(2400000);
});
test('custom categories appear in forms and persist with exact transaction metadata', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page
    .getByRole('button', { name: 'Create custom category', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Category name', exact: true })
    .fill('Pets');
  await page
    .getByRole('button', { name: 'Save category', exact: true })
    .click();
  await add(page, '250', 'Pet store', 'Expense', 'Pets');
  await page
    .getByRole('button', { name: 'Edit Pet store ₹250', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Edit transaction', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Remarks · optional', exact: true })
    .fill('Monthly pet food');
  await select(page, 'Payment method', 'Credit card');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.reload();
  const rows = await readEntries(page);
  expect(rows.find((t: any) => t.recipient === 'Pet store')).toMatchObject({
    amountPaise: 25000,
    remarks: 'Monthly pet food',
    method: 'CREDIT_CARD',
  });
  expect(
    rows.find((t: any) => t.recipient === 'Pet store').expenseCategory,
  ).toMatch(/^custom_/);
});
test('lending supports partial repayments, rejects overpayment, and stays out of spending', async ({
  page,
}) => {
  await add(page, '3500', 'Arjun', 'Lent money');
  await home(page);
  await page
    .getByRole('button', { name: 'Money owed to you', exact: true })
    .click();
  await page.getByRole('button').filter({ hasText: 'Arjun' }).click();
  await page
    .getByRole('button', { name: 'Record a repayment', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Repayment amount', exact: true })
    .fill('4000');
  await page
    .getByRole('button', { name: 'Save repayment', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('cannot exceed');
  await page
    .getByRole('textbox', { name: 'Repayment amount', exact: true })
    .fill('1000');
  await page
    .getByRole('button', { name: 'Save repayment', exact: true })
    .click();
  await expect(page.getByText('₹2,500', { exact: true })).toBeVisible();
  await page.reload();
  await home(page);
  await page
    .getByRole('button', { name: 'Money owed to you', exact: true })
    .click();
  await expect(
    page.getByLabel('Total outstanding', { exact: true }),
  ).toHaveText('₹2,500');
  const state = await readFinance(page);
  expect(state.repayments).toHaveLength(1);
  expect(state.repayments[0].amount).toBe(100000);
});
test('discard requires confirmation and cancelling preserves the entry', async ({
  page,
}) => {
  await add(page, '123', 'Example discard');
  await page
    .getByRole('button', { name: 'Edit Example discard ₹123', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Discard entry', exact: true })
    .click();
  await expect(
    page.getByText('Discard this entry?', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep entry', exact: true }).click();
  expect(
    (await readEntries(page)).some(
      (t: any) => t.recipient === 'Example discard',
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Discard entry', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Discard entry', exact: true })
    .last()
    .click();
  await expect
    .poll(async () =>
      (
        await readEntries(page)
      ).some((t: any) => t.recipient === 'Example discard'),
    )
    .toBe(false);
});
test('theme preference survives reload and currency selection does not relabel old records', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('trace.preferences.v1') || '{}').theme,
    ),
  ).toBe('dark');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('button')
    .filter({ hasText: 'Your profile' })
    .first()
    .click();
  await select(page, 'Currency', 'US dollar · USD ($)');
  await home(page);
  await expect(page.getByLabel('Monthly expenses', { exact: true })).toHaveText(
    'US$0',
  );
  const rows = await readEntries(page);
  expect(rows.every((t: any) => !t.currency || t.currency === 'INR')).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('button')
    .filter({ hasText: 'Your profile' })
    .first()
    .click();
  await select(page, 'Currency', 'Indian rupee · INR (₹)');
  await home(page);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/ux-v2/home-dark.png' });
});
test('history searches remarks and filters by method/type/date', async ({
  page,
}) => {
  await add(page, '321.50', 'Example search');
  await page
    .getByRole('button', { name: 'Edit Example search ₹321.50', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Edit transaction', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Remarks · optional', exact: true })
    .fill('Unique reimbursement note');
  await select(page, 'Payment method', 'Debit card');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Search transactions', exact: true })
    .fill('reimbursement');
  await expect(
    page.getByRole('button', {
      name: 'Edit Example search ₹321.50',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Filters & sort', exact: true })
    .click();
  await select(page, 'Filter payment method', 'UPI');
  await expect(
    page.getByText('No matching entries', { exact: true }),
  ).toBeVisible();
  await select(page, 'Filter payment method', 'Debit card');
  await expect(
    page.getByRole('button', {
      name: 'Edit Example search ₹321.50',
      exact: true,
    }),
  ).toBeVisible();
});
test('analytics renders actual daily/weekly/monthly data and empty month comparisons', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Spending trend. Tap or drag to explore payments.',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Weekly', exact: true }).click();
  await page.getByRole('button', { name: 'Monthly', exact: true }).click();
  await page.getByRole('tab', { name: 'Compare', exact: true }).click();
  await page
    .getByRole('button', { name: 'Budget vs actual', exact: true })
    .click();
  await expect(
    page.getByText('Budget vs actual', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Compare', exact: true }).click();
  await expect(
    page.getByText(/A comparison needs two months with recorded expenses/),
  ).toBeVisible();
});
test('budget threshold warnings can be disabled without changing the ledger', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Manage budgets', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Set monthly budget', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Overall monthly limit', exact: true })
    .fill('100');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await home(page);
  await expect(page.getByText(/Monthly budget: \d+% used/)).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('button', { name: 'Budget alerts', exact: true })
    .click();
  await page
    .getByRole('switch', { name: 'Budget alerts', exact: true })
    .click();
  await home(page);
  await expect(page.getByText(/Monthly budget: \d+% used/)).toHaveCount(0);
});
test('compact popup animates at the bottom and can be dismissed without deleting payment', async ({
  page,
}) => {
  const before = (await readEntries(page)).length;
  await popup(page);
  await expect(
    page.getByRole('button', { name: 'Show payment details', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Popup remarks', exact: true }),
  ).toHaveCount(0);
  await page.waitForTimeout(550);
  const r = (await page.getByTestId('incoming-payment-popup').boundingBox())!;
  expect(r.y).toBeGreaterThan(500);
  expect(r.height).toBeLessThan(250);
  await page.screenshot({ path: 'artifacts/ux-v2/payment-popup-compact.png' });
  await page.mouse.click(15, 120);
  await expect(page.getByTestId('incoming-payment-popup')).toHaveCount(0);
  expect((await readEntries(page)).length).toBe(before + 1);
});
test('popup optional edits extend time, category selection pauses it and Save persists', async ({
  page,
}) => {
  await page.clock.install();
  await popup(page);
  await page
    .getByRole('button', { name: 'Show payment details', exact: true })
    .click();
  await page.clock.runFor(350);
  await page
    .getByRole('textbox', { name: 'Popup remarks', exact: true })
    .fill('Dinner with friends');
  await page
    .getByRole('button', { name: 'Choose popup category', exact: true })
    .click();
  await page.clock.fastForward(15000);
  await expect(page.getByTestId('incoming-payment-popup')).toBeVisible();
  await page.getByRole('radio', { name: 'Food', exact: true }).click();
  await page.clock.fastForward(6000);
  await expect(page.getByTestId('incoming-payment-popup')).toBeVisible();
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await page.clock.runFor(400);
  await expect(page.getByTestId('incoming-payment-popup')).toHaveCount(0);
  const rows = await readEntries(page);
  expect(rows[0]).toMatchObject({
    remarks: 'Dinner with friends',
    expenseCategory: 'food',
  });
});
test('untouched payment popup closes automatically and retains the captured amount', async ({
  page,
}) => {
  await page.clock.install();
  await popup(page);
  await page.clock.runFor(5500);
  await expect(page.getByTestId('incoming-payment-popup')).toHaveCount(0);
  const rows = await readEntries(page);
  expect(rows[0]).toMatchObject({
    amountPaise: 24000,
    remarks: '',
    expenseCategory: 'uncategorised',
  });
});

test('custom analytics dates filter the actual trend and total, including a one-day range', async ({
  page,
}) => {
  const today = new Date(),
    key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(today.getDate()).padStart(2, '0')}`;
  const rows = await readEntries(page);
  const expected = rows
    .filter(
      (t: any) =>
        t.category === 'expense' &&
        new Date(t.transactionAt || t.receivedAt).toDateString() ===
          today.toDateString(),
    )
    .reduce((n: number, t: any) => n + t.amountPaise, 0);
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await page
    .getByRole('button', { name: 'Choose analytics date range', exact: true })
    .click();
  await page
    .getByLabel('Analytics from date (YYYY-MM-DD)', { exact: true })
    .fill(key);
  await page
    .getByLabel('Analytics to date (YYYY-MM-DD)', { exact: true })
    .fill(key);
  await page
    .getByRole('button', { name: 'Apply date range', exact: true })
    .click();
  await expect(
    page.getByLabel('Spending in selected range', { exact: true }),
  ).toHaveText(
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: expected % 100 ? 2 : 0,
    }).format(expected / 100),
  );
  await expect(
    page.getByRole('button', {
      name: 'Spending trend. Tap or drag to explore payments.',
      exact: true,
    }),
  ).toBeVisible();
});

test('dashboard sections drill into the right records and glass feedback respects reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(
    page
      .getByTestId('savings-goal-row')
      .getByRole('button', { name: 'Savings goals', exact: true }),
  ).toBeVisible();
  const card = page.getByTestId('monthly-expense-card');
  const bounds = await card.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 24);
  await page.mouse.down();
  await expect
    .poll(() =>
      page
        .getByTestId('monthly-expense-card-glass')
        .evaluate(el => Number(getComputedStyle(el).opacity)),
    )
    .toBeGreaterThan(0.9);
  const transform = await card.evaluate(
    el => getComputedStyle(el.parentElement!).transform,
  );
  expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(
    true,
  );
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: 'Type', exact: true }),
  ).toContainText('Expense');
  await home(page);
  await page
    .getByRole('button', { name: "View today's expenses", exact: true })
    .click();
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(now.getDate()).padStart(2, '0')}`;
  await expect(
    page.getByLabel('From date · optional (YYYY-MM-DD)', { exact: true }),
  ).toHaveValue(key);
  await expect(
    page.getByLabel('To date · optional (YYYY-MM-DD)', { exact: true }),
  ).toHaveValue(key);
  await home(page);
  await page
    .getByRole('button', { name: 'View monthly income', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Save income', exact: true }),
  ).toBeVisible();
});

test('today total rolls over at local midnight while the monthly total stays unchanged', async ({
  page,
}) => {
  await page.clock.install({ time: new Date(2026, 9, 24, 23, 59, 58) });
  await page.evaluate(() => localStorage.removeItem('trace.browser-demo.v1'));
  await page.reload();
  const monthly = await page
    .getByLabel('Monthly expenses', { exact: true })
    .textContent();
  await expect(
    page.getByLabel("Today's expenses", { exact: true }),
  ).not.toHaveText('₹0');
  await page.clock.fastForward(2500);
  await expect(page.getByLabel("Today's expenses", { exact: true })).toHaveText(
    '₹0',
  );
  await expect(page.getByLabel('Monthly expenses', { exact: true })).toHaveText(
    monthly!,
  );
  await expect(
    page.getByText(
      new Date(2026, 9, 25).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      { exact: true },
    ),
  ).toBeVisible();
});

test('large expense amounts remain usable on a narrow phone and empty months retain setup actions', async ({
  page,
}) => {
  await add(page, '99999999.99', 'Large synthetic expense');
  await page.setViewportSize({ width: 320, height: 780 });
  await home(page);
  await expect(
    page.getByLabel('Monthly expenses', { exact: true }),
  ).toBeVisible();
  const fits = await page
    .getByLabel('Monthly expenses', { exact: true })
    .evaluate(el => el.scrollWidth <= el.clientWidth + 1);
  expect(fits).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page
    .getByRole('button', { name: 'Manage budgets', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Set monthly budget', exact: true }),
  ).toBeVisible();
});

test('vendor memory starts only after manual selection and repeat popups keep the selected category', async ({
  page,
}) => {
  await page.clock.install();
  await popup(page);
  await page.clock.runFor(5500);
  expect(await readVendors(page)).toEqual({});
  expect((await readEntries(page))[0].expenseCategory).toBe('uncategorised');
  await popup(page);
  await page
    .getByRole('button', { name: 'Show payment details', exact: true })
    .click();
  await page.clock.runFor(350);
  await page
    .getByRole('button', { name: 'Choose popup category', exact: true })
    .click();
  await page.getByRole('radio', { name: 'Groceries', exact: true }).click();
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await page.clock.runFor(400);
  const learned = await readVendors(page);
  expect(Object.keys(learned)).toEqual(['blue tokai']);
  expect(learned['blue tokai'].category).toBe('groceries');
  await popup(page);
  await expect(page.getByLabel('Payment category', { exact: true })).toHaveText(
    'Groceries · Remembered',
  );
  await page.clock.runFor(5500);
  await expect(page.getByTestId('incoming-payment-popup')).toHaveCount(0);
  expect((await readEntries(page))[0]).toMatchObject({
    expenseCategory: 'groceries',
    categorySource: 'vendor',
  });
  expect(await readVendors(page)).toEqual(learned);
  await page.reload();
  await popup(page);
  await expect(
    page.getByLabel('Payment category', { exact: true }),
  ).toContainText('Groceries');
  await page.clock.runFor(5500);
  const entries = await readEntries(page);
  expect(
    entries.filter((t: any) => t.expenseCategory === 'uncategorised'),
  ).not.toHaveLength(0);
});

test('history selection creates vendor memory; remarks and display-name edits alone do not', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page
    .getByRole('button', { name: 'Edit Blue Tokai ₹240', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Edit transaction', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Remarks · optional', exact: true })
    .fill('Just a note');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(await readVendors(page)).toEqual({});
  await page
    .getByRole('button', { name: 'Edit Blue Tokai ₹240', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Edit transaction', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Recipient · optional', exact: true })
    .fill('My coffee shop');
  await select(page, 'Category', 'Groceries');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect((await readVendors(page))['blue tokai'].category).toBe('groceries');
  expect((await readVendors(page))['my coffee shop']).toBeUndefined();
  await popup(page);
  await expect(
    page.getByLabel('Payment category', { exact: true }),
  ).toContainText('Groceries');
});

test('remembered vendors can be edited and forgotten without changing history', async ({
  page,
}) => {
  await add(page, '64', 'Sharma Stores', 'Expense', 'Groceries');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('button', { name: 'Remembered vendors', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Sharma Stores', exact: true })
    .click();
  await select(page, 'Remembered category', 'Health');
  await page
    .getByRole('button', { name: 'Save vendor category', exact: true })
    .click();
  expect((await readVendors(page))['sharma stores'].category).toBe('health');
  expect((await readEntries(page))[0].expenseCategory).toBe('groceries');
  await page
    .getByRole('button', { name: 'Sharma Stores', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Forget vendor', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Forget this vendor', exact: true })
    .click();
  await expect(
    page.getByText('No remembered vendors yet', { exact: true }),
  ).toBeVisible();
  expect(await readVendors(page)).toEqual({});
  expect((await readEntries(page))[0].recipient).toBe('Sharma Stores');
});

test('deleting a custom category removes its vendor rules while deleting a transaction keeps them', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page
    .getByRole('button', { name: 'Create custom category', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Category name', exact: true })
    .fill('Supplies');
  await page
    .getByRole('button', { name: 'Save category', exact: true })
    .click();
  await add(page, '64', 'Supply shop', 'Expense', 'Supplies');
  expect(Object.keys(await readVendors(page))).toHaveLength(1);
  await page
    .getByRole('button', { name: 'Edit Supply shop ₹64', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Discard entry', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Discard entry', exact: true })
    .last()
    .click();
  expect(Object.keys(await readVendors(page))).toHaveLength(1);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByRole('button', { name: 'Supplies', exact: true }).click();
  await page
    .getByRole('button', { name: 'Delete custom category', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Delete category', exact: true })
    .click();
  expect(await readVendors(page)).toEqual({});
});

test('clearing vendor memory preserves transactions and full data reset removes all memory', async ({
  page,
}) => {
  await add(page, '64', 'Sharma Stores', 'Expense', 'Groceries');
  const count = (await readEntries(page)).length;
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('button', { name: 'Remembered vendors', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Clear remembered vendors', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Clear vendor memory', exact: true })
    .click();
  expect(await readVendors(page)).toEqual({});
  expect((await readEntries(page)).length).toBe(count);
  await add(page, '50', 'Other Store', 'Expense', 'Groceries');
  expect(Object.keys(await readVendors(page))).toHaveLength(1);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('button', { name: 'Data & storage', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reset all local data', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reset local data', exact: true })
    .click();
  expect(await readVendors(page)).toEqual({});
  expect(await readEntries(page)).toEqual([]);
});
