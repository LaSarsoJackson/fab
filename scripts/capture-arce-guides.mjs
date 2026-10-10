import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { getArceDeployment } from '../arce/deployment.js';

// Screenshots show real controls; rectangles locate the responsive annotations.
const base = process.env.ARCE_PREVIEW_URL || `http://127.0.0.1:4182${getArceDeployment(process.env.ARCE_TARGET).sitePath}`;
const shots = { burial: [], tour: [], grave: [] };
const browser = await chromium.launch();
try {
  await mkdir('arce/assets/guides', { recursive: true });
  for (const [size, viewport] of Object.entries({ desktop: { width: 1100, height: 800 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const capture = async (guide, step, locator) => {
      await locator.waitFor({ state: 'visible' });
      await locator.scrollIntoViewIfNeeded();
      if ((guide === 'burial' && step >= 3) || (guide === 'tour' && step >= 2) || (guide === 'grave' && step === 4)) {
        await page.locator('.maplibregl-canvas').waitFor({ state: 'visible' });
        await page.getByText('Loading cemetery map…', { exact: true }).waitFor({ state: 'hidden' });
        await page.waitForLoadState('networkidle');
      }
      const box = await locator.boundingBox();
      if (!box) throw new Error(`Missing ${guide} step ${step} control.`);
      box.x = Math.max(0, box.x); box.y = Math.max(0, box.y);
      box.width = Math.min(box.width, viewport.width - box.x);
      box.height = Math.min(box.height, viewport.height - box.y);
      const image = `guides/${guide}-${step}-${size}.png`;
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `arce/assets/${image}`, animations: 'disabled' });
      shots[guide][step - 1] ||= {};
      shots[guide][step - 1][size] = { image, rect: [box.x / viewport.width * 100, box.y / viewport.height * 100, box.width / viewport.width * 100, box.height / viewport.height * 100].map(n => Math.round(n * 100) / 100), width: viewport.width, height: viewport.height };
    };
    await page.goto(`${base}app/?view=burials`);
    await capture('burial', 1, page.getByLabel('Name', { exact: true }));
    await page.getByLabel('Name', { exact: true }).fill('Thomas LaMont');
    const burialResult = page.getByRole('button', { name: /Thomas E LaMont/ });
    await capture('burial', 2, burialResult);
    await burialResult.click();
    await capture('burial', 3, page.getByRole('button', { name: 'Directions', exact: true }));
    await page.getByRole('button', { name: 'Directions', exact: true }).click();
    await capture('burial', 4, page.getByRole('button', { name: 'Use my location', exact: true }));

    await page.goto(`${base}app/?view=tours`);
    const notables = page.getByRole('button', { name: /Notables Tour 2020/ });
    await capture('tour', 1, notables);
    await notables.click();
    const hall = page.getByRole('button', { name: /James Hall/ });
    await capture('tour', 2, hall);
    await hall.click();
    await capture('tour', 3, page.getByRole('link', { name: 'Read biography', exact: true }));
    await capture('tour', 4, page.getByRole('button', { name: 'Next place', exact: true }));

    await page.goto(`${base}app/?view=burials`);
    await capture('grave', 1, page.locator('.locator-location-fields'));
    await page.getByLabel('Section', { exact: true }).fill('215');
    await page.getByLabel('Lot', { exact: true }).fill('30');
    const locationResult = page.getByRole('button', { name: /Thomas E LaMont/ });
    await locationResult.waitFor({ state: 'visible' });
    await capture('grave', 2, page.locator('.locator-location-fields'));
    await capture('grave', 3, locationResult);
    await locationResult.click();
    await capture('grave', 4, page.getByRole('button', { name: 'Directions', exact: true }));
    await context.close();
  }
  await writeFile('arce/guide-shots.json', JSON.stringify(shots, null, 2) + '\n');
  console.log('Saved 24 real guide screenshots and their control positions.');
} finally {
  await browser.close();
}
