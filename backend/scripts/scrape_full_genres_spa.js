const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BANNED_ARTISTS = [
  'nicki minaj',
  'anitta',
  'katseye',
  'katseyes',
  'travis scott',
  'cardi b',
  'megan thee stallion',
  'sexxy red',
  'ice spice',
  '6ix9ine',
  'playboi carti',
  'lil pump',
  'bhad bhabie',
  'chappell roan'
];

const BANNED_TITLES = [
  'hootie frutti',
  'animal',
  'whats my age again',
  "what's my age again",
  'boom, boom, boom, boom',
  'boom boom boom boom',
  'turn me on',
  'wap',
  'anaconda',
  'super freaky girl',
  'side to side',
  'blurred lines',
  'strip that down',
  'sexy and i know it',
  'sexy chick',
  'unholy',
  'whore',
  'slut',
  'stripper',
  'peaches',
  'wobble',
  'twerk',
  'body',
  'thot',
  'naked',
  'nude'
];

const BANNED_WORDS = [
  /\bsex\b/i,
  /\bsexy\b/i,
  /\bhorny\b/i,
  /\berotic\b/i,
  /\bnude\b/i,
  /\bnaked\b/i,
  /\bbooty\b/i,
  /\bbutt\b/i,
  /\basses\b/i,
  /\bpenis\b/i,
  /\bdick\b/i,
  /\bpussy\b/i,
  /\bwhore\b/i,
  /\bslut\b/i,
  /\bbitch\b/i,
  /\bfuck\b/i,
  /\bfucking\b/i,
  /\bporn\b/i,
  /\blingerie\b/i,
  /\bbikini\b/i,
  /\bundress\b/i
];

function isSafeSong(title, artist) {
  const t = (title || '').toLowerCase().trim();
  const a = (artist || '').toLowerCase().trim();

  for (const ba of BANNED_ARTISTS) {
    if (a.includes(ba) || t.includes(ba)) return false;
  }
  for (const bt of BANNED_TITLES) {
    if (t.includes(bt)) return false;
  }
  for (const bw of BANNED_WORDS) {
    if (bw.test(t) || bw.test(a)) return false;
  }
  return true;
}

const GENRE_MAPPING = {
  'pop': 'Pop',
  'rock': 'Rock',
  'hard_rock': 'Hard Rock',
  'heavy_metal': 'Heavy Metal',
  'punk': 'Rock',
  'alternative': 'Rock',
  'indie': 'Indie / Acoustic',
  'folk': 'Indie / Acoustic',
  'blues': 'Indie / Acoustic',
  'r&b': 'R&B / Soul',
  'soul': 'R&B / Soul',
  'dance': 'Dance / Electronic',
  'electronica': 'Dance / Electronic',
  'disco': 'Dance / Electronic',
  'classic': 'Classics'
};

(async () => {
  console.log('[SPA Scraper] Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  const songsMap = new Map();

  async function harvestCards(genreTag) {
    const cards = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.lyrics-card[data-lyrics-id]'));
      return els.map(c => {
        const id = c.getAttribute('data-lyrics-id');
        const titleEl = c.querySelector('.lyrics-card__title');
        const artistEl = c.querySelector('.lyrics-card__artist');
        const videoEl = c.querySelector('.lyrics-card__video');
        const moreEl = c.querySelector('.lyrics-card__more');
        let rawImg = '';
        if (videoEl && videoEl.getAttribute('style')) {
          const m = videoEl.getAttribute('style').match(/url\(['"]?(.*?)['"]?\)/);
          if (m && m[1]) rawImg = m[1];
        }
        return {
          id,
          title: titleEl ? titleEl.innerText.trim() : '',
          artist: artistEl ? artistEl.innerText.trim() : '',
          raw_image_url: rawImg,
          more: moreEl ? moreEl.innerText.trim() : ''
        };
      });
    });

    let added = 0;
    for (const c of cards) {
      if (!c.id || !c.title || !c.artist) continue;
      if (!isSafeSong(c.title, c.artist)) {
        console.log(`[BLOCKED EXPLICIT] ${c.title} by ${c.artist}`);
        continue;
      }

      if (!songsMap.has(c.id)) {
        songsMap.set(c.id, {
          id: c.id,
          title: c.title,
          artist: c.artist,
          raw_image_url: c.raw_image_url,
          more: c.more,
          genre: genreTag || 'Pop'
        });
        added++;
      } else if (genreTag && genreTag !== 'Pop') {
        songsMap.get(c.id).genre = genreTag;
      }
    }
    return added;
  }

  // Onboarding
  await page.goto('https://lingoclip.app/welcome', { waitUntil: 'networkidle', timeout: 45000 });
  const webLink = page.locator('a.web-link').first();
  if (await webLink.isVisible()) await webLink.click();
  await page.waitForTimeout(2000);
  const skipBtn = page.getByText(/pular|skip/i).first();
  if (await skipBtn.isVisible()) await skipBtn.click();
  await page.waitForTimeout(1500);
  const startBtn = page.getByText(/começar|start/i).first();
  if (await startBtn.isVisible()) await startBtn.click();
  await page.waitForTimeout(2000);
  const englishBtn = page.getByText(/inglês|english/i).first();
  if (await englishBtn.isVisible()) await englishBtn.click();
  await page.waitForTimeout(3000);

  // Scroll main feed
  console.log('[SPA Scraper] Scrolling main feed for general catalog...');
  for (let i = 0; i < 15; i++) {
    await harvestCards('Pop');
    await page.evaluate(() => window.scrollBy(0, 1400));
    await page.waitForTimeout(800);
  }
  await harvestCards('Pop');
  console.log(`[SPA Scraper] Main feed: ${songsMap.size} songs.`);

  // Find all genre cards on the page
  // Scroll up to genres section
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(1000);

  const genresToScrape = [
    { selector: '.genre-card[data-genre="rock"]', label: 'Rock' },
    { selector: '.genre-card[data-genre="hard_rock"]', label: 'Hard Rock' },
    { selector: '.genre-card[data-genre="heavy_metal"]', label: 'Heavy Metal' },
    { selector: '.genre-card[data-genre="indie"]', label: 'Indie / Acoustic' },
    { selector: '.genre-card[data-genre="dance"]', label: 'Dance / Electronic' },
    { selector: '.genre-card[data-genre="r&b"]', label: 'R&B / Soul' },
    { selector: '.genre-card[data-genre="classic"]', label: 'Classics' }
  ];

  for (const g of genresToScrape) {
    console.log(`\n[SPA Scraper] Processing genre: ${g.label}...`);
    try {
      // Find element
      const el = page.locator(g.selector).first();
      if (await el.isVisible({ timeout: 3000 })) {
        console.log(`Clicking ${g.label}...`);
        await el.click();
        await page.waitForTimeout(3000);

        // Scroll inside playlist
        for (let s = 0; s < 8; s++) {
          await harvestCards(g.label);
          await page.evaluate(() => window.scrollBy(0, 1200));
          await page.waitForTimeout(800);
        }
        await harvestCards(g.label);
        console.log(`Songs count after ${g.label}: ${songsMap.size}`);

        // Navigate back via history
        await page.goBack();
        await page.waitForTimeout(2000);
      } else {
        console.log(`Genre card not visible: ${g.selector}`);
      }
    } catch (e) {
      console.log(`Error navigating genre ${g.label}: ${e.message}`);
      await page.goBack().catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  await browser.close();

  const finalSongs = Array.from(songsMap.values());
  console.log(`\n==============================================`);
  console.log(`[SPA Scraper] TOTAL SAFE SONGS: ${finalSongs.length}`);
  console.log(`==============================================`);

  const counts = {};
  for (const s of finalSongs) {
    counts[s.genre] = (counts[s.genre] || 0) + 1;
  }
  console.log('Genres breakdown:', counts);

  const outPath = path.join(__dirname, 'lingoclip_extracted_raw.json');
  fs.writeFileSync(outPath, JSON.stringify(finalSongs, null, 2), 'utf-8');
  console.log(`Saved to ${outPath}`);
})();
