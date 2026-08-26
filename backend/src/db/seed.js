/**
 * Demo data for the hackathon presentation.
 *
 *   node src/db/seed.js           # fresh database + demo data
 *   node src/db/seed.js --keep    # keep existing rows, just add demo data
 *
 * The narrative from spec section 15 is pre-built: Ananya lost a black wallet in
 * the college canteen and Rahul found one there, which the engine matches at a
 * high score. The claim is intentionally left unsubmitted so the full
 * claim -> verification -> handover flow can be demonstrated live.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import config from '../config/env.js';
import db from './index.js';
import { migrate } from './migrate.js';
import * as itemsRepo from '../modules/items/items.repository.js';
import { runMatchingForItem } from '../modules/matches/matches.service.js';
import { ITEM_STATUS, ROLES, now } from '../utils/constants.js';

const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();
const daysAgo = (days) => hoursAgo(days * 24);

const USERS = [
  { name: 'Campus Admin', email: 'admin@campus.edu', password: 'admin123', role: ROLES.ADMIN, phone: '+91 90000 00001' },
  { name: 'Ananya Sharma', email: 'ananya@campus.edu', password: 'demo1234', role: ROLES.USER, phone: '+91 90000 00002' },
  { name: 'Rahul Verma', email: 'rahul@campus.edu', password: 'demo1234', role: ROLES.USER, phone: '+91 90000 00003' },
  { name: 'Priya Nair', email: 'priya@campus.edu', password: 'demo1234', role: ROLES.USER, phone: '+91 90000 00004' },
  { name: 'Imran Khan', email: 'imran@campus.edu', password: 'demo1234', role: ROLES.USER, phone: '+91 90000 00005' },
];

/** `owner` refers to the email of the reporting user. */
const ITEMS = [
  {
    owner: 'ananya@campus.edu',
    type: 'lost',
    title: 'Black leather wallet',
    category: 'Wallet / Purse',
    description:
      'Black leather wallet with a small tear on the right corner. Contains my library card and a few hundred rupees. Lost it while having lunch.',
    location: 'College Canteen, Block B',
    latitude: 19.0761,
    longitude: 72.8777,
    occurred_at: hoursAgo(30),
  },
  {
    owner: 'rahul@campus.edu',
    type: 'found',
    title: 'Wallet found in canteen',
    category: 'Wallet / Purse',
    description:
      'Black leather wallet on a canteen table near the billing counter. The right corner is slightly torn and there are a few cards inside. Keeping it safe until the owner turns up.',
    location: 'Canteen, Block B',
    latitude: 19.0762,
    longitude: 72.8779,
    occurred_at: hoursAgo(26),
    verification_question: 'Which cards are inside the wallet, and what is unusual about its condition?',
    secret_details: 'library card and a torn right corner',
  },
  {
    owner: 'priya@campus.edu',
    type: 'lost',
    title: 'Blue Hydro water bottle',
    category: 'Water Bottle',
    description: 'Dark blue steel water bottle with a dent on the base and a sticker of a mountain.',
    location: 'Sports Ground',
    occurred_at: daysAgo(3),
  },
  {
    owner: 'imran@campus.edu',
    type: 'found',
    title: 'Steel bottle near basketball court',
    category: 'Water Bottle',
    description: 'Blue steel bottle with a mountain sticker, left near the basketball court bench.',
    location: 'Sports Ground, basketball court',
    occurred_at: daysAgo(3) ,
    verification_question: 'What sticker is on the bottle?',
    secret_details: 'a mountain sticker and a dent at the bottom',
  },
  {
    owner: 'imran@campus.edu',
    type: 'lost',
    title: 'Redmi Note 12 phone',
    category: 'Mobile Phone',
    description: 'Grey Redmi Note 12 with a transparent cover and a cracked screen protector.',
    location: 'Library second floor',
    occurred_at: daysAgo(1),
  },
  {
    owner: 'priya@campus.edu',
    type: 'found',
    title: 'ID card of a first year student',
    category: 'ID Card / Documents',
    description: 'Found a student ID card near the main gate. Name partially visible.',
    location: 'Main Gate',
    occurred_at: hoursAgo(8),
    verification_question: 'What is your roll number?',
    secret_details: 'roll number 21CS045',
  },
  {
    owner: 'ananya@campus.edu',
    type: 'found',
    title: 'Set of keys with a red keychain',
    category: 'Keys',
    description: 'Three keys on a ring with a red plastic keychain shaped like a car.',
    location: 'Parking Lot A',
    occurred_at: daysAgo(5),
    verification_question: 'How many keys are on the ring and what shape is the keychain?',
    secret_details: 'three keys and a red car shaped keychain',
  },
  {
    owner: 'rahul@campus.edu',
    type: 'lost',
    title: 'Casio scientific calculator',
    category: 'Books / Stationery',
    description: 'Casio FX-991 calculator, my name is written on the back with a marker.',
    location: 'Exam Hall 3',
    occurred_at: daysAgo(7),
  },
];

async function seedUsers(logger) {
  const created = {};
  for (const user of USERS) {
    const existing = await db.one('SELECT * FROM users WHERE LOWER(email) = ?', [user.email.toLowerCase()]);
    if (existing) {
      created[user.email] = existing;
      continue;
    }
    const passwordHash = await bcrypt.hash(user.password, config.auth.bcryptRounds);
    created[user.email] = await db.insertReturning(
      `INSERT INTO users (name, email, password_hash, role, phone, email_verified, is_blocked, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, ?)
       RETURNING *`,
      [user.name, user.email.toLowerCase(), passwordHash, user.role, user.phone, now()],
    );
    logger.log(`[seed] user ${user.email} (${user.role})`);
  }
  return created;
}

async function seedItems(users, logger) {
  const inserted = [];
  for (const entry of ITEMS) {
    const owner = users[entry.owner];
    if (!owner) continue;
    const item = await itemsRepo.insertItem({
      ...entry,
      user_id: owner.user_id,
      status: ITEM_STATUS.REPORTED,
    });
    inserted.push(item);
    logger.log(`[seed] ${entry.type} item #${item.item_id} "${item.title}"`);
  }
  return inserted;
}

export async function seed({ fresh = true, logger = console } = {}) {
  if (fresh) await migrate({ fresh: true, logger });
  else await migrate({ logger });

  const users = await seedUsers(logger);
  const items = await seedItems(users, logger);

  // Run the engine in report order, exactly as it happens in the live app.
  let totalMatches = 0;
  for (const item of items) {
    const fresh = await itemsRepo.findById(item.item_id);
    const result = await runMatchingForItem(fresh);
    totalMatches += result.created;
    if (result.best) {
      logger.log(
        `[seed] match ${result.best.match_score}% -> "${result.best.lost_item?.title}" vs "${result.best.found_item?.title}"`,
      );
    }
  }

  logger.log('');
  logger.log(`[seed] done: ${Object.keys(users).length} users, ${items.length} items, ${totalMatches} matches`);
  logger.log('[seed] login as   admin@campus.edu / admin123   (admin dashboard)');
  logger.log('[seed]            ananya@campus.edu / demo1234  (lost the wallet)');
  logger.log('[seed]            rahul@campus.edu / demo1234   (found the wallet)');

  return { users, items, matches: totalMatches };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  seed({ fresh: !process.argv.includes('--keep') })
    .then(() => db.close())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seed] failed:', error);
      process.exit(1);
    });
}
