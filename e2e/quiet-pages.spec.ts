import { test, expect } from '@playwright/test';

test('Quiet appearance follows the saved theme across every Analytics tab and Settings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Make it yours', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  for (const [theme, surface] of [
    ['Light', 'rgb(240, 239, 235)'],
    ['Dark', 'rgb(37, 40, 45)'],
  ]) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await expect(
      page.getByRole('button', { name: theme, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({
      path: `artifacts/quiet-pages/appearance-${theme.toLowerCase()}.png`,
    });
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await expect(page.getByTestId('spending-trend-card')).toHaveCSS(
      'background-color',
      surface,
    );
    await page.screenshot({
      path: `artifacts/quiet-pages/analytics-${theme.toLowerCase()}.png`,
    });
    for (const tab of ['Categories', 'Compare', 'Overview']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(
        page.getByRole('tab', { name: tab, exact: true }),
      ).toHaveAttribute('aria-selected', 'true');
      await page.screenshot({
        path: `artifacts/quiet-pages/${tab.toLowerCase()}-${theme.toLowerCase()}.png`,
      });
    }
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.screenshot({
      path: `artifacts/quiet-pages/settings-${theme.toLowerCase()}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  }
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Dark', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page
    .getByRole('button', { name: 'System default', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'System default', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
