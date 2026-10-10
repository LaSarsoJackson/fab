import { test, expect } from '@playwright/test';
import { getArceDeployment } from '../deployment.js';
const deployment = getArceDeployment(process.env.ARCE_TARGET);
const site = `http://127.0.0.1:4183${deployment.sitePath}`;

const pages = ['index.html', 'explore.html', 'Locate_Burials&Graves.html',
  'tutorial.html', 'Grave_Finder_tutorial.html', 'Burial_Locator_tutorial.html',
  'about.html', 'about-project-history.html', 'help.html', 'offline.html', 'graves.html', 'biolist.html', 'privacy.html'];

for (const width of [390, 1440]) {
  test(`ARCE pages work without scripts at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
    const page = await context.newPage();
    const failures = [];
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    for (const file of pages) {
      await page.goto(`${site}${encodeURIComponent(file)}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      if (file.includes('tutorial')) await expect(page.locator('.steps > details:visible')).toHaveCount(4);
      await expect(page).not.toHaveTitle(/Generic|TEMPLATED/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (file === 'index.html' || file === 'about.html') {
        await page.screenshot({ path: `../evidence/arce-${width}-${file}.png`, fullPage: true });
      }
    }
    expect(failures).toEqual([]);
    await context.close();
  });
}

test('legacy burial links retain query and record at the new deployment path', async ({ page }) => {
  await page.goto(`${site}Burial_Locator/?q=Arthur&section=24&lot=1&record=18`);
  await page.waitForURL(`${site}app/**`);
  const url = new URL(page.url());
  expect(url.searchParams.get('view')).toBe('burials');
  expect(url.searchParams.get('q')).toBe('Arthur');
  expect(url.searchParams.get('lot')).toBe('1');
  expect(url.searchParams.get('record')).toBe('18');
});

test('ARCE build loads search data, filters and map under its own path', async ({ page }) => {
  await page.goto(`${site}app/?view=burials`);
  await page.getByLabel('Section', { exact: true }).fill('215');
  await page.getByLabel('Lot', { exact: true }).fill('30');
  await page.getByLabel('Name', { exact: true }).fill('Thomas LaMont');
  await expect(page.getByRole('button', { name: /Thomas E LaMont/ })).toBeVisible();
  await page.getByRole('button', { name: /Thomas E LaMont/ }).click();
  await expect(page.getByRole('heading', { name: 'Thomas E LaMont' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Albany Rural Cemetery map' })).toBeVisible();
  await page.screenshot({ path: '../evidence/arce-app-search.png', fullPage: true });
});

test('old tours entry opens the current tour list', async ({ page }) => {
  await page.goto(`${site}tours.html`);
  await page.waitForURL(`${site}app/**`);
  await expect(page.getByRole('heading', { name: 'Search Tours', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Notables Tour 2020/ }).click();
  await expect(page.getByRole('complementary', { name: 'Notables Tour 2020' })).toBeVisible();
});

test('ARCE worker leaves other same-origin app caches intact', async ({ page }) => {
  const otherCache = deployment.target === 'dev' ? 'fab-arce-v7' : 'fab-arce-dev-v7';
  await page.goto(`${site}index.html`);
  await page.evaluate(async () => {
    const cache = await caches.open('fab-v7');
    await cache.put('/other-app-proof', new Response('keep'));
  });
  await page.evaluate(async name => {
    const cache = await caches.open(name);
    await cache.put('/other-environment-proof', new Response('keep'));
  }, otherCache);
  await page.goto(`${site}app/`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(await page.evaluate(async () => (await caches.open('fab-v7')).match('/other-app-proof').then(Boolean))).toBe(true);
  expect(await page.evaluate(async name => (await caches.open(name)).match('/other-environment-proof').then(Boolean), otherCache)).toBe(true);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(`${site}app/`);
});

test('website retains its historical browsing and illustrated guides', async ({ page }) => {
  await page.goto(`${site}`);
  await expect(page.getByRole('heading', { name: 'Albany Rural Cemetery Explorer', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Browse notable graves', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kate Stoneman', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Biographies', exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'Thomas Elkins', exact: true })).toHaveAttribute('href', 'https://www.albany.edu/arce/Elkins111.html');
  await page.goto(`${site}Burial_Locator_tutorial.html`);
  const topics = page.locator('.guide-slide');
  await expect(topics).toHaveCount(4);
  await topics.last().locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(topics.last().locator('img')).toBeVisible();
  await topics.first().locator('summary').click();
  await expect(topics.first().locator('img')).toBeVisible();
  await page.screenshot({ path: '../evidence/arce-interactive-guide.png', fullPage: true });
});

for (const width of [360, 390, 1440]) {
  test(`illustrated walkthroughs teach the controls at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    for (const filename of ['tutorial.html', 'Burial_Locator_tutorial.html', 'Grave_Finder_tutorial.html']) {
      await page.goto(`${site}${filename}`);
      const topics = page.locator('.guide-slide');
      await expect(topics).toHaveCount(4);
      for (const index of [3, 1, 2, 0]) {
        const slide = topics.nth(index);
        if (await slide.getAttribute('open') === null) await slide.locator('summary').click();
        const highlight = slide.locator('.guide-highlight');
        await expect(highlight).toBeVisible();
        await expect(highlight).toBeEmpty();
        expect(await highlight.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
        const photo = await slide.locator('img').boundingBox();
        const copy = await slide.locator('.guide-copy').boundingBox();
        expect(photo.y).toBeGreaterThanOrEqual(copy.y + copy.height);
        expect(photo.width).toBeGreaterThanOrEqual(width < 600 ? width - 45 : 850);
        await expect(slide.getByRole('link', { name: 'View full-size screenshot', exact: true })).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      for (const topic of await topics.all()) await topic.locator('summary').click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `../evidence/illustrated-${width}-${filename}.png`, fullPage: true });
    }
    await page.goto(`${site}about.html`);
    await expect(page.getByText('Ewa Wdzieczak-Smering', { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.getByRole('heading', { level: 1 }).evaluate(el => getComputedStyle(el).fontFamily)).toContain('Raleway');
    expect(await page.evaluate(() => document.fonts.check('700 20px Raleway'))).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('website promotes only the current app', async ({ page }) => {
  for (const filename of pages) {
    await page.goto(`${site}${encodeURIComponent(filename)}`);
    const hrefs = await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')));
    expect(hrefs.filter(href => /(?:Grave_Finder\/|Burial_Locator\/|tours\.html)/i.test(href))).toEqual([]);
    expect(await page.locator('body').innerText()).not.toContain('separate Grave Finder');
  }
  await page.goto(`${site}Grave_Finder_tutorial.html`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search by section, lot or tier');
  await expect(page.getByRole('link', { name: 'Open Burial Locator', exact: true }).first()).toHaveAttribute('href', 'app/?view=burials&tutorial=burial-search');
});
