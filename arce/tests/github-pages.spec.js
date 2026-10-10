import { expect, test } from '@playwright/test';

test('existing Pages app links into the matching ARCE website and guides', async ({ page }) => {
  test.skip(process.env.ARCE_TARGET !== 'github-pages');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/fab/?view=burials');
  await expect(page).toHaveTitle('Albany Grave Finder');
  await page.getByLabel('Name', { exact: true }).fill('Thomas LaMont');
  await expect(page.getByRole('button', { name: /Thomas E LaMont/ })).toBeVisible();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('link', { name: 'Illustrated guide', exact: true }).click();
  await expect(page).toHaveURL(/\/fab\/arce\/Burial_Locator_tutorial\.html$/);
  await page.getByRole('link', { name: 'Open Burial Locator', exact: true }).click();
  await expect(page).toHaveURL(/\/fab\/arce\/app\/\?view=burials/);
  await page.getByRole('link', { name: 'Back to ARCE', exact: true }).click();
  await expect(page).toHaveURL(/\/fab\/arce\/$/);
  await expect(page.getByRole('heading', { name: 'Albany Rural Cemetery Explorer', exact: true })).toBeVisible();
  await page.goto('/fab/arce/privacy.html');
  await expect(page.getByRole('link', { name: 'GitHub privacy statement', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
