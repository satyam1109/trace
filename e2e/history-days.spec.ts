import { test, expect, type Page } from '@playwright/test';

test.use({ timezoneId: 'Asia/Kolkata' });
async function setup(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-30T18:00:00+05:30') });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Manage budgets', exact: true })
    .waitFor();
  await page.evaluate(() => {
    const template = JSON.parse(
      localStorage.getItem('trace.browser-demo.v1')!,
    )[0];
    const rows = [
      ['morning', '2026-10-30T00:05:00+05:30', 20000, 'Morning shop', 'food'],
      ['noon', '2026-10-30T12:00:00+05:30', 5000, 'Noon shop', 'groceries'],
      ['delayed', '2026-10-29T23:58:00+05:30', 30000, 'Late shop', 'groceries'],
      ['older', '2026-10-28T09:00:00+05:30', 7500, 'Older shop', 'food'],
      ['previous', '2026-09-30T09:00:00+05:30', 1000, 'Previous shop', 'food'],
    ].map(([id, date, amountPaise, recipient, expenseCategory]) => ({
      ...template,
      id,
      recipient,
      amountPaise,
      expenseCategory,
      category: 'expense',
      currency: 'INR',
      receivedAt: Date.now(),
      transactionAt: new Date(String(date)).getTime(),
    }));
    rows.push({
      ...rows[0],
      id: 'foreign',
      currency: 'USD',
      recipient: 'Foreign shop',
    });
    localStorage.setItem('trace.browser-demo.v1', JSON.stringify(rows));
  });
  await page.reload();
  await page.getByRole('button', { name: 'History', exact: true }).click();
}
async function select(page: Page, label: string, option: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('radio', { name: option, exact: true }).click();
}
const days = (page: Page) => page.locator('[data-testid^="history-day-"]');
async function dayOrder(page: Page) {
  return days(page).evaluateAll(groups =>
    groups.map(group => group.getAttribute('data-testid')),
  );
}
test('History groups by local payment day, preserves filters and keeps amount sorting within each day', async ({
  page,
}) => {
  await setup(page);
  await expect(days(page)).toHaveCount(3);
  expect(await dayOrder(page)).toEqual([
    'history-day-2026-10-30',
    'history-day-2026-10-29',
    'history-day-2026-10-28',
  ]);
  await expect(
    page.getByRole('heading', { name: 'Today · 30 Oct 2026', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Yesterday · 29 Oct 2026', exact: true }),
  ).toBeVisible();
  const today = page.getByTestId('history-day-2026-10-30');
  await expect(today.getByRole('button').first()).toHaveAccessibleName(
    'Edit Noon shop ₹50',
  );
  await expect(page.getByTestId('history-day-2026-10-29')).toContainText(
    'Late shop',
  );
  await expect(
    page.getByRole('button', { name: /Edit Foreign shop/ }),
  ).toHaveCount(0);
  await page.screenshot({
    path: 'artifacts/history-days/grouped-history.png',
    fullPage: true,
  });

  await page
    .getByRole('button', { name: 'Filters & sort', exact: true })
    .click();
  await select(page, 'Sort transactions', 'Highest amount per day');
  expect(await dayOrder(page)).toEqual([
    'history-day-2026-10-30',
    'history-day-2026-10-29',
    'history-day-2026-10-28',
  ]);
  await expect(today.getByRole('button').first()).toHaveAccessibleName(
    'Edit Morning shop ₹200',
  );
  await select(page, 'Sort transactions', 'Oldest first');
  expect(await dayOrder(page)).toEqual([
    'history-day-2026-10-28',
    'history-day-2026-10-29',
    'history-day-2026-10-30',
  ]);

  await select(page, 'Filter category', 'Groceries');
  await expect(days(page)).toHaveCount(2);
  await expect(page.getByTestId('history-day-2026-10-28')).toHaveCount(0);
  await page
    .getByRole('textbox', { name: 'Search transactions', exact: true })
    .fill('Late shop');
  await expect(days(page)).toHaveCount(1);
  await expect(page.getByTestId('history-day-2026-10-29')).toContainText(
    'Late shop',
  );
  await page
    .getByRole('textbox', { name: 'Search transactions', exact: true })
    .fill('Nothing matches');
  await expect(days(page)).toHaveCount(0);
  await expect(
    page.getByText('No matching entries', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .click();
  await page.getByRole('button', { name: '2026-10', exact: true }).click();
  await expect(days(page)).toHaveCount(4);
  await page
    .getByRole('button', { name: 'Edit Late shop ₹300', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Edit transaction', exact: true }),
  ).toBeVisible();
});
test('day headings update at local midnight while History stays open', async ({
  page,
}) => {
  await setup(page);
  await page.clock.fastForward(6 * 60 * 60 * 1000 + 100);
  await expect(
    page.getByRole('heading', { name: 'Yesterday · 30 Oct 2026', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Today · 30 Oct 2026', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '29 Oct 2026', exact: true }),
  ).toBeVisible();
});
