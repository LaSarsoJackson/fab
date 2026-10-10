import { expect, test } from '@playwright/test';
import { getArceDeployment } from '../deployment.js';

const websitePath = getArceDeployment(process.env.ARCE_TARGET).sitePath;
const site = `http://127.0.0.1:4183${websitePath}`;

for (const width of [390, 844, 1440]) {
  test(`app returns to the matching ARCE website at ${width}px`, async ({ browser }) => {
    const height = width === 844 ? 390 : 900;
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(site);
    await page.getByRole('link', { name: 'Find a burial or grave', exact: true }).first().click();
    await page.getByRole('link', { name: 'Open Burial Locator', exact: true }).click();
    expect(new URL(page.url()).pathname).toBe(`${websitePath}app/`);
    await expect(page.getByRole('heading', { name: 'Burial Locator', exact: true })).toBeVisible();
    const back = page.getByRole('link', { name: 'Back to ARCE', exact: true });
    await expect(back).toHaveAttribute('href', websitePath);
    await expect(back).not.toHaveAttribute('target', '_blank');
    await expect(back).toBeInViewport();
    if (width < 720 || height < 500) {
      const returnBox = await back.boundingBox();
      const headingBox = await page.getByRole('heading', { name: 'Burial Locator', exact: true }).boundingBox();
      expect(returnBox.y + returnBox.height).toBeLessThanOrEqual(headingBox.y);
    }
    await page.screenshot({ path: `../evidence/arce-${process.env.ARCE_TARGET || 'dev'}-return-${width}.png`, fullPage: true });
    await back.click();
    await expect(page).toHaveURL(site);
    await expect(page.getByRole('heading', { name: 'Albany Rural Cemetery Explorer', exact: true })).toBeVisible();
    expect(context.pages()).toHaveLength(1);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Burial Locator', exact: true })).toBeVisible();
    await page.goto(`${site}app/?view=tours`);
    await expect(page.getByRole('link', { name: 'Back to ARCE', exact: true })).toHaveAttribute('href', websitePath);
    await page.getByRole('button', { name: 'Cemetery Map', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Albany Rural Cemetery map', exact: true })).toBeVisible();
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await page.getByText('Loading cemetery map…', { exact: true }).waitFor({ state: 'hidden' });
    await page.waitForLoadState('networkidle');
    const returnBox = await page.getByRole('link', { name: 'Back to ARCE', exact: true }).boundingBox();
    const mapBox = await page.getByRole('region', { name: 'Albany Rural Cemetery map', exact: true }).boundingBox();
    expect(returnBox.y + returnBox.height).toBeLessThanOrEqual(mapBox.y);
    await page.screenshot({ path: `../evidence/arce-${process.env.ARCE_TARGET || 'dev'}-map-return-${width}.png`, fullPage: true });
    await page.goto(`${site}app/?embed=fabfg&view=burials`);
    await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}
