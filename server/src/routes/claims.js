import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { scoreAnswers } from '../matching.js';
import {
  ITEM_SELECT,
  advanceStatus,
  maskName,
  notify,
  setStatus,
} from '../services.js';

const router = Router();

const CLAIM_SELECT = `
  SELECT c.*, 
         i.title AS item_title, i.type AS item_type, i.category AS item_category,
         i.image_url AS item_image, i.location AS item_location, i.status AS item_status,
         i.user_id AS reporter_id,
         cu.name AS claimant_name, cu.email AS claimant_email, cu.avatar_hue AS claimant_hue,
         ru.name AS reporter_name
    FROM claims c
    JOIN items i ON i.id = c.item_id
    JOIN users cu ON cu.id = c.claimant_id
    JOIN users ru ON ru.id = i.user_id`;

function shapeClaim(row, viewer) {
  if (!row) return null;
  const isAdmin = viewer?.role === 'admin';
  const isClaimant = viewer?.id === row.claimant_id;
  const isReporter = viewer?.id === row.reporter_id;
  let proof = {};
  try {
    proof = JSON.parse(row.proof || '{}');
  } catch {
    proof = {};
  }
  // The reporter/admin reviewing the claim needs to read the answers; everyone
  // else only sees that answers exist.
  const canSeeProof = isAdmin || isReporter || isClaimant;
  return {
    ...row,
    proof: canSeeProof ? proof : { answered: (proof.answers || []).length },
    claimant_name: isAdmin || isReporter ? row.claimant_name : maskName(row.claimant_name),
    claimant_email: isAdmin || isReporter ? row.claimant_email : undefined,
    // Identities are revealed to the claimant only once ownership is approved.
    reporter_name:
      isAdmin || isReporter || (isClaimant && row.status === 'approved')
        ? row.reporter_name
        : maskName(row.reporter_name),
    role: isAdmin ? 'admin' : isClaimant ? 'claimant' : isReporter ? 'reporter' : 'observer',
    can_decide: Boolean(isAdmin || isReporter),
  };
}

/* ------------------------------------------------------------------- create */

router.post('/', requireAuth, (req, res) => {
  const { item_id, match_id = null, note = '' } = req.body || {};
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.user_id === req.user.id)
    return res.status(400).json({ error: 'You cannot claim an item you reported' });
  if (['returned', 'closed'].includes(item.status))
    return res.status(400).json({ error: 'This case is already closed' });

  const existing = db
    .prepare('SELECT * FROM claims WHERE item_id = ? AND claimant_id = ?')
    .get(item.id, req.user.id);
  if (existing)
    return res.status(409).json({ error: 'You already have an open claim on this item', claim: existing });

  const info = db
    .prepare(
      `INSERT INTO claims (item_id, match_id, claimant_id, proof, stage, status)
       VALUES (?,?,?,?,'submitted','open')`
    )
    .run(item.id, match_id || null, req.user.id, JSON.stringify({ note: String(note).slice(0, 800) }));

  advanceStatus(item.id, 'claim_requested');
  if (match_id) db.prepare("UPDATE matches SET status = 'claimed' WHERE id = ?").run(match_id);

  notify(item.user_id, {
    type: 'claim',
    title: 'New claim on your report',
    message: `${maskName(req.user.name)} submitted a claim for "${item.title}". Review the verification answers.`,
    link: `/app/claims/${info.lastInsertRowid}`,
  });
  for (const admin of db.prepare("SELECT id FROM users WHERE role = 'admin'").all()) {
    notify(admin.id, {
      type: 'claim',
      title: 'Claim awaiting moderation',
      message: `Claim #${info.lastInsertRowid} opened on "${item.title}".`,
      link: `/admin/claims`,
    });
  }

  const claim = db.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ claim: shapeClaim(claim, req.user) });
});

/* --------------------------------------------------------------------- read */

router.get('/', requireAuth, (req, res) => {
  const rows =
    req.user.role === 'admin' && req.query.scope === 'all'
      ? db.prepare(`${CLAIM_SELECT} ORDER BY c.created_at DESC`).all()
      : db
          .prepare(
            `${CLAIM_SELECT} WHERE c.claimant_id = ? OR i.user_id = ? ORDER BY c.created_at DESC`
          )
          .all(req.user.id, req.user.id);
  res.json({ claims: rows.map((r) => shapeClaim(r, req.user)) });
});

router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Claim not found' });
  if (
    req.user.role !== 'admin' &&
    req.user.id !== row.claimant_id &&
    req.user.id !== row.reporter_id
  )
    return res.status(403).json({ error: 'You do not have access to this claim' });

  const questions = JSON.parse(
    db.prepare('SELECT questions FROM items WHERE id = ?').get(row.item_id).questions || '[]'
  );
  const item = db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(row.item_id);
  const disputes = db
    .prepare('SELECT d.*, u.name AS raised_by_name FROM disputes d JOIN users u ON u.id = d.raised_by WHERE claim_id = ?')
    .all(row.id);

  res.json({
    claim: shapeClaim(row, req.user),
    questions: questions.map((q) => q.q),
    item: { ...item, image_hash: undefined },
    disputes,
  });
});

/* ------------------------------------------------------- verification answers */

router.post('/:id/verify', requireAuth, (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.claimant_id !== req.user.id)
    return res.status(403).json({ error: 'Only the claimant can answer verification questions' });
  if (['approved', 'rejected', 'closed'].includes(claim.status))
    return res.status(400).json({ error: 'This claim is already decided' });

  const { answers = [], note = '', evidence_url = null } = req.body || {};
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(claim.item_id);
  const questions = JSON.parse(item.questions || '[]');
  const scored = scoreAnswers(questions, answers);

  const proof = {
    note: String(note).slice(0, 800),
    evidence_url,
    answers: questions.map((q, i) => ({ q: q.q, a: String(answers[i] ?? '') })),
    scored_detail: scored?.detail ?? null,
    submitted_at: new Date().toISOString(),
  };

  db.prepare(
    `UPDATE claims SET proof = ?, answer_score = ?, stage = 'review', updated_at = datetime('now')
      WHERE id = ?`
  ).run(JSON.stringify(proof), scored?.score ?? null, claim.id);
  advanceStatus(item.id, 'verification');

  notify(item.user_id, {
    type: 'claim',
    title: 'Verification answers submitted',
    message: `Claim #${claim.id} on "${item.title}" is ready for your review${
      scored ? ` (auto-score ${Math.round(scored.score)}%)` : ''
    }.`,
    link: `/app/claims/${claim.id}`,
  });

  res.json({
    claim: shapeClaim(db.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).get(claim.id), req.user),
    auto_score: scored?.score ?? null,
  });
});

/* ----------------------------------------------------------------- decisions */

router.post('/:id/decision', requireAuth, (req, res) => {
  const row = db.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Claim not found' });
  if (req.user.role !== 'admin' && req.user.id !== row.reporter_id)
    return res.status(403).json({ error: 'Only the reporter or an admin can decide this claim' });

  const { decision, note = '' } = req.body || {};
  if (!['approve', 'reject'].includes(decision))
    return res.status(400).json({ error: 'Decision must be "approve" or "reject"' });

  if (decision === 'approve') {
    db.prepare(
      `UPDATE claims SET stage = 'handover', status = 'approved', decided_by = ?, decision_note = ?,
        updated_at = datetime('now') WHERE id = ?`
    ).run(req.user.id, note, row.id);
    notify(row.claimant_id, {
      type: 'claim',
      title: 'Ownership verified 🎉',
      message: `Your claim for "${row.item_title}" was approved. Arrange a safe handover through Messages.`,
      link: `/app/claims/${row.id}`,
    });
  } else {
    db.prepare(
      `UPDATE claims SET stage = 'rejected', status = 'rejected', decided_by = ?, decision_note = ?,
        updated_at = datetime('now') WHERE id = ?`
    ).run(req.user.id, note, row.id);
    // No other open claims → the item goes back to being an open possible match.
    const others = db
      .prepare("SELECT COUNT(*) AS c FROM claims WHERE item_id = ? AND status = 'open'")
      .get(row.item_id).c;
    if (!others) setStatus(row.item_id, 'possible_match');
    notify(row.claimant_id, {
      type: 'claim',
      title: 'Claim not approved',
      message: note || 'The verification answers did not match the details on record.',
      link: `/app/claims/${row.id}`,
    });
  }

  res.json({
    claim: shapeClaim(db.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).get(row.id), req.user),
  });
});

/** Handover confirmed → item RETURNED (and its matched counterpart too). */
router.post('/:id/handover', requireAuth, (req, res) => {
  const row = db.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Claim not found' });
  if (req.user.role !== 'admin' && ![row.reporter_id, row.claimant_id].includes(req.user.id))
    return res.status(403).json({ error: 'Not your claim' });
  if (row.status !== 'approved')
    return res.status(400).json({ error: 'The claim must be approved before handover' });

  db.prepare(
    `UPDATE claims SET stage = 'returned', status = 'closed', updated_at = datetime('now') WHERE id = ?`
  ).run(row.id);
  setStatus(row.item_id, 'returned');

  if (row.match_id) {
    db.prepare("UPDATE matches SET status = 'confirmed' WHERE id = ?").run(row.match_id);
    const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(row.match_id);
    const counterpart = m.lost_item_id === row.item_id ? m.found_item_id : m.lost_item_id;
    setStatus(counterpart, 'returned');
  }

  for (const uid of new Set([row.reporter_id, row.claimant_id])) {
    notify(uid, {
      type: 'claim',
      title: 'Item returned ✅',
      message: `"${row.item_title}" has been handed over. The case is marked RETURNED.`,
      link: `/app/claims/${row.id}`,
    });
  }
  res.json({ ok: true, claim: shapeClaim(db.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).get(row.id), req.user) });
});

/** Final lifecycle step — close the case. */
router.post('/:id/close', requireAuth, (req, res) => {
  const row = db.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Claim not found' });
  if (req.user.role !== 'admin' && ![row.reporter_id, row.claimant_id].includes(req.user.id))
    return res.status(403).json({ error: 'Not your claim' });

  setStatus(row.item_id, 'closed');
  if (row.match_id) {
    const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(row.match_id);
    if (m) {
      const counterpart = m.lost_item_id === row.item_id ? m.found_item_id : m.lost_item_id;
      setStatus(counterpart, 'closed');
    }
  }
  db.prepare("UPDATE claims SET status = 'closed', updated_at = datetime('now') WHERE id = ?").run(row.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ disputes */

router.post('/:id/dispute', requireAuth, (req, res) => {
  const row = db.prepare(`${CLAIM_SELECT} WHERE c.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Claim not found' });
  if (![row.reporter_id, row.claimant_id].includes(req.user.id))
    return res.status(403).json({ error: 'Only the parties involved can raise a dispute' });

  const { reason = '' } = req.body || {};
  if (String(reason).trim().length < 10)
    return res.status(400).json({ error: 'Please describe the issue in at least 10 characters' });

  const info = db
    .prepare('INSERT INTO disputes (claim_id, raised_by, reason) VALUES (?,?,?)')
    .run(row.id, req.user.id, String(reason).trim());

  for (const admin of db.prepare("SELECT id FROM users WHERE role = 'admin'").all()) {
    notify(admin.id, {
      type: 'system',
      title: 'Dispute raised',
      message: `Dispute on claim #${row.id} ("${row.item_title}") needs review.`,
      link: '/admin/disputes',
    });
  }
  res.status(201).json({ dispute_id: Number(info.lastInsertRowid) });
});

export default router;
