/**
 * Claim & Verification Module - spec section 7.
 *
 * Nobody can take an item by simply asking for it: the reporter stores a private
 * detail (`secret_details`) plus an optional question, and a claimant must supply
 * matching proof. The API grades the answer automatically to assist the reviewer,
 * but a human (the finder or an admin) always makes the final decision.
 */
import db from '../../db/index.js';
import { verifyClaimImage } from '../../matching/aiClient.js';
import { textSimilarity } from '../../matching/similarity.js';
import { emitToUser } from '../../realtime/hub.js';
import {
  CLAIM_STATUS,
  ITEM_STATUS,
  ITEM_TERMINAL_STATUS,
  MATCH_STATUS,
  NOTIFICATION_TYPES,
  ROLES,
  now,
} from '../../utils/constants.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import * as itemsRepo from '../items/items.repository.js';
import { notify } from '../notifications/notifications.service.js';

const OPEN_STATUSES = [CLAIM_STATUS.PENDING, CLAIM_STATUS.UNDER_REVIEW];

const CLAIM_SELECT = `
  SELECT c.*,
         u.name  AS claimant_name,
         i.title AS item_title,
         i.type  AS item_type,
         i.status AS item_status,
         i.image_url AS item_image_url,
         i.user_id AS item_owner_id,
         owner.name AS item_owner_name
  FROM claims c
  JOIN users u     ON u.user_id = c.claimant_id
  JOIN items i     ON i.item_id = c.item_id
  JOIN users owner ON owner.user_id = i.user_id
`;

/** The reviewer is the person who filed the item report, or any admin. */
function assertCanReview(claim, viewer) {
  const isOwner = claim.item_owner_id === viewer.user_id;
  const isAdmin = viewer.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) throw forbidden('Only the finder or an administrator can review this claim');
  return { isOwner, isAdmin };
}

function assertCanView(claim, viewer) {
  const allowed =
    claim.claimant_id === viewer.user_id ||
    claim.item_owner_id === viewer.user_id ||
    viewer.role === ROLES.ADMIN;
  if (!allowed) throw forbidden('You are not part of this claim');
}

/** Grades the answer against the stored private detail. 0-100. */
export function gradeAnswer(secretDetails, answer, proof) {
  if (!secretDetails) return null;
  const answerScore = textSimilarity(secretDetails, answer ?? '');
  const proofScore = textSimilarity(secretDetails, proof ?? '');
  return Math.round(Math.max(answerScore, proofScore) * 1000) / 10;
}

/**
 * Single confidence figure for the reviewer, from whichever evidence exists.
 * Text evidence dominates because it is the private detail only the owner knows;
 * the photo comparison corroborates it.
 */
export function combineEvidence(textScore, imageScore) {
  const hasText = textScore != null;
  const hasImage = imageScore != null;
  if (!hasText && !hasImage) return null;
  if (hasText && hasImage) return Math.round((0.65 * textScore + 0.35 * imageScore) * 10) / 10;
  return Math.round((hasText ? textScore : imageScore) * 10) / 10;
}

const IMAGE_VERDICT_LABELS = {
  likely_same_item: 'The photos look like the same item',
  possibly_same_item: 'The photos are somewhat similar',
  likely_different_item: 'The photos look like different items',
  unavailable: 'Photo comparison unavailable',
};

export const imageVerdictLabel = (verdict) => IMAGE_VERDICT_LABELS[verdict] ?? IMAGE_VERDICT_LABELS.unavailable;

/** Question a claimant must answer, without leaking the expected answer. */
export async function verificationPrompt(itemId, viewer) {
  const item = await itemsRepo.findById(itemId);
  if (!item) throw notFound('Item not found');
  if (item.user_id === viewer.user_id) throw badRequest('This is your own report');

  return {
    item_id: item.item_id,
    title: item.title,
    type: item.type,
    question:
      item.verification_question ||
      'Describe a private detail of this item that is not visible in the listing (contents, marks, serial number...).',
    requires_answer: Boolean(item.secret_details),
    already_claimed: Boolean(
      await db.one(
        `SELECT claim_id FROM claims WHERE item_id = ? AND claimant_id = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(', ')})`,
        [itemId, viewer.user_id, ...OPEN_STATUSES],
      ),
    ),
  };
}

export async function submitClaim(viewer, { item_id, proof, answer, proof_image_url, match_id }) {
  const item = await itemsRepo.findById(item_id);
  if (!item) throw notFound('Item not found');
  if (item.user_id === viewer.user_id) throw badRequest('You cannot claim your own report');
  if (ITEM_TERMINAL_STATUS.includes(item.status)) throw badRequest('This case is already closed');

  const existing = await db.one(
    `SELECT claim_id FROM claims WHERE item_id = ? AND claimant_id = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(', ')})`,
    [item_id, viewer.user_id, ...OPEN_STATUSES],
  );
  if (existing) throw conflict('You already have a claim under review for this item');

  const autoScore = gradeAnswer(item.secret_details, answer, proof);

  // AI image verification: does the claimant's proof photo show the same object
  // as the item report? Optional and non-blocking - a failure just omits it.
  let imageScore = null;
  let imageVerdict = null;
  const imageCheck = await verifyClaimImage(item.image_url, proof_image_url).catch(() => null);
  if (imageCheck?.score != null) {
    imageScore = Math.round(imageCheck.score * 1000) / 10;
    imageVerdict = imageCheck.verdict;
  }

  const timestamp = now();

  const claim = await db.insertReturning(
    `INSERT INTO claims
       (item_id, claimant_id, match_id, proof, answer, proof_image_url, status,
        auto_score, image_score, image_verdict, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      item_id,
      viewer.user_id,
      match_id ?? null,
      proof ?? '',
      answer ?? null,
      proof_image_url ?? null,
      CLAIM_STATUS.PENDING,
      autoScore,
      imageScore,
      imageVerdict,
      timestamp,
      timestamp,
    ],
  );

  await itemsRepo.updateItem(item_id, { status: ITEM_STATUS.CLAIM_REQUESTED });

  const evidenceSummary = [
    autoScore != null ? `answer ${autoScore}%` : null,
    imageScore != null ? `photo ${imageScore}%` : null,
  ]
    .filter(Boolean)
    .join(', ');

  await notify({
    userId: item.user_id,
    type: NOTIFICATION_TYPES.CLAIM_SUBMITTED,
    title: 'New ownership claim',
    message: `${viewer.name} submitted a claim for "${item.title}"${
      evidenceSummary ? ` (${evidenceSummary})` : ''
    }. Please review the proof.`,
    link: `/claims/${claim.claim_id}`,
  });
  emitToUser(item.user_id, 'claim:new', { claim_id: claim.claim_id, item_id });

  return getById(claim.claim_id, viewer);
}

export async function getById(claimId, viewer) {
  const claim = await db.one(`${CLAIM_SELECT} WHERE c.claim_id = ?`, [claimId]);
  if (!claim) throw notFound('Claim not found');
  assertCanView(claim, viewer);

  const isReviewer = claim.item_owner_id === viewer.user_id || viewer.role === ROLES.ADMIN;
  const contactUnlocked = [CLAIM_STATUS.APPROVED, CLAIM_STATUS.HANDOVER_CONFIRMED].includes(claim.status);

  let contact = null;
  if (contactUnlocked) {
    const counterpartId = claim.claimant_id === viewer.user_id ? claim.item_owner_id : claim.claimant_id;
    contact = await db.one('SELECT user_id, name, email, phone FROM users WHERE user_id = ?', [counterpartId]);
  }

  const autoScore = claim.auto_score == null ? null : Number(claim.auto_score);
  const imageScore = claim.image_score == null ? null : Number(claim.image_score);

  return {
    ...claim,
    auto_score: autoScore,
    image_score: imageScore,
    image_verdict_label: claim.image_verdict ? imageVerdictLabel(claim.image_verdict) : null,
    /** Combined text + photo confidence shown to the reviewer. */
    confidence: combineEvidence(autoScore, imageScore),
    can_review: isReviewer && OPEN_STATUSES.includes(claim.status),
    can_confirm_handover: isReviewer && claim.status === CLAIM_STATUS.APPROVED,
    contact,
  };
}

/** Claims filed by the caller. */
export async function listMine(userId) {
  return db.all(`${CLAIM_SELECT} WHERE c.claimant_id = ? ORDER BY c.created_at DESC`, [userId]);
}

/** Claims waiting for the caller to review (they filed the item report). */
export async function listIncoming(userId, { openOnly = false } = {}) {
  const statusClause = openOnly ? `AND c.status IN (${OPEN_STATUSES.map(() => '?').join(', ')})` : '';
  return db.all(
    `${CLAIM_SELECT} WHERE i.user_id = ? ${statusClause} ORDER BY c.created_at DESC`,
    openOnly ? [userId, ...OPEN_STATUSES] : [userId],
  );
}

/** Reviewer opens the claim: PENDING -> UNDER_REVIEW (spec step 11). */
export async function startReview(claimId, viewer) {
  const claim = await db.one(`${CLAIM_SELECT} WHERE c.claim_id = ?`, [claimId]);
  if (!claim) throw notFound('Claim not found');
  assertCanReview(claim, viewer);
  if (claim.status !== CLAIM_STATUS.PENDING) return getById(claimId, viewer);

  await db.run('UPDATE claims SET status = ?, reviewer_id = ?, updated_at = ? WHERE claim_id = ?', [
    CLAIM_STATUS.UNDER_REVIEW,
    viewer.user_id,
    now(),
    claimId,
  ]);
  await itemsRepo.updateItem(claim.item_id, { status: ITEM_STATUS.VERIFICATION });

  await notify({
    userId: claim.claimant_id,
    type: NOTIFICATION_TYPES.CLAIM_SUBMITTED,
    title: 'Your claim is being verified',
    message: `${viewer.name} is reviewing your claim for "${claim.item_title}".`,
    link: `/claims/${claimId}`,
  });

  return getById(claimId, viewer);
}

/** Approve or reject a claim. */
export async function decide(claimId, viewer, { approve, note }) {
  const claim = await db.one(`${CLAIM_SELECT} WHERE c.claim_id = ?`, [claimId]);
  if (!claim) throw notFound('Claim not found');
  assertCanReview(claim, viewer);
  if (!OPEN_STATUSES.includes(claim.status)) {
    throw badRequest(`This claim is already ${claim.status.toLowerCase()}`);
  }

  const status = approve ? CLAIM_STATUS.APPROVED : CLAIM_STATUS.REJECTED;
  await db.run(
    'UPDATE claims SET status = ?, review_note = ?, reviewer_id = ?, updated_at = ? WHERE claim_id = ?',
    [status, note ?? null, viewer.user_id, now(), claimId],
  );

  if (approve) {
    await itemsRepo.updateItem(claim.item_id, { status: ITEM_STATUS.VERIFICATION });
    // Any other open claim on the same item loses.
    await db.run(
      `UPDATE claims SET status = ?, review_note = ?, updated_at = ?
       WHERE item_id = ? AND claim_id <> ? AND status IN (${OPEN_STATUSES.map(() => '?').join(', ')})`,
      [
        CLAIM_STATUS.REJECTED,
        'Another claim was approved for this item',
        now(),
        claim.item_id,
        claimId,
        ...OPEN_STATUSES,
      ],
    );
    if (claim.match_id) {
      await db.run('UPDATE matches SET status = ?, updated_at = ? WHERE match_id = ?', [
        MATCH_STATUS.CONFIRMED,
        now(),
        claim.match_id,
      ]);
    }
  } else {
    // Nobody else is claiming it: put the item back in the pool.
    const stillOpen = await db.one(
      `SELECT COUNT(*) AS total FROM claims WHERE item_id = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(', ')})`,
      [claim.item_id, ...OPEN_STATUSES],
    );
    if (Number(stillOpen?.total ?? 0) === 0) {
      await itemsRepo.updateItem(claim.item_id, { status: ITEM_STATUS.POSSIBLE_MATCH });
    }
  }

  await notify({
    userId: claim.claimant_id,
    type: approve ? NOTIFICATION_TYPES.CLAIM_APPROVED : NOTIFICATION_TYPES.CLAIM_REJECTED,
    title: approve ? 'Claim approved' : 'Claim rejected',
    message: approve
      ? `Your claim for "${claim.item_title}" was approved. Contact details are now shared - arrange a safe handover.`
      : `Your claim for "${claim.item_title}" was rejected.${note ? ` Reason: ${note}` : ''}`,
    link: `/claims/${claimId}`,
  });
  emitToUser(claim.claimant_id, 'claim:decided', { claim_id: claimId, status });

  return getById(claimId, viewer);
}

/**
 * Finder/admin confirms the physical handover: the item becomes RETURNED and
 * the matched counterpart report is closed too (spec steps 12-13).
 */
export async function confirmHandover(claimId, viewer) {
  const claim = await db.one(`${CLAIM_SELECT} WHERE c.claim_id = ?`, [claimId]);
  if (!claim) throw notFound('Claim not found');
  assertCanReview(claim, viewer);
  if (claim.status !== CLAIM_STATUS.APPROVED) {
    throw badRequest('The claim must be approved before confirming handover');
  }

  const timestamp = now();
  await db.run('UPDATE claims SET status = ?, updated_at = ? WHERE claim_id = ?', [
    CLAIM_STATUS.HANDOVER_CONFIRMED,
    timestamp,
    claimId,
  ]);
  await itemsRepo.updateItem(claim.item_id, { status: ITEM_STATUS.RETURNED, resolved_at: timestamp });

  // Close the counterpart report from the confirmed match, if there is one.
  const counterpartIds = await db.all(
    `SELECT lost_item_id, found_item_id FROM matches
     WHERE (lost_item_id = ? OR found_item_id = ?) AND status <> ?`,
    [claim.item_id, claim.item_id, MATCH_STATUS.REJECTED],
  );
  const linkedIds = new Set();
  for (const row of counterpartIds) {
    const other = Number(row.lost_item_id) === Number(claim.item_id) ? row.found_item_id : row.lost_item_id;
    linkedIds.add(Number(other));
  }
  for (const otherId of linkedIds) {
    const other = await itemsRepo.findById(otherId);
    // Only auto-close the counterpart report that belongs to the claimant.
    if (other && other.user_id === claim.claimant_id && !ITEM_TERMINAL_STATUS.includes(other.status)) {
      await itemsRepo.updateItem(otherId, { status: ITEM_STATUS.RETURNED, resolved_at: timestamp });
    }
  }

  for (const userId of [claim.claimant_id, claim.item_owner_id]) {
    await notify({
      userId,
      type: NOTIFICATION_TYPES.HANDOVER_CONFIRMED,
      title: 'Item returned',
      message: `"${claim.item_title}" has been handed over. The case is marked RETURNED.`,
      link: `/items/${claim.item_id}`,
    });
    emitToUser(userId, 'item:returned', { item_id: claim.item_id, claim_id: claimId });
  }

  return getById(claimId, viewer);
}

/** Claimant withdraws an open claim. */
export async function withdraw(claimId, viewer) {
  const claim = await db.one(`${CLAIM_SELECT} WHERE c.claim_id = ?`, [claimId]);
  if (!claim) throw notFound('Claim not found');
  if (claim.claimant_id !== viewer.user_id) throw forbidden('Only the claimant can withdraw this claim');
  if (!OPEN_STATUSES.includes(claim.status)) throw badRequest('This claim can no longer be withdrawn');

  await db.run('UPDATE claims SET status = ?, review_note = ?, updated_at = ? WHERE claim_id = ?', [
    CLAIM_STATUS.REJECTED,
    'Withdrawn by claimant',
    now(),
    claimId,
  ]);

  const stillOpen = await db.one(
    `SELECT COUNT(*) AS total FROM claims WHERE item_id = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(', ')})`,
    [claim.item_id, ...OPEN_STATUSES],
  );
  if (Number(stillOpen?.total ?? 0) === 0) {
    await itemsRepo.updateItem(claim.item_id, { status: ITEM_STATUS.POSSIBLE_MATCH });
  }

  await notify({
    userId: claim.item_owner_id,
    type: NOTIFICATION_TYPES.CLAIM_REJECTED,
    title: 'Claim withdrawn',
    message: `${viewer.name} withdrew the claim for "${claim.item_title}".`,
    link: `/items/${claim.item_id}`,
  });

  return { withdrawn: true, claim_id: claimId };
}
