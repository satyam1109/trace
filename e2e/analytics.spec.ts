import { test, expect, type Page } from '@playwright/test';
async function setup(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date(2026, 9, 25, 18) });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Manage budgets', exact: true })
    .waitFor();
  await page.evaluate(() => {
    const template = JSON.parse(
      localStorage.getItem('trace.browser-demo.v1')!,
    )[0];
    const rows = [
      ['2026-10-01', 5000, 'Target early'],
      ['2026-10-25', 10000, 'Target today'],
      ['2026-10-26', 90000, 'Future target'],
      ['2026-09-01', 10000, 'Baseline early'],
      ['2026-09-30', 90000, 'Baseline final day'],
      ['2026-08-20', 20000, 'Manual target'],
      ['2026-08-30', 90000, 'After manual cutoff'],
      ['2026-06-30', 40000, 'Manual baseline final day'],
    ].map(([date, amountPaise, recipient]) => ({
      ...template,
      id: String(recipient),
      receivedAt: new Date(date + 'T12:00:00').getTime(),
      transactionAt: new Date(date + 'T12:00:00').getTime(),
      amountPaise,
      recipient,
      category: 'expense',
      expenseCategory: 'groceries',
    }));
    rows.push({
      ...rows[0],
      id: 'income',
      category: 'income',
      expenseCategory: 'income_salary',
      amountPaise: 100000,
      recipient: 'Salary',
    });
    rows.push({
      ...rows[3],
      id: 'foreign',
      currency: 'USD',
      amountPaise: 500000,
      recipient: 'USD expense',
    });
    rows.push({
      ...rows[3],
      id: 'lent',
      category: 'lent',
      amountPaise: 700000,
      recipient: 'Lending',
    });
    rows.push({
      ...rows[3],
      id: 'transfer',
      category: 'transfer',
      amountPaise: 800000,
      recipient: 'Card bill',
    });
    localStorage.setItem('trace.browser-demo.v1', JSON.stringify(rows));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await page.clock.runFor(250);
}
test('Compare includes a full baseline month and applies independent manual month selections', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('tab', { name: 'Compare', exact: true }).click();
  await expect(
    page.getByLabel('Comparison target spending', { exact: true }),
  ).toHaveText('₹150');
  await expect(
    page.getByRole('button', { name: 'View Sept 2026 payments', exact: true }),
  ).toContainText('₹1,000');
  await expect(
    page.getByRole('button', { name: 'Choose comparison month', exact: true }),
  ).toContainText('1–30 Sept 2026');
  await expect(
    page.getByRole('button', { name: 'Choose spending month', exact: true }),
  ).toContainText('1–25 Oct 2026');
  await page
    .getByRole('button', { name: 'Choose comparison month', exact: true })
    .click();
  await page.getByRole('button', { name: 'June 2026', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'View Jun 2026 payments', exact: true }),
  ).toContainText('₹400');
  await page
    .getByRole('button', { name: 'Choose spending month', exact: true })
    .click();
  await page.getByRole('button', { name: 'August 2026', exact: true }).click();
  await expect(
    page.getByRole('tab', { name: 'Compare', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByLabel('Comparison target spending', { exact: true }),
  ).toHaveText('₹200');
  await expect(
    page.getByRole('button', { name: 'Choose spending month', exact: true }),
  ).toContainText('1–25 Aug 2026');
  await expect(
    page.getByRole('button', { name: 'Choose comparison month', exact: true }),
  ).toContainText('1–30 Jun 2026');
});
test('category comparison drills into the full baseline month rather than the header month', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('tab', { name: 'Compare', exact: true }).click();
  await page
    .getByRole('button', { name: 'Compare Groceries', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'View comparison month payments',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'View comparison month payments',
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel('From date · optional (YYYY-MM-DD)', { exact: true }),
  ).toHaveValue('2026-09-01');
  await expect(
    page.getByLabel('To date · optional (YYYY-MM-DD)', { exact: true }),
  ).toHaveValue('2026-09-30');
  await expect(
    page.getByRole('button', {
      name: 'Edit Baseline final day ₹900',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Edit Target today ₹100', exact: true }),
  ).toHaveCount(0);
});
test('Categories exposes vendor details and selected-range payments while remaining narrow-screen safe', async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('tab', { name: 'Categories', exact: true }).click();
  await expect(
    page.getByLabel('Category spending total', { exact: true }),
  ).toHaveText('₹150');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page
    .getByRole('button', { name: 'Explore Groceries spending', exact: true })
    .click();
  await expect(page.getByText('Target today', { exact: true })).toBeVisible();
  await expect(page.getByText('Future target', { exact: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'View category payments', exact: true })
    .click();
  await expect(
    page.getByLabel('From date · optional (YYYY-MM-DD)', { exact: true }),
  ).toHaveValue('2026-10-01');
  await expect(
    page.getByLabel('To date · optional (YYYY-MM-DD)', { exact: true }),
  ).toHaveValue('2026-10-25');
});
test('trend exploration reveals a value and opens the selected day', async ({
  page,
}) => {
  await setup(page);
  const chart = page.getByRole('button', {
    name: 'Spending trend. Tap or drag to explore payments.',
    exact: true,
  });
  const rect = await chart.boundingBox();
  await chart.click({ position: { x: rect!.width - 8, y: 85 } });
  await page
    .getByRole('button', { name: 'View selected period payments', exact: true })
    .click();
  await expect(
    page.getByLabel('From date · optional (YYYY-MM-DD)', { exact: true }),
  ).toHaveValue('2026-10-25');
  await expect(
    page.getByLabel('To date · optional (YYYY-MM-DD)', { exact: true }),
  ).toHaveValue('2026-10-25');
  await expect(
    page.getByRole('button', { name: 'Edit Target today ₹100', exact: true }),
  ).toBeVisible();
});
test('current-day rollover updates the target cutoff and missing income stays unrecorded', async ({
  page,
}) => {
  await setup(page);
  await page.clock.setSystemTime(new Date(2026, 9, 25, 23, 59, 58));
  // Reload to schedule the local-midnight refresh against the new clock.
  await page.reload();
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await page.getByRole('tab', { name: 'Compare', exact: true }).click();
  await page.clock.runFor(2500);
  await expect(
    page.getByRole('button', { name: 'Choose spending month', exact: true }),
  ).toContainText('1–26 Oct 2026');
  await expect(
    page.getByLabel('Comparison target spending', { exact: true }),
  ).toHaveText('₹150');
  await page
    .getByRole('button', { name: 'Income & surplus', exact: true })
    .click();
  await expect(
    page.getByText('Income not recorded', { exact: true }),
  ).toBeVisible();
});

test('donut segments select the category under the pointer, not the SVG child origin', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('trace.browser-demo.v1')!);
    rows.find((t: any) => t.id === 'Target today').expenseCategory = 'travel';
    localStorage.setItem('trace.browser-demo.v1', JSON.stringify(rows));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await page.getByRole('tab', { name: 'Categories', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Explore Travel spending', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Spending by category. Tap a segment to explore.',
      exact: true,
    })
    .click({ position: { x: 43, y: 130 } });
  await expect(
    page.getByRole('button', {
      name: 'Explore Groceries spending',
      exact: true,
    }),
  ).toBeVisible();
});
