import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

 test('story, quizzes, finale badge and print summary', async ({ page }) => {
  await page.goto('/'); await page.getByRole('link', { name: /Start the Story/ }).click();
   await expect(page.locator('#story-title')).toContainText('Four explorers');
   await page.locator('#story-next').click();
   for (const name of ['Eagle (ascent stage)', 'Pioneer 10', 'Opportunity', 'Ingenuity']) {
    await expect(page.locator('#story-title')).toContainText(name); await expect(page.locator('.quiz-question')).toHaveCount(2);
    for (const q of await page.locator('.quiz-question').all()) await q.locator('[data-quiz]').first().click();
    await page.locator('#story-next').click();
  }
  await expect(page.locator('#story-title')).toContainText('Every mission leaves a mark');
  await expect(page.getByText('Garden Keeper')).toBeVisible(); await expect(page.getByRole('button', { name: 'Print teacher summary' })).toBeVisible();
});

test('finale timeline compares mission years and opens the selected record', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/#story');
  for (let i = 0; i < 5; i++) await page.locator('#story-next').click();
  await expect(page.locator('#mission-timeline-title')).toHaveText('Their missions, across time');
  await expect(page.locator('.mission-span')).toHaveCount(4);
  await expect(page.locator('.mission-span[data-id="eagle"]')).toContainText('1969–1969');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]);
  await page.locator('.mission-span[data-id="pioneer-10"]').click();
  await expect(page.locator('#record')).toBeVisible();
  await expect(page.locator('#rec-title')).toHaveText('Pioneer 10');
});

test('four records and world filters are available', async ({ page }) => {
  await page.goto('/#explore');
  for (const name of ['Pioneer 10', 'Opportunity', 'Ingenuity', 'Eagle (ascent stage)']) await expect(page.locator('#explorer-list')).toContainText(name);
  for (const filter of ['All', 'Moon', 'Mars', 'Deep space']) await page.getByRole('button', { name: filter, exact: true }).click();
  await page.locator('#explorer-list button[data-id="ingenuity"]').click(); await expect(page.locator('#record')).toBeVisible();
});

test('record narration reveals words only on speech boundaries and resets on reopen', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak(utterance) { window.__spokenUtterances ??= []; window.__spokenUtterances.push(utterance); },
        cancel() { window.__speechCancelCount = (window.__speechCancelCount || 0) + 1; }
      }
    });
  });
  await page.goto('/#explore');
  await page.locator('#explorer-list button').first().click();
  await expect(page.locator('#record')).toBeVisible();
  await expect(page.locator('#rec-listen')).toHaveAttribute('aria-pressed', 'true');
  const spans = page.locator('#rec-story-line .word-hidden, #rec-story-line .word-visible');
  await expect(page.locator('#rec-story-line .word-hidden')).not.toHaveCount(0);
  await page.waitForTimeout(900);
  await expect(page.locator('#rec-story-line .word-visible')).toHaveCount(0);

  const wordPositions = await page.locator('#rec-story-line .word-hidden').evaluateAll(elements =>
    elements.slice(0, 3).map(element => ({ text: element.textContent, start: Number(element.dataset.start) }))
  );
  await page.evaluate(start => window.__spokenUtterances[0].onboundary({ charIndex: start }), wordPositions[0].start);
  await expect(spans.nth(0)).toHaveClass(/word-visible/);
  await expect(spans.nth(1)).toHaveClass(/word-hidden/);
  await page.evaluate(start => window.__spokenUtterances[0].onboundary({ charIndex: start }), wordPositions[1].start);
  await expect(spans.nth(1)).toHaveClass(/word-visible/);
  await expect(spans.nth(2)).toHaveClass(/word-hidden/);

  await page.evaluate(() => window.__spokenUtterances[0].onend());
  await expect(page.locator('#rec-story-line .word-hidden')).toHaveCount(0);
  await expect(page.locator('#rec-listen')).toHaveAttribute('aria-pressed', 'false');

  await page.locator('#rec-close').click();
  await expect(page.locator('#record')).not.toBeVisible();
  expect(await page.evaluate(() => window.__speechCancelCount)).toBeGreaterThan(0);
  await page.locator('#explorer-list button').first().click();
  await expect(page.locator('#rec-listen')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rec-story-line .word-visible')).toHaveCount(0);
  await page.waitForTimeout(900);
  await expect(page.locator('#rec-story-line .word-visible')).toHaveCount(0);
  await page.evaluate(() => window.__spokenUtterances[1].onend());
  await expect(page.locator('#rec-story-line .word-hidden')).toHaveCount(0);
});

test('language switch sets and persists RTL', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Switch to Arabic' }).click(); await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});

test('mobile has no horizontal overflow and passes axe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]);
});

test('file URL explains the local server requirement', async ({ page }) => {
  const filePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.html'); await page.goto(pathToFileURL(filePath).href);
  await expect(page.locator('#app-error')).toBeVisible(); await expect(page.locator('#app-error-msg')).toContainText('file://');
});

test('WebGL failure exposes the story fallback', async ({ page }) => {
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { if (['webgl','webgl2'].includes(type)) return null; return original.call(this,type,...args); }; });
  await page.goto('/#explore'); await expect(page.locator('#gl-fallback')).toBeVisible(); await expect(page.locator('#fallback-list')).toContainText('Pioneer 10');
});

test('offline app shell is served by service worker', async ({ page, context }) => {
  await page.goto('/'); await page.waitForTimeout(1200); await page.reload(); await context.setOffline(true); await page.goto('/'); await expect(page.locator('#steles .stele')).toHaveCount(4);
});
