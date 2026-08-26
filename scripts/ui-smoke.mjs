#!/usr/bin/env node
/**
 * Browser smoke test for the React UI.
 *
 * Boots the API + built frontend on a throwaway database, then drives a real
 * Chromium through the demo journey and fails on any console/page error.
 *
 * Requirements (one time):
 *   cd frontend && npm run build
 *   npm i -D playwright-core && npx playwright install chromium
 *
 * Run:
 *   node scripts/ui-smoke.mjs            # headless
 *   SHOTS=./shots node scripts/ui-smoke.mjs   # also save screenshots
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const PORT = Number(process.env.PORT ?? 4123);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`   ${ok ? '\u2713' : '\u2717'} ${label}${extra ? ` ${extra}` : ''}`);
  if (!ok) failures += 1;
};

const env = {
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: 'development',
  SQLITE_FILE: './data/ui-smoke.db',
  PUBLIC_URL: BASE,
  CORS_ORIGIN: BASE,
};

async function waitForServer(timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: path.join(ROOT, 'backend'), env, stdio: 'inherit', ...options });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'frontend', 'dist', 'index.html'))) {
    throw new Error('frontend/dist not found - run `cd frontend && npm run build` first');
  }

  console.log('\n1. Seeding a throwaway database');
  await run('node', ['src/db/seed.js']);

  console.log('\n2. Starting the server');
  const server = spawn('node', ['src/server.js'], {
    cwd: path.join(ROOT, 'backend'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const serverLog = [];
  server.stdout.on('data', (chunk) => serverLog.push(chunk.toString()));
  server.stderr.on('data', (chunk) => serverLog.push(chunk.toString()));

  const stop = () => {
    server.kill('SIGKILL');
  };

  try {
    if (!(await waitForServer())) throw new Error(`server never became healthy:\n${serverLog.join('')}`);
    check('API is healthy', true, BASE);

    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    let shotIndex = 0;
    const shot = async (name) => {
      if (!SHOTS) return;
      shotIndex += 1;
      await page.screenshot({ path: path.join(SHOTS, `${String(shotIndex).padStart(2, '0')}-${name}.png`), fullPage: true });
    };

    const goto = async (route) => {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    };

    // ---- landing ----------------------------------------------------------
    console.log('\n3. Landing page');
    await goto('/');
    check('hero headline rendered', await page.locator('h1').first().isVisible());
    check('live statistics loaded', (await page.locator('.hero-stat').count()) >= 4);
    check('latest reports listed', (await page.locator('.item-card').count()) > 0);
    await shot('landing');

    // ---- search -----------------------------------------------------------
    console.log('\n4. Search & filter');
    await goto('/search');
    await page.fill('#q', 'wallet');
    await page.waitForTimeout(700);
    const walletCards = await page.locator('.item-card').count();
    check('keyword search returns wallet reports', walletCards > 0, `(${walletCards} cards)`);
    await shot('search');

    // ---- login ------------------------------------------------------------
    console.log('\n5. Sign in as Ananya (lost the wallet)');
    await goto('/login');
    await page.fill('#email', 'ananya@campus.edu');
    await page.fill('#password', 'demo1234');
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    check('redirected to the dashboard', page.url().endsWith('/dashboard'));
    // The dashboard fetches after mount - wait for the rendered result, not the URL.
    await page.waitForSelector('.stat', { timeout: 15_000 });
    check('dashboard stats rendered', (await page.locator('.stat').count()) >= 4);
    await shot('dashboard');

    const bellText = await page.locator('.bell-count').first().textContent().catch(() => null);
    check('notification bell shows unread matches', Boolean(bellText), `(${bellText ?? 'none'})`);

    // ---- matches ----------------------------------------------------------
    console.log('\n6. Possible matches');
    await goto('/matches');
    const matchCards = await page.locator('.score-ring').count();
    check('match list rendered with score rings', matchCards > 0, `(${matchCards})`);
    await shot('matches');

    await page.locator('a:has-text("Review match")').first().click();
    await page.waitForURL('**/matches/*');
    check('match detail shows the weighted breakdown', (await page.locator('.factor-row').count()) === 5);
    const scoreText = await page.locator('.score-ring span').first().textContent();
    check('score displayed on the detail page', /\d+%/.test(scoreText ?? ''), `(${scoreText})`);
    await shot('match-detail');

    // ---- claim ------------------------------------------------------------
    console.log('\n7. Claim & ownership verification');
    await page.locator('a:has-text("Claim this item")').first().click();
    await page.waitForURL('**/claim');
    check('verification question shown', await page.locator('.alert-info').first().isVisible());
    await page.fill('#answer', 'My library card, and the right corner is torn');
    await page.fill('#proof', 'It is my wallet - torn right corner, library card and about 400 rupees inside.');
    await shot('claim-form');
    await page.click('button[type=submit]');
    await page.waitForURL('**/claims/*', { timeout: 15_000 });
    check('claim created and detail page opened', /\/claims\/\d+$/.test(page.url()), page.url().replace(BASE, ''));
    await page.waitForSelector('.proof-box', { timeout: 15_000 });
    const gradeVisible = await page
      .locator('text=Automatic proof score')
      .first()
      .isVisible()
      .catch(() => false);
    check('automatic proof score displayed', gradeVisible);
    await shot('claim-submitted');

    const claimId = page.url().split('/').pop();

    // ---- item detail ------------------------------------------------------
    console.log('\n8. Item detail & timeline');
    await goto('/items/2');
    check('status timeline rendered', (await page.locator('.timeline li').count()) === 6);
    check('private detail is not in the page source', !(await page.content()).includes('torn right corner and'));
    await shot('item-detail');

    // ---- reviewer approves ------------------------------------------------
    console.log('\n9. Rahul reviews the claim and confirms handover');
    await page.evaluate(() => localStorage.removeItem('lf_token'));
    await goto('/login');
    await page.fill('#email', 'rahul@campus.edu');
    await page.fill('#password', 'demo1234');
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard');

    await goto(`/claims/${claimId}`);
    await page.locator('button:has-text("Start verification")').click();
    await page.waitForTimeout(900);
    check('claim moved to under review', (await page.content()).includes('Under review'));
    await shot('claim-review');

    await page.locator('button:has-text("Approve claim")').click();
    await page.waitForTimeout(1200);
    check('handover contact unlocked after approval', (await page.content()).includes('Handover contact'));
    await shot('claim-approved');

    await page.locator('button:has-text("Confirm handover")').click();
    await page.waitForTimeout(1200);
    check('case resolved message shown', (await page.content()).includes('Item returned'));
    await shot('handover-confirmed');

    await goto('/items/2');
    const itemPage = await page.content();
    check('item now shows RETURNED', itemPage.includes('Returned'));

    // ---- messages ---------------------------------------------------------
    console.log('\n10. Messaging');
    await goto('/messages');
    check('messages screen rendered', await page.locator('h1:has-text("Messages")').isVisible());
    await shot('messages');

    // ---- admin ------------------------------------------------------------
    console.log('\n11. Admin dashboard');
    await page.evaluate(() => localStorage.removeItem('lf_token'));
    await goto('/login');
    await page.fill('#email', 'admin@campus.edu');
    await page.fill('#password', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard');
    await goto('/admin');
    check('admin analytics rendered', (await page.locator('.stat').count()) >= 4);
    check('hotspot heatmap rendered', (await page.locator('.heat-row').count()) > 0);
    await shot('admin-analytics');

    for (const tab of ['Claims & disputes', 'Reports', 'Users', 'Matches']) {
      await page.locator(`button.tab:has-text("${tab}")`).click();
      await page.waitForSelector('table.data tbody tr, .score-ring', { timeout: 15_000 });
      const rows = await page.locator('table.data tbody tr, .score-ring').count();
      check(`admin tab "${tab}" loads data`, rows > 0, `(${rows} rows)`);
      await shot(`admin-${tab.split(' ')[0].toLowerCase()}`);
    }

    // Moderation writes to the audit trail, so exercise it before checking the log.
    console.log('\n12. Moderation & audit trail');
    await page.locator('button.tab:has-text("Reports")').click();
    await page.waitForSelector('table.data tbody tr');
    await page.locator('table.data tbody tr button:has-text("Hide")').first().click();
    await page.waitForTimeout(1200);
    check('report hidden by the moderator', (await page.locator('.badge-danger:has-text("hidden")').count()) > 0);

    await page.locator('button.tab:has-text("Audit log")').click();
    await page.waitForSelector('table.data tbody tr', { timeout: 15_000 });
    const auditRows = await page.locator('table.data tbody tr').count();
    check('moderation appears in the audit log', auditRows > 0, `(${auditRows} entries)`);
    await shot('admin-audit');

    // ---- 404 --------------------------------------------------------------
    await goto('/definitely-not-a-page');
    check('unknown route shows the 404 screen', (await page.content()).includes('Page not found'));

    // ---- console health ---------------------------------------------------
    console.log('\n13. Browser console');
    const realErrors = consoleErrors.filter((entry) => !entry.includes('favicon') && !entry.includes('Download the React DevTools'));
    check('no console or runtime errors', realErrors.length === 0, realErrors.slice(0, 4).join(' | '));

    await browser.close();
  } finally {
    stop();
  }

  console.log(`\n${'='.repeat(64)}`);
  console.log(failures === 0 ? '  UI SMOKE TEST PASSED' : `  UI SMOKE TEST: ${failures} check(s) failed`);
  console.log('='.repeat(64));
  return failures;
}

main()
  .then((failed) => process.exit(failed === 0 ? 0 : 1))
  .catch((error) => {
    console.error('\nUI smoke test crashed:', error.message);
    process.exit(1);
  });
