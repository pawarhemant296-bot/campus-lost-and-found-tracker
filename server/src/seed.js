/**
 * TraceBack demo seeder
 * ---------------------------------------------------------------------------
 * Wipes and repopulates the database with a realistic campus dataset so the
 * whole lost → found → match → claim → verify → return journey (and every
 * analytics chart) is demo-ready the moment the app boots.
 *
 *   npm run seed            # from /server, or `npm run seed` at the repo root
 */
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { config } from './config.js';
import { hashPassword } from './auth.js';
import { writeSeedImage } from './images.js';
import { runMatchingForItem } from './services.js';
import { scoreAnswers } from './matching.js';

const DAY = 86_400_000;
const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const sqlDate = (msAgo) => new Date(now - msAgo).toISOString().slice(0, 19).replace('T', ' ');

/* ------------------------------------------------------------------- reset */

console.log('⟡ resetting database…');
db.pragma('foreign_keys = OFF');
for (const t of ['disputes', 'notifications', 'messages', 'claims', 'matches', 'items', 'users']) {
  db.prepare(`DELETE FROM ${t}`).run();
  db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(t);
}
db.pragma('foreign_keys = ON');

for (const f of fs.readdirSync(config.uploadDir)) {
  if (f.startsWith('seed-')) fs.unlinkSync(path.join(config.uploadDir, f));
}

/* ------------------------------------------------------------------- users */

const PASSWORD = 'demo1234';
const users = [
  ['Aarav Sharma', 'aarav@college.edu', 'user', 265, 'Main Campus', '+91 90000 11111'],
  ['Priya Menon', 'priya@college.edu', 'user', 292, 'Main Campus', '+91 90000 22222'],
  ['Rohit Verma', 'rohit@college.edu', 'user', 212, 'Main Campus', '+91 90000 33333'],
  ['Sneha Iyer', 'sneha@college.edu', 'user', 320, 'North Campus', '+91 90000 44444'],
  ['Kabir Khan', 'kabir@college.edu', 'user', 248, 'North Campus', '+91 90000 55555'],
  ['Meera Nair', 'meera@college.edu', 'user', 278, 'Main Campus', '+91 90000 66666'],
  ['Campus Admin', 'admin@traceback.io', 'admin', 270, 'Security Office', '+91 90000 00000'],
];

const insertUser = db.prepare(
  `INSERT INTO users (name, email, password_hash, role, avatar_hue, campus, phone, created_at)
   VALUES (?,?,?,?,?,?,?,?)`
);
const U = {};
users.forEach(([name, email, role, hue, campus, phone], i) => {
  const info = insertUser.run(
    name,
    email,
    hashPassword(role === 'admin' ? 'admin1234' : PASSWORD),
    role,
    hue,
    campus,
    phone,
    sqlDate((40 - i * 3) * DAY)
  );
  U[email] = Number(info.lastInsertRowid);
});
console.log(`⟡ ${users.length} users created`);

/* ------------------------------------------------------------------- items */

/**
 * glyph = a single ASCII character rendered on the placeholder art. Items that
 * belong to the same real-world object share hue + glyph so the perceptual
 * image hash genuinely contributes to their match score.
 */
const items = [
  {
    key: 'lost_wallet',
    email: 'aarav@college.edu',
    type: 'lost',
    title: 'Black leather wallet',
    category: 'Wallet & Purse',
    description:
      'Black leather bifold wallet with a small silver zip. Contains my college ID card, a blue metro card and about 300 rupees. There is a faded scratch on the front near the bottom right corner.',
    location: 'Central Canteen',
    daysAgo: 2.1,
    createdDaysAgo: 2,
    hue: 268,
    glyph: 'W',
    art: 'Black leather wallet',
  },
  {
    key: 'found_wallet',
    email: 'priya@college.edu',
    type: 'found',
    title: 'Black wallet found near canteen counter',
    category: 'Wallet & Purse',
    description:
      'Found a black leather wallet on a table near the billing counter. It has a silver zip, a student ID inside and a blue travel card. Handed nothing over yet — keeping it safe until the owner is verified.',
    location: 'Central Canteen',
    daysAgo: 2,
    createdDaysAgo: 1.8,
    hue: 268,
    glyph: 'W',
    art: 'Wallet found in canteen',
    questions: [
      { q: 'Describe a unique mark, scratch or sticker on the wallet.', a: 'A faded scratch on the front near the bottom right corner' },
      { q: 'What exactly was inside it?', a: 'College ID card, a blue metro card and about 300 rupees' },
      { q: 'What is the brand and colour?', a: 'Plain black leather bifold with a silver zip' },
    ],
  },
  {
    key: 'lost_phone',
    email: 'rohit@college.edu',
    type: 'lost',
    title: 'Redmi Note 12 with cracked screen guard',
    category: 'Mobile Phone',
    description:
      'Graphite grey Redmi Note 12. The screen guard has a crack in the top-left corner and the back cover is transparent with a small anime sticker. Lock screen is a photo of a mountain.',
    location: 'Main Library',
    daysAgo: 5,
    createdDaysAgo: 5,
    hue: 214,
    glyph: 'P',
    art: 'Grey smartphone',
  },
  {
    key: 'found_phone',
    email: 'sneha@college.edu',
    type: 'found',
    title: 'Grey Android phone on library reading desk',
    category: 'Mobile Phone',
    description:
      'Picked up a grey Android phone from a reading desk on the first floor of the library. Transparent back cover with a sticker, screen protector is chipped at one corner. Submitted to the library desk.',
    location: 'Main Library',
    daysAgo: 4.6,
    createdDaysAgo: 4.5,
    hue: 214,
    glyph: 'P',
    art: 'Android phone found',
    questions: [
      { q: 'What was the lock screen / wallpaper?', a: 'A photo of a mountain' },
      { q: 'Describe a unique mark, scratch or sticker on the item.', a: 'Transparent back cover with a small anime sticker, cracked screen guard top-left' },
    ],
  },
  {
    key: 'lost_bottle',
    email: 'meera@college.edu',
    type: 'lost',
    title: 'Purple steel water bottle',
    category: 'Water Bottle',
    description:
      'One litre purple stainless steel sipper with a black lid. My name "MEERA" is written on the base with a marker.',
    location: 'Sports Ground',
    daysAgo: 8,
    createdDaysAgo: 8,
    hue: 288,
    glyph: 'B',
    art: 'Purple bottle',
  },
  {
    key: 'found_bottle',
    email: 'kabir@college.edu',
    type: 'found',
    title: 'Steel sipper bottle left at the ground',
    category: 'Water Bottle',
    description:
      'Someone left a purple steel bottle with a black lid near the cricket nets after practice. There is a name written under it.',
    location: 'Sports Ground',
    daysAgo: 7.8,
    createdDaysAgo: 7.6,
    hue: 288,
    glyph: 'B',
    art: 'Steel sipper found',
    questions: [
      { q: 'Can you share a serial number or identifying detail?', a: 'The name MEERA is written on the base with a marker' },
    ],
  },
  {
    key: 'returned_id',
    email: 'sneha@college.edu',
    type: 'lost',
    title: 'College ID card — Sneha Iyer',
    category: 'ID & Documents',
    description: 'Student ID card with a blue lanyard, roll number ending 4471.',
    location: 'Block A — Classrooms',
    daysAgo: 20,
    createdDaysAgo: 20,
    hue: 200,
    glyph: 'I',
    art: 'ID card',
    finalStatus: 'returned',
  },
  {
    key: 'returned_id_found',
    email: 'rohit@college.edu',
    type: 'found',
    title: 'ID card with blue lanyard found in A-204',
    category: 'ID & Documents',
    description: 'Found a student ID card with a blue lanyard on a bench in room A-204.',
    location: 'Block A — Classrooms',
    daysAgo: 19.7,
    createdDaysAgo: 19.5,
    hue: 200,
    glyph: 'I',
    art: 'ID card found',
    finalStatus: 'returned',
    questions: [{ q: 'What is the roll number on the card?', a: 'Ends with 4471' }],
  },
  {
    key: 'lost_earbuds',
    email: 'kabir@college.edu',
    type: 'lost',
    title: 'White wireless earbuds case',
    category: 'Electronics',
    description: 'Small white charging case for wireless earbuds. Slight yellow tint on the lid hinge.',
    location: 'Bus Stop / Shuttle Bay',
    daysAgo: 1.2,
    createdDaysAgo: 1.1,
    hue: 236,
    glyph: 'E',
    art: 'Earbuds case',
  },
  {
    key: 'found_keys',
    email: 'meera@college.edu',
    type: 'found',
    title: 'Bunch of keys with a red keychain',
    category: 'Keys',
    description: 'Three keys on a ring with a red rubber keychain shaped like a heart. Found on the parking ramp.',
    location: 'Parking Lot',
    daysAgo: 3,
    createdDaysAgo: 3,
    hue: 350,
    glyph: 'K',
    art: 'Keys with keychain',
    questions: [{ q: 'How many keys are on the ring and what shape is the keychain?', a: 'Three keys, heart shaped red keychain' }],
  },
  {
    key: 'found_specs',
    email: 'priya@college.edu',
    type: 'found',
    title: 'Black-framed spectacles in a blue case',
    category: 'Eyewear',
    description: 'Rectangular black frames inside a hard navy blue case, found in Computer Lab 3.',
    location: 'Computer Lab 3',
    daysAgo: 6,
    createdDaysAgo: 6,
    hue: 224,
    glyph: 'G',
    art: 'Spectacles',
    questions: [{ q: 'What colour is the case and are the lenses power or zero?', a: 'Navy blue hard case, power lenses' }],
  },
  {
    key: 'lost_laptop_bag',
    email: 'aarav@college.edu',
    type: 'lost',
    title: 'Navy blue laptop backpack',
    category: 'Bag & Backpack',
    description:
      'Navy blue backpack with a padded laptop sleeve, one broken zip pull and a small college fest badge pinned on the strap.',
    location: 'Auditorium',
    daysAgo: 11,
    createdDaysAgo: 11,
    hue: 222,
    glyph: 'A',
    art: 'Laptop backpack',
  },
  {
    key: 'found_umbrella',
    email: 'rohit@college.edu',
    type: 'found',
    title: 'Folding umbrella left in seminar hall',
    category: 'Umbrella',
    description: 'Compact black folding umbrella with a wooden handle, left under a chair in the seminar hall.',
    location: 'Seminar Hall',
    daysAgo: 14,
    createdDaysAgo: 14,
    hue: 258,
    glyph: 'U',
    art: 'Folding umbrella',
  },
  {
    key: 'lost_calculator',
    email: 'meera@college.edu',
    type: 'lost',
    title: 'Casio scientific calculator FX-991',
    category: 'Books & Stationery',
    description: 'Casio FX-991EX scientific calculator, my initials M.N. scratched on the back panel.',
    location: 'Block B — Labs',
    daysAgo: 25,
    createdDaysAgo: 25,
    hue: 304,
    glyph: 'C',
    art: 'Scientific calculator',
  },
  {
    key: 'found_hoodie',
    email: 'kabir@college.edu',
    type: 'found',
    title: 'Grey hoodie on the basketball court bench',
    category: 'Clothing',
    description: 'Oversized grey hoodie, size L, with a small paint stain on the left sleeve.',
    location: 'Basketball Court',
    daysAgo: 9,
    createdDaysAgo: 9,
    hue: 240,
    glyph: 'H',
    art: 'Grey hoodie',
    questions: [{ q: 'Describe any stain or mark on it.', a: 'Small paint stain on the left sleeve' }],
  },
];

const insertItem = db.prepare(
  `INSERT INTO items
     (user_id, type, title, category, description, location, item_date, image_url, image_hash,
      status, questions, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
);

const ID = {};
for (const it of items) {
  const fileName = `seed-${it.key}.png`;
  const { fileName: written, hash } = await writeSeedImage(fileName, {
    label: it.art,
    hue: it.hue,
    glyph: it.glyph,
  });
  const info = insertItem.run(
    U[it.email],
    it.type,
    it.title,
    it.category,
    it.description,
    it.location,
    iso(it.daysAgo * DAY),
    `/uploads/${written}`,
    hash,
    it.status || 'reported',
    JSON.stringify(it.questions || []),
    sqlDate(it.createdDaysAgo * DAY),
    sqlDate(it.createdDaysAgo * DAY)
  );
  ID[it.key] = Number(info.lastInsertRowid);
}
console.log(`⟡ ${items.length} item reports created (with generated artwork + perceptual hashes)`);

/* ----------------------------------------------------------------- matching */

for (const key of Object.keys(ID)) {
  runMatchingForItem(ID[key]);
}
// Already-resolved historical cases are matched first, then closed out.
for (const it of items) {
  if (it.finalStatus) {
    db.prepare('UPDATE items SET status = ? WHERE id = ?').run(it.finalStatus, ID[it.key]);
  }
}
console.log(`⟡ matching engine produced ${db.prepare('SELECT COUNT(*) AS c FROM matches').get().c} match pairs`);

const matchFor = (lostKey, foundKey) =>
  db.prepare('SELECT * FROM matches WHERE lost_item_id = ? AND found_item_id = ?').get(ID[lostKey], ID[foundKey]);

/* -------------------------------------------------- claim 1: awaiting review */

const walletMatch = matchFor('lost_wallet', 'found_wallet');
const walletQuestions = JSON.parse(
  db.prepare('SELECT questions FROM items WHERE id = ?').get(ID['found_wallet']).questions
);
const walletAnswers = [
  'There is a faded scratch on the front, bottom right corner',
  'My college ID, a blue metro card and around 300 rupees in cash',
  'Plain black leather bifold, silver zip, no brand logo',
];
const walletScore = scoreAnswers(walletQuestions, walletAnswers);

const claimInsert = db.prepare(
  `INSERT INTO claims (item_id, match_id, claimant_id, proof, answer_score, stage, status, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?)`
);

const walletClaimId = Number(
  claimInsert.run(
    ID['found_wallet'],
    walletMatch?.id ?? null,
    U['aarav@college.edu'],
    JSON.stringify({
      note: 'This is definitely my wallet — I lost it at the canteen on the same afternoon.',
      answers: walletQuestions.map((q, i) => ({ q: q.q, a: walletAnswers[i] })),
      scored_detail: walletScore?.detail ?? null,
      submitted_at: iso(1.2 * DAY),
    }),
    walletScore?.score ?? null,
    'review',
    'open',
    sqlDate(1.5 * DAY),
    sqlDate(1.2 * DAY)
  ).lastInsertRowid
);
db.prepare("UPDATE items SET status = 'verification' WHERE id = ?").run(ID['found_wallet']);
db.prepare("UPDATE items SET status = 'claim_requested' WHERE id = ?").run(ID['lost_wallet']);
if (walletMatch) db.prepare("UPDATE matches SET status = 'claimed' WHERE id = ?").run(walletMatch.id);

/* ----------------------------------------- claim 2: fully resolved / returned */

const idMatch = matchFor('returned_id', 'returned_id_found');
const resolvedClaimId = Number(
  claimInsert.run(
    ID['returned_id_found'],
    idMatch?.id ?? null,
    U['sneha@college.edu'],
    JSON.stringify({
      note: 'That is my ID card, roll number ends with 4471.',
      answers: [{ q: 'What is the roll number on the card?', a: 'It ends with 4471' }],
      submitted_at: iso(19 * DAY),
    }),
    94.5,
    'returned',
    'closed',
    sqlDate(19.4 * DAY),
    sqlDate(18.6 * DAY)
  ).lastInsertRowid
);
if (idMatch) db.prepare("UPDATE matches SET status = 'confirmed' WHERE id = ?").run(idMatch.id);

/* --------------------------------------------- claim 3: rejected + disputed */

const specsClaimId = Number(
  claimInsert.run(
    ID['found_specs'],
    null,
    U['kabir@college.edu'],
    JSON.stringify({
      note: 'I think these are mine, I lost my glasses somewhere in the lab block.',
      answers: [{ q: 'What colour is the case and are the lenses power or zero?', a: 'Black case, zero power' }],
      submitted_at: iso(5 * DAY),
    }),
    31.2,
    'rejected',
    'rejected',
    sqlDate(5.4 * DAY),
    sqlDate(4.9 * DAY)
  ).lastInsertRowid
);
db.prepare('UPDATE claims SET decided_by = ?, decision_note = ? WHERE id = ?').run(
  U['priya@college.edu'],
  'The case is navy blue and the lenses are power lenses — details do not match.',
  specsClaimId
);
db.prepare('INSERT INTO disputes (claim_id, raised_by, reason, status, created_at) VALUES (?,?,?,?,?)').run(
  specsClaimId,
  U['kabir@college.edu'],
  'I answered from memory and got the case colour wrong, but I am sure the spectacles are mine. Please review with the admin.',
  'open',
  sqlDate(4.5 * DAY)
);

/* ------------------------------------------------------------------ messages */

const insertMessage = db.prepare(
  'INSERT INTO messages (sender_id, receiver_id, item_id, message, read_status, created_at) VALUES (?,?,?,?,?,?)'
);
const thread = [
  [U['aarav@college.edu'], U['priya@college.edu'], 'Hi! I think the wallet you found is mine — I lost it at the canteen on Tuesday afternoon.', 1, 1.45],
  [U['priya@college.edu'], U['aarav@college.edu'], 'Hey! Possibly. I have submitted a few verification questions on the report, could you answer those first?', 1, 1.4],
  [U['aarav@college.edu'], U['priya@college.edu'], 'Done, I have submitted the answers including the scratch on the front and what was inside.', 1, 1.2],
  [U['priya@college.edu'], U['aarav@college.edu'], 'Great, everything lines up. Shall we meet at the security office tomorrow at 4 pm for the handover?', 0, 0.6],
];
for (const [s, r, msg, read, daysAgo] of thread) {
  insertMessage.run(s, r, ID['found_wallet'], msg, read, sqlDate(daysAgo * DAY));
}
insertMessage.run(
  U['rohit@college.edu'],
  U['sneha@college.edu'],
  ID['found_phone'],
  'Thanks for depositing the phone at the library desk — I have raised a claim, the crack on the screen guard matches.',
  0,
  sqlDate(4.2 * DAY)
);

/* ------------------------------------------------------------- notifications */

const insertNotification = db.prepare(
  'INSERT INTO notifications (user_id, type, title, message, link, read_status, created_at) VALUES (?,?,?,?,?,?,?)'
);
insertNotification.run(
  U['aarav@college.edu'],
  'claim',
  'Verification answers received',
  'Priya M. is reviewing your answers for the black wallet claim.',
  `/app/claims/${walletClaimId}`,
  0,
  sqlDate(1.15 * DAY)
);
insertNotification.run(
  U['priya@college.edu'],
  'claim',
  'Claim awaiting your review',
  'Aarav S. answered all 3 verification questions with a 90%+ auto-score.',
  `/app/claims/${walletClaimId}`,
  0,
  sqlDate(1.2 * DAY)
);
insertNotification.run(
  U['sneha@college.edu'],
  'system',
  'Case closed — item returned',
  'Your college ID card was handed back and the case is marked RETURNED.',
  `/app/claims/${resolvedClaimId}`,
  1,
  sqlDate(18.5 * DAY)
);
insertNotification.run(
  U['admin@traceback.io'],
  'system',
  'Dispute needs moderation',
  'Kabir K. disputed the rejected spectacles claim.',
  '/admin/disputes',
  0,
  sqlDate(4.4 * DAY)
);

/* -------------------------------------------------------------------- report */

const summary = {
  users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
  items: db.prepare('SELECT COUNT(*) AS c FROM items').get().c,
  matches: db.prepare('SELECT COUNT(*) AS c FROM matches').get().c,
  claims: db.prepare('SELECT COUNT(*) AS c FROM claims').get().c,
  messages: db.prepare('SELECT COUNT(*) AS c FROM messages').get().c,
  notifications: db.prepare('SELECT COUNT(*) AS c FROM notifications').get().c,
  disputes: db.prepare('SELECT COUNT(*) AS c FROM disputes').get().c,
};

const top = db
  .prepare(
    `SELECT m.match_score, l.title AS lost, f.title AS found
       FROM matches m JOIN items l ON l.id = m.lost_item_id JOIN items f ON f.id = m.found_item_id
      ORDER BY m.match_score DESC LIMIT 5`
  )
  .all();

console.log('\n⟡ seed complete');
console.table(summary);
console.log('\n  Top matches produced by the engine:');
for (const t of top) {
  console.log(`   ${String(Math.round(t.match_score)).padStart(3)}%  ${t.lost}  ⇄  ${t.found}`);
}
console.log(`
  Demo logins
  ───────────────────────────────────────────────
  Owner (lost the wallet) : aarav@college.edu  / demo1234
  Finder (found it)       : priya@college.edu  / demo1234
  Other users             : rohit@ / sneha@ / kabir@ / meera@college.edu / demo1234
  Admin                   : admin@traceback.io / admin1234
`);
