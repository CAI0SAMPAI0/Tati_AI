const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function scrapeLingoClip() {
  console.log('[Playwright] Starting LingoClip extraction...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  console.log('[Playwright] Navigating to https://lingoclip.app/welcome ...');
  await page.goto('https://lingoclip.app/welcome', { waitUntil: 'networkidle', timeout: 60000 });
  
  // Click 'Play in browser'
  const webLink = page.locator('a.web-link').first();
  if (await webLink.isVisible()) {
    console.log('[Playwright] Clicking "Play in browser"...');
    await webLink.click();
    await page.waitForTimeout(2000);
  }

  // Click 'Pular' / 'Skip' if present
  const skipBtn = page.getByText(/pular|skip/i).first();
  if (await skipBtn.isVisible()) {
    console.log('[Playwright] Skipping onboarding...');
    await skipBtn.click();
    await page.waitForTimeout(1500);
  }

  // Click 'Começar' / 'Start' if present
  const startBtn = page.getByText(/começar|start|get started/i).first();
  if (await startBtn.isVisible()) {
    console.log('[Playwright] Clicking Start...');
    await startBtn.click();
    await page.waitForTimeout(2000);
  }

  // Select 'Inglês' / 'English'
  const englishBtn = page.getByText(/inglês|english/i).first();
  if (await englishBtn.isVisible()) {
    console.log('[Playwright] Selecting English language...');
    await englishBtn.click();
    await page.waitForTimeout(4000);
  }

  console.log('[Playwright] On main feed:', page.url());

  // Scroll down multiple times to load plenty of songs
  console.log('[Playwright] Scrolling to load songs...');
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.waitForTimeout(1500);
  }

  // Also check other tabs or categories if accessible on the page
  const songs = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.lyrics-card[data-lyrics-id]'));
    const seen = new Set();
    const results = [];

    for (const card of cards) {
      const id = card.getAttribute('data-lyrics-id');
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const titleEl = card.querySelector('.lyrics-card__title');
      const artistEl = card.querySelector('.lyrics-card__artist');
      const videoEl = card.querySelector('.lyrics-card__video');
      const moreEl = card.querySelector('.lyrics-card__more');
      const levelEl = card.querySelector('.level');

      const title = titleEl ? titleEl.innerText.trim() : '';
      const artist = artistEl ? artistEl.innerText.trim() : '';
      const more = moreEl ? moreEl.innerText.trim() : '';

      let rawImageUrl = '';
      if (videoEl && videoEl.getAttribute('style')) {
        const match = videoEl.getAttribute('style').match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1]) {
          rawImageUrl = match[1];
        }
      }

      let level = 'all';
      if (levelEl) {
        const cls = levelEl.className;
        if (cls.includes('easy') || cls.includes('beginner')) level = 'Beginner';
        else if (cls.includes('medium') || cls.includes('intermediate')) level = 'Intermediate';
        else if (cls.includes('hard') || cls.includes('advanced')) level = 'Advanced';
        else if (cls.includes('expert')) level = 'Expert';
      }

      results.push({
        id,
        title,
        artist,
        raw_image_url: rawImageUrl,
        more,
        level
      });
    }

    return results;
  });

  console.log(`[Playwright] Extracted ${songs.length} unique songs!`);
  await browser.close();

  const outputPath = path.join(__dirname, 'lingoclip_extracted_raw.json');
  fs.writeFileSync(outputPath, JSON.stringify(songs, null, 2), 'utf-8');
  console.log(`[Playwright] Saved raw data to ${outputPath}`);
  return songs;
}

scrapeLingoClip().catch(err => {
  console.error('[Playwright] Error:', err);
  process.exit(1);
});
