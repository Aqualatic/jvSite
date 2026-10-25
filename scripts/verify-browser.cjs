// Browser smoke test against local files and fixture APIs. Never uses live Supabase.
// node scripts/verify-browser.cjs <playwright-core package> <chromium executable>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright-core');

const root = path.resolve(__dirname, '..');
const calls = [];
const friendSong = {
  id: 'friends-one', title: 'Original Friend Track',
  audioSrc: '/assets/demo/first-light.wav', coverSrc: '/assets/demo/first-light.svg',
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.txt': 'text/plain' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    calls.push({ path: url.pathname, audience: url.searchParams.get('audience'), method: req.method, body });
    res.setHeader('Content-Type', 'application/json');
    if (url.searchParams.get('audience') !== 'friends') {
      res.writeHead(400).end(JSON.stringify({ error: 'Unexpected live API call from demo' }));
      return;
    }
    let result = {};
    if (url.pathname === '/api/songs') result = { songs: [friendSong] };
    if (url.pathname === '/api/ratings') result = { likes: 4 + (body.likeDelta || 0), dislikes: 0 };
    if (url.pathname === '/api/comments') result = { comments: [{ author: 'A friend', body: 'Existing library comment', created_at: new Date().toISOString() }] };
    if (url.pathname === '/api/plays') result = { ok: true };
    if (url.pathname === '/api/analytics') result = {
      stats: [{ id: friendSong.id, title: friendSong.title, plays: 19, likes: 4, dislikes: 0 }],
      timeline: [{ date: new Date().toISOString().slice(0, 10), count: 19 }],
      totals: { songs: 1, plays: 19, likes: 4 },
    };
    res.end(JSON.stringify(result));
    return;
  }
  const filename = url.pathname.startsWith('/assets/')
    ? path.resolve(root, '.' + url.pathname) : path.join(root, 'index.html');
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
  res.end(fs.readFileSync(filename));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), 'jvhub-preview-'));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.argv[3], args: ['--autoplay-policy=no-user-gesture-required'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const requests = [];
    await context.route('**/*', route => {
      requests.push(route.request().url());
      if (new URL(route.request().url()).hostname !== '127.0.0.1') return route.abort();
      return route.continue();
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async value => { window.__sharedLink = value; } },
      });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/');
    await page.waitForSelector('#listings .listing', { state: 'attached' });
    assert.equal(await page.title(), 'Demo');
    assert.equal(await page.locator('#siteTitle').textContent(), 'Demo');
    assert.equal(await page.locator('#collageTitle').textContent(), 'Demo');
    assert.equal((await page.locator('body').innerText()).includes('JVHub'), false);
    assert.equal(await page.locator('#listings .listing').count(), 3);
    assert.equal(await page.locator('[data-tab="private"]').isVisible(), false);
    assert.equal(await page.locator('#privateVideo').getAttribute('src'), null);
    assert.equal(requests.some(url => url.includes('youtube') || url.includes('supabase')), false);
    assert.equal(calls.length, 0);

    await page.locator('[data-tab="music"]').click();
    assert.equal(await page.locator('#tab-music').isVisible(), true);
    assert.equal(await page.locator('#tab-home').isVisible(), false);
    const first = page.locator('#listings .listing').first();
    assert.equal(await first.locator('img').evaluate(img => img.complete && img.naturalWidth > 0), true);
    await first.locator('.card-play-btn').click();
    await page.waitForFunction(() => document.querySelector('#listings audio').currentTime > 0.2);
    assert.equal(await page.locator('#bpTitle').textContent(), 'First Light');
    await page.locator('#bpNextBtn').click();
    assert.equal(await page.locator('#bpTitle').textContent(), 'After Hours');
    await page.locator('#bpPrevBtn').click();
    assert.equal(await page.locator('#bpTitle').textContent(), 'First Light');
    await page.locator('#bpShuffleBtn').click();
    assert.equal(await page.locator('#bpShuffleBtn').evaluate(el => el.classList.contains('active')), true);
    await first.locator('.rating-btn.like').click();
    assert.equal(await first.locator('.rating-btn.like .rating-count').textContent(), '1');
    await first.locator('.card-comment-btn').click();
    await page.locator('#sidebarNameInput').fill('Demo listener');
    const comment = 'Great <intro> & "hello"';
    await page.locator('#sidebarBodyInput').fill(comment);
    await page.locator('#sidebarAddTimestamp').click();
    await page.locator('#sidebarFileInput').setInputFiles({
      name: 'test.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=', 'base64'),
    });
    await page.locator('#sidebarSubmitBtn').click();
    await page.waitForSelector('.sidebar-comment-item');
    assert.ok((await page.locator('.sidebar-comment-body').textContent()).includes(comment));
    assert.equal(await page.locator('.sidebar-comment-body intro').count(), 0);
    assert.equal(await page.locator('.comment-timestamp-btn').count(), 1);
    assert.equal(await page.locator('.sidebar-comment-image img').count(), 1);
    await page.locator('#sidebarClose').click();
    await first.locator('.card-share-btn').click();
    assert.equal(await page.evaluate(() => window.__sharedLink), base + '/?song=demo-first-light');
    await page.locator('[data-tab="analytics"]').click();
    await page.waitForFunction(() => document.getElementById('statTotalLikes').textContent === '1');
    assert.equal(await page.locator('#statTotalSongs').textContent(), '3');
    assert.equal(await page.locator('#statTotalPlays').textContent(), '2');
    assert.equal(calls.length, 0);
    await page.locator('[data-tab="merch"]').click();
    assert.equal(await page.locator('#merchGrid a').count(), 0);
    assert.equal(await page.locator('#merchGrid').textContent(), '');
    assert.equal(await page.locator('#merchGrid').locator('*').count(), 0);

    await page.reload();
    await page.locator('[data-tab="music"]').click();
    await page.waitForFunction(() => document.querySelector('#listings .rating-btn.like .rating-count')?.textContent === '1');
    await page.screenshot({ path: path.join(screenshots, 'demo-desktop.png'), fullPage: true, animations: 'disabled' });
    const demoBefore = await page.evaluate(() => localStorage.getItem('jvhub.demo.v1'));
    await page.goto(base + '/jvhub/?song=friends-one');
    await page.waitForFunction(() => document.getElementById('bpTitle').textContent === 'Original Friend Track');
    assert.equal(await page.title(), 'JVHub');
    assert.equal(await page.locator('#siteTitle').textContent(), 'JVHub');
    assert.equal(await page.locator('#collageTitle').textContent(), 'JVHub');
    assert.equal(await page.locator('[data-tab="private"]').isVisible(), true);
    assert.equal(await page.locator('#tab-private').isVisible(), false);
    assert.equal(await page.locator('#tab-music').isVisible(), true);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    assert.equal(await page.locator('#listings .listing').count(), 1);
    await page.locator('#listings .card-share-btn').click();
    assert.equal(await page.evaluate(() => window.__sharedLink), base + '/jvhub?song=friends-one');
    await page.locator('#listings .card-comment-btn').click();
    await page.waitForFunction(() => document.getElementById('sidebarCommentsList').textContent.includes('Existing library comment'));
    await page.locator('#sidebarClose').click();
    await page.locator('#listings .rating-btn.like').click();
    await page.locator('[data-tab="analytics"]').click();
    await page.waitForFunction(() => document.getElementById('statTotalPlays').textContent === '19');
    assert.equal(await page.evaluate(() => localStorage.getItem('jvhub.demo.v1')), demoBefore);
    assert.ok(calls.length > 0 && calls.every(call => call.audience === 'friends'));
    assert.ok(calls.some(call => call.path === '/api/ratings' && call.method === 'POST'));

    await page.goto(base + '/?song=demo-slow-orbit');
    await page.waitForFunction(() => document.getElementById('bpTitle').textContent === 'Slow Orbit');
    assert.equal(await page.locator('#tab-music').isVisible(), true);
    const mobile = await context.newPage();
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(base + '/');
    await mobile.locator('#collageMusicBtn').click();
    assert.equal(await mobile.locator('#tab-music').isVisible(), true);
    assert.equal(await mobile.locator('#listings .listing').count(), 3);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await mobile.screenshot({ path: path.join(screenshots, 'demo-mobile.png'), fullPage: true, animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: Demo/JVHub branding, catalogues, audio playback, queue, shuffle, votes, image/timestamp comments, share links, persistence, stats, empty demo merch, and mobile tabs.');
    console.log('Screenshots: ' + screenshots);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
