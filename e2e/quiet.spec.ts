import { test, expect, type Page } from '@playwright/test';
async function setup(page: Page, single = false) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Manage budgets', exact: true })
    .waitFor();
  await page.evaluate(
    ({ one }) => {
      const goals = [
        {
          id: 'quiet-laptop',
          name: 'Laptop fund',
          target: 8000000,
          currency: 'INR',
          due: '',
          icon: 'laptop',
        },
        {
          id: 'quiet-holiday',
          name: 'Holiday fund',
          target: 6000000,
          currency: 'INR',
          due: '',
          icon: 'car',
        },
        {
          id: 'quiet-emergency',
          name: 'Emergency fund',
          target: 10000000,
          currency: 'INR',
          due: '',
          icon: 'shield',
        },
        {
          id: 'quiet-usd',
          name: 'Dollar goal',
          target: 100000,
          currency: 'USD',
          due: '',
          icon: 'wallet',
        },
      ];
      localStorage.setItem(
        'trace.finance.demo.v1',
        JSON.stringify({
          version: 1,
          months: {},
          defaults: {},
          categories: [],
          repayments: [],
          goals: one ? goals.slice(0, 1) : goals,
          contributions: [
            {
              id: 'quiet-contribution',
              goalId: 'quiet-laptop',
              amount: 3250000,
              at: Date.now(),
              note: '',
            },
          ],
        }),
      );
    },
    { one: single },
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Savings goals', exact: true })
    .waitFor();
}
test('Quiet has two collapsed fund layers, unfolds all matching goals and preserves amount privacy', async ({
  page,
}) => {
  await setup(page);
  const stack = page.getByTestId('savings-fund-stack');
  const layers = await stack
    .locator('[data-testid^="fund-card-"]')
    .evaluateAll(
      cards =>
        cards.filter(card => Number(getComputedStyle(card).opacity) > 0).length,
    );
  expect(layers).toBe(2);
  await expect(
    page.getByRole('button', { name: 'Open Holiday fund goal', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Expand savings funds', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Open Emergency fund goal', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open Dollar goal goal', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: 'artifacts/quiet-home/funds-expanded.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Hide amounts', exact: true }).click();
  await expect(stack).not.toContainText('32,500');
  await expect(stack).not.toContainText('80,000');
  await expect(stack).not.toContainText('41%');
  await page
    .getByRole('button', { name: 'Savings goals', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Expand savings funds', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
test('an expanded fund opens its own page, edits and contributions persist without adding expenses', async ({
  page,
}) => {
  await setup(page);
  const before = await page.evaluate(() =>
    localStorage.getItem('trace.browser-demo.v1'),
  );
  await page
    .getByRole('button', { name: 'Expand savings funds', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open Laptop fund goal', exact: true })
    .click();
  await page.getByRole('button', { name: 'Edit goal', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Goal name', exact: true })
    .fill('Work laptop');
  await page
    .getByRole('textbox', { name: 'Goal target amount', exact: true })
    .fill('90000');
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByText('Work laptop', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Add contribution', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Contribution amount', exact: true })
    .fill('2500');
  await page
    .getByRole('button', { name: 'Save contribution', exact: true })
    .click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open Work laptop goal', exact: true }),
  ).toBeVisible();
  const card = page.getByTestId('fund-card-quiet-laptop');
  await expect(card).toContainText('₹35,000');
  await expect(card).toContainText('₹90,000');
  expect(
    await page.evaluate(() => localStorage.getItem('trace.browser-demo.v1')),
  ).toBe(before);
  await page.reload();
  await page
    .getByRole('button', { name: 'Expand savings funds', exact: true })
    .click();
  await expect(card).toContainText('₹35,000');
  await expect(card).toContainText('Work laptop');
});
test('a single savings fund opens directly without a fake stack', async ({
  page,
}) => {
  await setup(page, true);
  await expect(
    page.getByRole('button', { name: 'Expand savings funds', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Open Laptop fund goal', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Edit goal', exact: true }),
  ).toBeVisible();
});
