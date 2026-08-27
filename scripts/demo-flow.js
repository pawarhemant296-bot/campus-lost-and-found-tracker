#!/usr/bin/env node
/**
 * End-to-end walkthrough of the demo flow for judges (spec section 15).
 *
 *   node scripts/demo-flow.js                 # boots the API in-process on a free port
 *   BASE_URL=http://localhost:4000 node scripts/demo-flow.js   # hit a running server
 *
 * It exercises every module in order and fails loudly if any step breaks:
 *   register/login -> report lost -> report found -> match -> notify
 *   -> claim -> verification -> approve -> chat -> handover -> RETURNED -> admin analytics
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.join(HERE, '..', 'backend', 'src');

let baseUrl = process.env.BASE_URL ?? null;
let server = null;
let db = null;

const step = (n, text) => console.log(`\n${String(n).padStart(2)}. ${text}`);
const detail = (text) => console.log(`    ${text}`);

let failures = 0;
function check(label, condition, extra = '') {
  if (condition) {
    console.log(`    \u2713 ${label}${extra ? ` ${extra}` : ''}`);
  } else {
    failures += 1;
    console.log(`    \u2717 ${label}${extra ? ` ${extra}` : ''}`);
  }
}

async function api(method, endpoint, { token, body, expect } = {}) {
  const response = await fetch(`${baseUrl}/api${endpoint}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (expect && response.status !== expect) {
    throw new Error(`${method} ${endpoint} -> ${response.status} (expected ${expect}): ${text.slice(0, 300)}`);
  }
  if (!expect && !response.ok) {
    throw new Error(`${method} ${endpoint} -> ${response.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

/** Unique emails so the script can be run repeatedly against the same database. */
const stamp = Date.now().toString().slice(-6);
const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

async function bootInProcess() {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.SQLITE_FILE = process.env.SQLITE_FILE ?? './data/demo-flow.db';

  const { createApp } = await import(`file://${path.join(BACKEND, 'app.js')}`);
  const { migrate } = await import(`file://${path.join(BACKEND, 'db', 'migrate.js')}`);
  ({ default: db } = await import(`file://${path.join(BACKEND, 'db', 'index.js')}`));
  const { initRealtime } = await import(`file://${path.join(BACKEND, 'realtime', 'hub.js')}`);

  await migrate({ fresh: true, logger: { log: () => {} } });

  server = http.createServer(createApp());
  initRealtime(server, { log: () => {} });
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  detail(`API booted in-process at ${baseUrl}`);
}

async function main() {
  console.log('='.repeat(74));
  console.log('  Lost & Found Item Tracker - end to end demo flow');
  console.log('='.repeat(74));

  step(0, 'Start the service');
  if (baseUrl) detail(`using running server at ${baseUrl}`);
  else await bootInProcess();

  const health = await api('GET', '/health');
  check('health endpoint reports ok', health.status === 'ok', `(db: ${health.database.client})`);

  // -- 1. Register / login ---------------------------------------------------
  step(1, 'Register the three actors (spec step 2)');
  const admin = await api('POST', '/auth/register', {
    body: { name: 'Campus Admin', email: `admin.${stamp}@campus.edu`, password: 'admin123' },
    expect: 201,
  });
  const ananya = await api('POST', '/auth/register', {
    body: { name: 'Ananya Sharma', email: `ananya.${stamp}@campus.edu`, password: 'demo1234', phone: '+91 90000 00002' },
    expect: 201,
  });
  const rahul = await api('POST', '/auth/register', {
    body: { name: 'Rahul Verma', email: `rahul.${stamp}@campus.edu`, password: 'demo1234', phone: '+91 90000 00003' },
    expect: 201,
  });
  check('first account is promoted to admin', admin.user.role === 'admin');
  check('students register as normal users', ananya.user.role === 'user' && rahul.user.role === 'user');

  const relogin = await api('POST', '/auth/login', {
    body: { email: ananya.user.email, password: 'demo1234' },
  });
  check('login returns a JWT', typeof relogin.token === 'string' && relogin.token.length > 20);
  check('password hash never leaves the API', relogin.user.password_hash === undefined);

  // -- 2. Student A reports the lost wallet ----------------------------------
  step(2, 'Ananya reports a lost black wallet (spec section 4)');
  const lost = await api('POST', '/items/lost', {
    token: ananya.token,
    expect: 201,
    body: {
      title: 'Black leather wallet',
      category: 'Wallet / Purse',
      description:
        'Black leather wallet with a small tear on the right corner. My library card and a few hundred rupees are inside.',
      location: 'College Canteen, Block B',
      latitude: 19.0761,
      longitude: 72.8777,
      occurred_at: hoursAgo(6),
    },
  });
  check('lost report stored with status REPORTED', lost.item.status === 'REPORTED', `(item #${lost.item.item_id})`);
  check('no match yet', lost.new_matches === 0);

  // -- 3. Student B reports the found wallet + matching engine ---------------
  step(3, 'Rahul reports the found wallet - the engine runs immediately (spec sections 5-6)');
  const found = await api('POST', '/items/found', {
    token: rahul.token,
    expect: 201,
    body: {
      title: 'Wallet found in canteen',
      category: 'Wallet / Purse',
      description:
        'Black leather wallet left on a canteen table near the billing counter. The right corner is slightly torn and a few cards are inside.',
      location: 'Canteen, Block B',
      latitude: 19.0762,
      longitude: 72.8779,
      occurred_at: hoursAgo(4),
      verification_question: 'Which cards are inside the wallet, and what is unusual about its condition?',
      secret_details: 'library card and a torn right corner',
    },
  });
  const match = found.best_match;
  check('a possible match was generated', Boolean(match) && found.new_matches === 1);
  check('score is a strong match (>= 75%)', match.match_score >= 75, `-> ${match.match_score}%`);
  check('both items moved to POSSIBLE_MATCH', match.lost_item.status === 'POSSIBLE_MATCH' && match.found_item.status === 'POSSIBLE_MATCH');
  detail('score breakdown:');
  for (const factor of match.breakdown.factors) {
    detail(
      `  ${factor.label.padEnd(28)} ${String(factor.score_pct).padStart(5)}%  x ${String(factor.weight_pct).padStart(2)}%  -> ${String(factor.contribution_pct).padStart(5)} pts  ${factor.skipped ? '(skipped)' : ''}`,
    );
  }

  // -- 4. Notification -------------------------------------------------------
  step(4, 'Ananya is notified (spec step 9)');
  const notifications = await api('GET', '/notifications', { token: ananya.token });
  const matchNotification = notifications.notifications.find((entry) => entry.type === 'MATCH_FOUND');
  check('match notification delivered', Boolean(matchNotification), `("${matchNotification?.title}")`);
  check('unread counter is correct', notifications.unread >= 1);

  // -- 5. Search & filter ----------------------------------------------------
  step(5, 'Search & filter works for anonymous visitors (spec section 12)');
  const search = await api('GET', '/items?q=wallet&type=found&category=Wallet%20%2F%20Purse');
  check('keyword + type + category filter returns the found wallet', search.items.some((entry) => entry.item_id === found.item.item_id));
  const publicView = await api('GET', `/items/${found.item.item_id}`);
  check('private ownership proof is never exposed', publicView.item.secret_details === undefined && publicView.item.has_secret_details === true);
  check('verification question is visible to claimants', Boolean(publicView.item.verification_question));

  // -- 6. Claim + ownership verification ------------------------------------
  step(6, 'Ananya claims the item and answers the verification question (spec section 7)');
  const prompt = await api('GET', `/claims/prompt/${found.item.item_id}`, { token: ananya.token });
  check('verification prompt returned', Boolean(prompt.question) && prompt.requires_answer === true);

  const wrongAttempt = await fetch(`${baseUrl}/api/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rahul.token}` },
    body: JSON.stringify({ item_id: found.item.item_id, proof: 'This is actually my own report' }),
  });
  check('you cannot claim your own report', wrongAttempt.status === 400);

  const claimResponse = await api('POST', '/claims', {
    token: ananya.token,
    expect: 201,
    body: {
      item_id: found.item.item_id,
      match_id: match.match_id,
      proof: 'It is my wallet - the right corner is torn and my library card is inside along with about 400 rupees.',
      answer: 'My library card, and the right corner is torn',
    },
  });
  const claim = claimResponse.claim;
  check('claim stored as PENDING', claim.status === 'PENDING', `(claim #${claim.claim_id})`);
  check('answer graded automatically to assist the reviewer', claim.auto_score > 40, `-> ${claim.auto_score}%`);
  check('contact details stay hidden while pending', claim.contact === null);

  const itemAfterClaim = await api('GET', `/items/${found.item.item_id}`, { token: rahul.token });
  check('item status is now CLAIM_REQUESTED', itemAfterClaim.item.status === 'CLAIM_REQUESTED');

  const outsider = await fetch(`${baseUrl}/api/claims/${claim.claim_id}`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  check('admins may inspect claims for dispute handling', outsider.status === 200);

  // -- 7. Reviewer verifies and approves ------------------------------------
  step(7, 'Rahul reviews the proof and approves (spec steps 11-12)');
  const underReview = await api('POST', `/claims/${claim.claim_id}/review`, { token: rahul.token });
  check('claim moved to UNDER_REVIEW', underReview.claim.status === 'UNDER_REVIEW');
  const itemInVerification = await api('GET', `/items/${found.item.item_id}`, { token: rahul.token });
  check('item status is VERIFICATION', itemInVerification.item.status === 'VERIFICATION');

  const approved = await api('POST', `/claims/${claim.claim_id}/approve`, {
    token: rahul.token,
    body: { note: 'Answer matches the contents exactly.' },
  });
  check('claim APPROVED', approved.claim.status === 'APPROVED');

  const claimantView = (await api('GET', `/claims/${claim.claim_id}`, { token: ananya.token })).claim;
  check(
    'contact details unlocked for both parties',
    Boolean(claimantView.contact?.email),
    `(${claimantView.contact?.name} / ${claimantView.contact?.phone})`,
  );

  // -- 8. Secure communication ----------------------------------------------
  step(8, 'The two students arrange the handover in chat (Communication Module)');
  await api('POST', '/messages', {
    token: ananya.token,
    expect: 201,
    body: { item_id: found.item.item_id, receiver_id: rahul.user.user_id, message: 'Thank you! Can we meet at the library at 5pm?' },
  });
  await api('POST', '/messages', {
    token: rahul.token,
    expect: 201,
    body: { item_id: found.item.item_id, receiver_id: ananya.user.user_id, message: 'Sure, see you at the library entrance.' },
  });
  const thread = await api('GET', `/messages/${found.item.item_id}/${rahul.user.user_id}`, { token: ananya.token });
  check('conversation has both messages', thread.messages.length === 2);

  const strangerChat = await fetch(`${baseUrl}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ item_id: found.item.item_id, receiver_id: 999999, message: 'hello' }),
  });
  check('messaging an unrelated user is rejected', strangerChat.status === 404 || strangerChat.status === 403);

  // -- 9. Handover -> RETURNED ----------------------------------------------
  step(9, 'Rahul confirms the handover - the case resolves (spec step 13)');
  const handover = await api('POST', `/claims/${claim.claim_id}/handover`, { token: rahul.token });
  check('claim HANDOVER_CONFIRMED', handover.claim.status === 'HANDOVER_CONFIRMED');

  const finalFound = await api('GET', `/items/${found.item.item_id}`, { token: rahul.token });
  const finalLost = await api('GET', `/items/${lost.item.item_id}`, { token: ananya.token });
  check('found report is RETURNED', finalFound.item.status === 'RETURNED');
  check("the owner's lost report closes too", finalLost.item.status === 'RETURNED');
  check('resolution timestamp recorded', Boolean(finalFound.item.resolved_at));

  const closed = await api('POST', `/items/${found.item.item_id}/close`, { token: rahul.token });
  check('case can be CLOSED', closed.item.status === 'CLOSED');

  const finalNotifications = await api('GET', '/notifications', { token: ananya.token });
  check(
    'claimant received approval + handover notifications',
    finalNotifications.notifications.some((entry) => entry.type === 'CLAIM_APPROVED') &&
      finalNotifications.notifications.some((entry) => entry.type === 'HANDOVER_CONFIRMED'),
  );

  // -- 9b. The website itself ------------------------------------------------
  // Guard against the "API works but nobody built the UI" failure mode: on a
  // fresh clone frontend/dist does not exist, and / would serve JSON.
  step('9b', 'The web UI is built and served from the API port');
  const homepage = await fetch(baseUrl);
  const homepageBody = await homepage.text();
  const servesHtml = homepage.ok && homepageBody.includes('<div id="root">');
  check(
    'GET / returns the React app',
    servesHtml,
    servesHtml ? '' : '-> run `npm run build` in the repository root',
  );

  // The browser sends an Origin header for the page's own assets. If CORS
  // rejects it, the site breaks on any port outside the default allow-list.
  const assetPath = (homepageBody.match(/src="(\/assets\/[^"]+\.js)"/) ?? [])[1];
  if (assetPath) {
    const asset = await fetch(`${baseUrl}${assetPath}`, { headers: { Origin: baseUrl } });
    check('assets load when the page origin is not in CORS_ORIGIN', asset.ok, `(${assetPath} -> ${asset.status})`);
  }

  // -- 10. Dashboards -------------------------------------------------------
  step(10, 'Dashboards and admin analytics (spec section 12, phase 7)');
  const dashboard = await api('GET', '/items/dashboard', { token: ananya.token });
  check('user dashboard counts reports and matches', dashboard.counts.total >= 1 && dashboard.counts.matches >= 1);

  const overview = await api('GET', '/admin/overview', { token: admin.token });
  check('admin overview aggregates users/items/claims', overview.users.total >= 3 && overview.items.total >= 2 && overview.claims.total >= 1);
  check('resolution rate computed', typeof overview.analytics.resolution_rate === 'number', `-> ${overview.analytics.resolution_rate}%`);
  check('location hotspots available for the heatmap', overview.analytics.hotspots.length >= 1);

  const moderated = await api('PATCH', `/admin/items/${lost.item.item_id}/hide`, {
    token: admin.token,
    body: { hidden: true, reason: 'Duplicate report' },
  });
  check('admin can hide a report', moderated.is_hidden === 1);
  const auditTrail = await api('GET', '/admin/audit', { token: admin.token });
  check('moderation is written to the audit trail', auditTrail.logs.some((entry) => entry.action === 'ITEM_HIDDEN'));

  const forbidden = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${ananya.token}` },
  });
  check('normal users cannot reach admin endpoints', forbidden.status === 403);

  // -- summary --------------------------------------------------------------
  console.log(`\n${'='.repeat(74)}`);
  if (failures === 0) {
    console.log('  RESULT: every step of the lost -> found -> match -> claim -> returned flow passed');
  } else {
    console.log(`  RESULT: ${failures} check(s) FAILED`);
  }
  console.log('='.repeat(74));
  return failures;
}

main()
  .then(async (failed) => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.close().catch(() => {});
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error('\n  DEMO FAILED:', error.message);
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.close().catch(() => {});
    process.exit(1);
  });
