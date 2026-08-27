/**
 * End-to-end demo script — exercises the exact judge walkthrough against a
 * running API (default http://localhost:4000):
 *
 *   Student A loses a wallet → reports it
 *   Student B finds a wallet → reports it (with private questions)
 *   matching engine detects a high-probability match
 *   Student A is notified → submits a claim → answers verification questions
 *   Student B approves → handover confirmed → case RETURNED → CLOSED
 *
 *   node e2e-demo.mjs
 */
const BASE = process.env.BASE || 'http://localhost:4000';
const stamp = Date.now();

let pass = 0;
let fail = 0;

const ok = (label, condition, extra = '') => {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ''}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`);
  }
};

async function call(path, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json?.error || text}`);
  return json;
}

const register = (name, email) =>
  call('/auth/register', { method: 'POST', body: { name, email, password: 'demo1234' } });

console.log(`\n⟡ TraceBack end-to-end demo against ${BASE}\n`);

/* ------------------------------------------------------------ 1. accounts */
console.log('1. Accounts');
const A = await register('Test Student A', `a.${stamp}@college.edu`);
const B = await register('Test Student B', `b.${stamp}@college.edu`);
ok('Student A registered', Boolean(A.token), A.user.email);
ok('Student B registered', Boolean(B.token), B.user.email);

const admin = await call('/auth/login', {
  method: 'POST',
  body: { email: 'admin@traceback.io', password: 'admin1234' },
});
ok('Admin logged in', admin.user.role === 'admin');

/* -------------------------------------------------------- 2. lost report */
console.log('\n2. Student A reports a lost wallet');
const lostForm = new FormData();
lostForm.set('type', 'lost');
lostForm.set('title', 'Brown leather wallet with a gold clasp');
lostForm.set('category', 'Wallet & Purse');
lostForm.set(
  'description',
  'Brown leather wallet with a gold clasp. Inside are my library card, a student bus pass and two 100 rupee notes. There is a small ink stain near the clasp.'
);
lostForm.set('location', 'Central Canteen');
lostForm.set('item_date', new Date(Date.now() - 6 * 3600_000).toISOString());
const lost = await call('/items', { method: 'POST', token: A.token, form: lostForm });
ok('Lost report created', lost.item.id > 0, `item #${lost.item.id}, status ${lost.item.status}`);
ok(
  'Engine ran immediately on creation',
  Array.isArray(lost.matches),
  lost.match_count
    ? `${lost.match_count} pre-existing found report(s) already matched`
    : 'no candidates above threshold yet'
);

/* ------------------------------------------------------- 3. found report */
console.log('\n3. Student B reports the found wallet (with private questions)');
const questions = [
  { q: 'Describe a unique mark on the wallet.', a: 'A small ink stain near the gold clasp' },
  { q: 'What exactly was inside it?', a: 'Library card, student bus pass and two 100 rupee notes' },
];
const foundForm = new FormData();
foundForm.set('type', 'found');
foundForm.set('title', 'Brown wallet with gold clasp found at canteen');
foundForm.set('category', 'Wallet & Purse');
foundForm.set(
  'description',
  'Found a brown leather wallet with a gold clasp on a canteen table. It contains a library card, a bus pass and some cash. Ink stain on the outside.'
);
foundForm.set('location', 'Central Canteen');
foundForm.set('item_date', new Date(Date.now() - 5 * 3600_000).toISOString());
foundForm.set('questions', JSON.stringify(questions));
const found = await call('/items', { method: 'POST', token: B.token, form: foundForm });
ok('Found report created', found.item.id > 0, `item #${found.item.id}`);

/* ---------------------------------------------------------- 4. matching */
console.log('\n4. Matching engine');
ok('Match generated', found.match_count >= 1, `${found.match_count} pair(s)`);
const match = found.matches.find((m) => m.lost_item_id === lost.item.id);
ok('Correct pair produced', Boolean(match), match && `score ${match.match_score}%`);
ok('Score is high-probability (≥70%)', match.match_score >= 70, `${match.match_score}%`);
const factorKeys = (match.breakdown.factors || []).map((f) => f.key).join(', ');
ok('All five factors scored', (match.breakdown.factors || []).length === 5, factorKeys);

const aMatches = await call('/matches', { token: A.token });
ok('Owner sees the match', aMatches.matches.some((m) => m.id === match.id));
ok(
  'Owner perspective is "owner"',
  aMatches.matches.find((m) => m.id === match.id)?.perspective === 'owner'
);

const lostAfter = await call(`/items/${lost.item.id}`);
ok('Lost item advanced to POSSIBLE MATCH', lostAfter.item.status === 'possible_match', lostAfter.item.status);
ok(
  'Reporter identity is masked publicly',
  lostAfter.item.reporter.name.includes('•'),
  lostAfter.item.reporter.name
);

/* ----------------------------------------------------- 5. notifications */
console.log('\n5. Notifications');
const notifs = await call('/notifications', { token: A.token });
ok('Owner notified of the match', notifs.notifications.some((n) => n.type === 'match'), notifs.notifications[0]?.title);
ok('Unread counter set', notifs.unread > 0, `${notifs.unread} unread`);

/* ------------------------------------------------------------- 6. claim */
console.log('\n6. Claim & ownership verification');
const publicView = await call(`/items/${found.item.id}`, { token: A.token });
ok('Question prompts are public', publicView.verification_questions.length === 2);
ok(
  'Private answers are never exposed',
  !JSON.stringify(publicView).includes('ink stain near the gold clasp'),
);

const { claim } = await call('/claims', {
  method: 'POST',
  token: A.token,
  body: { item_id: found.item.id, match_id: match.id, note: 'I lost it at the canteen this morning.' },
});
ok('Claim submitted', claim.id > 0, `claim #${claim.id}, stage ${claim.stage}`);
const afterClaim = await call(`/items/${found.item.id}`);
ok('Found item → CLAIM REQUESTED', afterClaim.item.status === 'claim_requested', afterClaim.item.status);

const verified = await call(`/claims/${claim.id}/verify`, {
  method: 'POST',
  token: A.token,
  body: {
    answers: [
      'There is a small ink stain right next to the gold clasp',
      'My library card, the student bus pass and two 100 rupee notes',
    ],
    note: 'Happy to show an older photo of the wallet too.',
  },
});
ok('Answers auto-scored', verified.auto_score > 60, `${verified.auto_score}%`);
ok('Claim moved to review', verified.claim.stage === 'review', verified.claim.stage);
const afterVerify = await call(`/items/${found.item.id}`);
ok('Found item → VERIFICATION', afterVerify.item.status === 'verification', afterVerify.item.status);

const finderNotifs = await call('/notifications', { token: B.token });
ok('Finder notified to review', finderNotifs.notifications.some((n) => n.type === 'claim'));

/* --------------------------------------------------- 7. wrong claimant */
console.log('\n7. A stranger cannot claim it');
const C = await register('Test Student C', `c.${stamp}@college.edu`);
const { claim: badClaim } = await call('/claims', {
  method: 'POST',
  token: C.token,
  body: { item_id: found.item.id },
});
const badVerify = await call(`/claims/${badClaim.id}/verify`, {
  method: 'POST',
  token: C.token,
  body: { answers: ['It is red and shiny', 'Some coins I think'] },
});
ok('Wrong answers score low', badVerify.auto_score < 40, `${badVerify.auto_score}%`);
ok(
  'Genuine owner scores far higher',
  verified.auto_score - badVerify.auto_score > 30,
  `${verified.auto_score}% vs ${badVerify.auto_score}%`
);
await call(`/claims/${badClaim.id}/decision`, {
  method: 'POST',
  token: B.token,
  body: { decision: 'reject', note: 'Details do not match.' },
});
const rejected = await call(`/claims/${badClaim.id}`, { token: C.token });
ok('Bogus claim rejected', rejected.claim.status === 'rejected');
const { dispute_id } = await call(`/claims/${badClaim.id}/dispute`, {
  method: 'POST',
  token: C.token,
  body: { reason: 'I still believe this wallet is mine, please have an admin review it.' },
});
ok('Dispute can be raised', dispute_id > 0, `dispute #${dispute_id}`);

/* ------------------------------------------------------- 8. approval */
console.log('\n8. Finder approves the genuine claim');
const approved = await call(`/claims/${claim.id}/decision`, {
  method: 'POST',
  token: B.token,
  body: { decision: 'approve', note: 'Ink stain and contents match exactly.' },
});
ok('Claim approved', approved.claim.status === 'approved', `stage ${approved.claim.stage}`);
const claimantView = await call(`/claims/${claim.id}`, { token: A.token });
ok(
  'Identity revealed after approval',
  !claimantView.claim.reporter_name.includes('•'),
  claimantView.claim.reporter_name
);

/* --------------------------------------------------------- 9. messages */
console.log('\n9. Handover coordination');
await call('/messages', {
  method: 'POST',
  token: A.token,
  body: { receiver_id: B.user.id, item_id: found.item.id, message: 'Can we meet at the security desk at 5pm?' },
});
await call('/messages', {
  method: 'POST',
  token: B.token,
  body: { receiver_id: A.user.id, item_id: found.item.id, message: 'Works for me, see you there.' },
});
const thread = await call(`/messages/thread/${B.user.id}?item_id=${found.item.id}`, { token: A.token });
ok('Chat thread works', thread.messages.length === 2, `${thread.messages.length} messages`);
const threads = await call('/messages/threads', { token: B.token });
ok('Thread list carries item context', threads.threads[0]?.item?.id === found.item.id);

/* ------------------------------------------------------- 10. handover */
console.log('\n10. Handover → RETURNED → CLOSED');
await call(`/claims/${claim.id}/handover`, { method: 'POST', token: B.token });
const returnedFound = await call(`/items/${found.item.id}`);
const returnedLost = await call(`/items/${lost.item.id}`);
ok('Found item → RETURNED', returnedFound.item.status === 'returned', returnedFound.item.status);
ok('Paired lost item → RETURNED', returnedLost.item.status === 'returned', returnedLost.item.status);

await call(`/claims/${claim.id}/close`, { method: 'POST', token: A.token });
const closed = await call(`/items/${found.item.id}`);
ok('Case → CLOSED', closed.item.status === 'closed', closed.item.status);

/* ---------------------------------------------------------- 11. admin */
console.log('\n11. Admin console');
const overview = await call('/admin/overview', { token: admin.token });
ok('KPIs available', overview.kpis.total_reports > 0, `${overview.kpis.total_reports} reports`);
const analytics = await call('/admin/analytics', { token: admin.token });
ok('Analytics available', Array.isArray(analytics.category_breakdown));
ok('Match success rate computed', typeof analytics.rates.match_success_rate === 'number', `${analytics.rates.match_success_rate}%`);
const disputes = await call('/admin/disputes', { token: admin.token });
ok('Dispute reached the admin queue', disputes.disputes.some((d) => d.id === dispute_id));
await call(`/admin/disputes/${dispute_id}`, {
  method: 'PATCH',
  token: admin.token,
  body: { status: 'dismissed', resolution: 'The verification answers did not match the stored details.' },
});
ok('Admin resolved the dispute', true);

const settings = await call('/admin/settings', { token: admin.token });
ok(
  'Default weights follow the problem statement',
  settings.settings.weight_category === 25 &&
    settings.settings.weight_description === 25 &&
    settings.settings.weight_location === 20 &&
    settings.settings.weight_date === 15 &&
    settings.settings.weight_image === 15,
  '25/25/20/15/15'
);

/* ------------------------------------------------------- 12. security */
console.log('\n12. Access control');
let blocked = false;
try {
  await call('/admin/overview', { token: A.token });
} catch (err) {
  blocked = err.message.includes('403');
}
ok('Non-admins cannot reach the admin API', blocked);

let unauth = false;
try {
  await call('/claims');
} catch (err) {
  unauth = err.message.includes('401');
}
ok('Protected routes require a token', unauth);

let selfClaim = false;
try {
  await call('/claims', { method: 'POST', token: B.token, body: { item_id: found.item.id } });
} catch (err) {
  selfClaim = err.message.includes('400');
}
ok('You cannot claim your own report', selfClaim);

console.log(`\n⟡ ${pass} checks passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
