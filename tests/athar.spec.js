import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

 test('story, quizzes, finale badge and print summary', async ({ page }) => {
  await page.goto('/'); await page.getByRole('link', { name: /Start the Story/ }).click();
   await expect(page.locator('#story-title')).toHaveText('Five explorers. Four stories. One garden.');
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
  await expect(page.locator('#rec-listen')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#rec-story-line')).not.toBeEmpty();
  await page.locator('#rec-listen').click();
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
  await expect(page.locator('#rec-listen')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#rec-story-line')).not.toBeEmpty();
  await page.locator('#rec-listen').click();
  await expect(page.locator('#rec-listen')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rec-story-line .word-visible')).toHaveCount(0);
  await page.waitForTimeout(900);
  await expect(page.locator('#rec-story-line .word-visible')).toHaveCount(0);
  await page.evaluate(() => window.__spokenUtterances[1].onend());
  await expect(page.locator('#rec-story-line .word-hidden')).toHaveCount(0);
});

test('language switch sets and persists RTL', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#boot')).toBeHidden();
  await page.getByRole('button', { name: 'Switch to Arabic' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#sound-toggle')).toHaveText('الصوت متوقف');
  await expect(page.locator('nav [data-nav="home"]')).toHaveText('الرئيسية');
  await expect(page.locator('#boot p')).toHaveText('نوقظ الحديقة…');
  await expect(page.locator('#steles')).toHaveAttribute('aria-label', 'أربع بطاقات تضم خمسة مستكشفين');
  await expect(page.locator('.hero h1 em')).toHaveText('كل مهمة تترك أثراً');
  await page.locator('.cta a[href="#story"]').click();
  await expect(page.locator('#story-title')).toHaveText('خمسة مستكشفين. أربع قصص. حديقة واحدة.');
  await page.locator('#story-next').click();
  await expect(page.locator('#story-text .kicker')).toContainText('مستكشف 1 من 4');
  await expect(page.locator('#st-listen')).toHaveText('🔊 استمع');
  await page.locator('#st-more').click();
  await expect(page.locator('#rec-title')).toHaveText('إيغل (مرحلة الصعود)');
  await expect(page.locator('#qa-go')).toHaveText('اسأل');
  await page.locator('.qa-chips .chip').first().click();
  await expect(page.locator('#qa-out')).toContainText('من ملاحظات السجل');
  await page.locator('#rec-close').click();
  await page.getByRole('button', { name: 'المصادر والشكر' }).first().click();
  await expect(page.locator('#cr-title')).toHaveText('المصادر والشكر');
  await expect(page.locator('#cr-body')).not.toContainText('Facts vs. narration');
  await page.locator('#cr-close').click();
  await page.goto('/#explore');
  await expect(page.locator('.filters [data-filter="all"]')).toHaveText('الكل');
  await expect(page.locator('#explorer-list')).toContainText('بايونير 10');
  await page.getByRole('button', { name: /التبديل إلى الإنجليزية/ }).click();
  await expect(page.locator('.filters [data-filter="all"]')).toHaveText('All');
  await expect(page.locator('#explorer-list')).toContainText('Pioneer 10');
  await page.getByRole('button', { name: 'Switch to Arabic' }).click();
  await page.goto('/#story');
  await page.reload();
  await expect(page.locator('#boot')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('#story-title')).toHaveText('خمسة مستكشفين. أربع قصص. حديقة واحدة.');
  await page.getByRole('button', { name: /التبديل إلى الإنجليزية/ }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#story-title')).toHaveText('Five explorers. Four stories. One garden.');
});

test('mobile has no horizontal overflow and passes axe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]);
});

test('hero starfield animates, resizes sharply, and honors reduced motion', async ({ page }) => {
  await page.addInitScript(() => {
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function(...args) {
      window.__starfieldFrames = (window.__starfieldFrames || 0) + 1;
      return clearRect.apply(this, args);
    };
  });
  await page.goto('/'); await expect(page.locator('#boot')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__starfieldFrames)).toBeGreaterThan(2);
  const initialFrames = await page.evaluate(() => window.__starfieldFrames);
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__starfieldFrames)).toBeGreaterThan(initialFrames + 2);
  await expect(page.locator('#stars')).toHaveCSS('pointer-events', 'none');

  await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(100);
  const canvasSize = await page.locator('#stars').evaluate(canvas => ({
    width: canvas.width,
    expectedWidth: canvas.getBoundingClientRect().width * Math.min(devicePixelRatio, 2)
  }));
  expect(Math.abs(canvasSize.width - canvasSize.expectedWidth)).toBeLessThan(2);

  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload();
  await expect(page.locator('#boot')).toBeHidden(); await page.waitForTimeout(150);
  const reducedFrames = await page.evaluate(() => window.__starfieldFrames);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__starfieldFrames)).toBe(reducedFrames);
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
  await page.goto('/'); await page.waitForTimeout(1200);
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain('athar-static-v8');
  await page.reload(); await context.setOffline(true); await page.goto('/'); await expect(page.locator('#steles .stele')).toHaveCount(4);
});

test('sound remains opt-in, settings persist, and volume controls stay independent', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    window.__audioContextsCreated = 0;
    if (NativeAudioContext) window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__audioContextsCreated++; }
    };
  });
  await page.goto('/');
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__audioContextsCreated)).toBe(0);
  await expect(page.locator('#rec-listen')).toHaveCount(0);

  await page.locator('#sound-settings-open').click();
  await expect(page.locator('#sound-settings')).toBeVisible();
  await page.locator('#sound-enable').check();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__audioContextsCreated)).toBe(1);
  await page.locator('#sound-effects-volume').evaluate(el => { el.value = '0.37'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#sound-music-volume').evaluate(el => { el.value = '0.08'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#sound-ambient').check();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('athar-sound-preferences')).ambient)).toBe(true);
  await page.locator('#sound-settings-close').click();
  await page.locator('#sound-toggle').click();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('athar-sound-preferences')))).toMatchObject({ enabled: false, effects: 0.37, music: 0.08, ambient: true });
  await page.reload();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#sound-settings-open').click();
  await expect(page.locator('#sound-effects-volume')).toHaveValue('0.37');
  await expect(page.locator('#sound-music-volume')).toHaveValue('0.08');
  await expect(page.locator('#sound-ambient')).toBeChecked();
  await page.locator('#sound-settings-close').click();
  await page.locator('#sound-settings-open').click();
  await page.locator('#sound-enable').check();
  await page.locator('#sound-settings-close').click();
  await page.reload();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__audioContextsCreated)).toBe(0);
  await page.locator('.cta a[href="#story"]').click();
  expect(await page.evaluate(() => window.__audioContextsCreated)).toBe(1);
});
