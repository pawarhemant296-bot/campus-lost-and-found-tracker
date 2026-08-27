import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { ErrorBanner, Loading } from '../components/Feedback.jsx';
import { TextArea } from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import { formatDate, humanStatus, statusTone } from '../utils/format.js';

/** Claim review screen: proof, automatic grade, decision and handover. */
export default function ClaimDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/claims/${id}`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error) {
    return (
      <div className="container">
        <ErrorBanner error={error} onRetry={reload} />
      </div>
    );
  }

  const claim = data.claim;
  const isClaimant = claim.claimant_id === user.user_id;
  const isReviewer = claim.item_owner_id === user.user_id || user.role === 'admin';

  const act = async (label, path, body) => {
    setBusy(true);
    try {
      await api.post(`/claims/${id}/${path}`, body);
      toast.success(label);
      setNote('');
      reload();
    } catch (actionError) {
      toast.error(actionError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="row small muted" style={{ marginBottom: 12 }}>
        <Link to="/claims">← All claims</Link>
      </div>

      <div className="page-head">
        <div>
          <h1>Claim #{claim.claim_id}</h1>
          <p>
            For{' '}
            <Link to={`/items/${claim.item_id}`}>
              {claim.item_title} ({claim.item_type})
            </Link>{' '}
            · filed by {claim.claimant_name} on {formatDate(claim.created_at)}
          </p>
        </div>
        <span className={statusTone(claim.status)} style={{ fontSize: '0.85rem' }}>
          {humanStatus(claim.status)}
        </span>
      </div>

      <div className="detail-layout">
        <div className="stack">
          <div className="card">
            <h2>Ownership evidence</h2>

            {claim.answer && (
              <>
                <span className="label">Answer to the verification question</span>
                <div className="proof-box" style={{ marginBottom: 12 }}>
                  {claim.answer}
                </div>
              </>
            )}

            <span className="label">Proof of ownership</span>
            <div className="proof-box">{claim.proof || '—'}</div>

            {claim.proof_image_url && !claim.item_image_url && (
              <div style={{ marginTop: 12 }}>
                <span className="label">Supporting photo</span>
                <img className="item-hero-image" style={{ maxHeight: 260 }} src={claim.proof_image_url} alt="Claim proof" />
              </div>
            )}

            {claim.confidence != null && (
              <div className="row row-between" style={{ marginTop: 14, gap: 10 }}>
                <span className="label" style={{ marginBottom: 0 }}>
                  Combined evidence confidence
                </span>
                <strong style={{ color: claim.confidence >= 60 ? 'var(--found)' : 'var(--warn)' }}>
                  {claim.confidence}%
                </strong>
              </div>
            )}

            {claim.auto_score != null && (
              <div className={`alert ${claim.auto_score >= 60 ? 'alert-success' : 'alert-warn'}`} style={{ marginTop: 14 }}>
                <strong>Automatic proof score: {claim.auto_score}%</strong>
                <div className="small">
                  Similarity between what the claimant wrote and the private detail stored by the finder. This is
                  guidance only — a human decides.
                </div>
              </div>
            )}
          </div>

          {/* AI image verification (spec section 7, advanced) */}
          {(claim.image_score != null || (claim.item_image_url && claim.proof_image_url)) && (
            <div className="card">
              <div className="card-head">
                <h2>🤖 AI image verification</h2>
                {claim.image_score != null && (
                  <span className={`badge ${claim.image_score >= 72 ? 'badge-success' : claim.image_score >= 45 ? 'badge-warn' : 'badge-danger'}`}>
                    {claim.image_score}% similar
                  </span>
                )}
              </div>

              {claim.image_score == null ? (
                <p className="muted small" style={{ margin: 0 }}>
                  Both photos are present but the comparison did not run — the AI service is disabled or was
                  unreachable. Review the written evidence instead.
                </p>
              ) : (
                <>
                  <p className="muted small">
                    {claim.image_verdict_label}. Computed by comparing a perceptual hash and colour profile of the two
                    photos. Advisory only — it never approves a claim by itself.
                  </p>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <figure style={{ margin: 0 }}>
                      <img className="item-hero-image" style={{ maxHeight: 200 }} src={claim.item_image_url} alt="Photo on the item report" />
                      <figcaption className="muted tiny center" style={{ marginTop: 6 }}>
                        Photo on the {claim.item_type} report
                      </figcaption>
                    </figure>
                    <figure style={{ margin: 0 }}>
                      <img className="item-hero-image" style={{ maxHeight: 200 }} src={claim.proof_image_url} alt="Photo uploaded by the claimant" />
                      <figcaption className="muted tiny center" style={{ marginTop: 6 }}>
                        Claimant&apos;s proof photo
                      </figcaption>
                    </figure>
                  </div>
                  <div className={`bar${claim.image_score >= 45 ? '' : ' skipped'}`} style={{ marginTop: 12 }}>
                    <div style={{ width: `${claim.image_score}%` }} />
                  </div>
                </>
              )}
            </div>
          )}

          {claim.review_note && (
            <div className="card">
              <h2>Reviewer note</h2>
              <div className="proof-box">{claim.review_note}</div>
            </div>
          )}

          {claim.contact && (
            <div className="card">
              <h2>🤝 Handover contact</h2>
              <p className="muted small">Shared because the claim was approved. Meet in a public place on campus.</p>
              <dl className="definition-list">
                <dt>Name</dt>
                <dd>{claim.contact.name}</dd>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${claim.contact.email}`}>{claim.contact.email}</a>
                </dd>
                {claim.contact.phone && (
                  <>
                    <dt>Phone</dt>
                    <dd>{claim.contact.phone}</dd>
                  </>
                )}
              </dl>
              <Link className="btn btn-ghost btn-sm" to={`/messages/${claim.item_id}/${claim.contact.user_id}`}>
                💬 Open chat instead
              </Link>
            </div>
          )}
        </div>

        <div className="stack">
          {isReviewer && (
            <div className="card">
              <h3>Review</h3>
              {claim.status === 'PENDING' && (
                <button type="button" className="btn btn-block" disabled={busy} onClick={() => act('Claim marked under review', 'review')}>
                  🔎 Start verification
                </button>
              )}

              {claim.can_review && (
                <>
                  <div className="field" style={{ marginTop: 14 }}>
                    <TextArea
                      id="note"
                      label="Decision note (optional)"
                      rows={3}
                      placeholder="Answer matches the contents exactly."
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>
                  <div className="stack" style={{ gap: 8 }}>
                    <button type="button" className="btn btn-success btn-block" disabled={busy} onClick={() => act('Claim approved', 'approve', { note })}>
                      ✓ Approve claim
                    </button>
                    <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={() => act('Claim rejected', 'reject', { note })}>
                      ✕ Reject claim
                    </button>
                  </div>
                </>
              )}

              {claim.can_confirm_handover && (
                <button
                  type="button"
                  className="btn btn-success btn-block"
                  style={{ marginTop: 10 }}
                  disabled={busy}
                  onClick={() => act('Handover confirmed — item marked RETURNED', 'handover')}
                >
                  🤝 Confirm handover
                </button>
              )}

              {claim.status === 'HANDOVER_CONFIRMED' && (
                <div className="alert alert-success" style={{ margin: 0 }}>
                  Item returned. The case is resolved. 🎉
                </div>
              )}
            </div>
          )}

          {isClaimant && (
            <div className="card">
              <h3>Your claim</h3>
              {['PENDING', 'UNDER_REVIEW'].includes(claim.status) ? (
                <>
                  <p className="muted small">
                    {claim.status === 'PENDING'
                      ? 'Waiting for the finder to open your claim.'
                      : 'The finder is verifying your answer right now.'}
                  </p>
                  <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={() => act('Claim withdrawn', 'withdraw')}>
                    Withdraw claim
                  </button>
                </>
              ) : (
                <p className="muted small" style={{ margin: 0 }}>
                  Status: <strong>{humanStatus(claim.status)}</strong>
                  {claim.status === 'APPROVED' && ' — contact details are unlocked above, arrange a safe handover.'}
                </p>
              )}
            </div>
          )}

          <div className="card">
            <h3>Claim trail</h3>
            <dl className="definition-list">
              <dt>Submitted</dt>
              <dd>{formatDate(claim.created_at)}</dd>
              <dt>Last update</dt>
              <dd>{formatDate(claim.updated_at)}</dd>
              <dt>Item status</dt>
              <dd>
                <span className={statusTone(claim.item_status)}>{humanStatus(claim.item_status)}</span>
              </dd>
              <dt>Reviewer</dt>
              <dd>{claim.reviewer_id ? claim.item_owner_name : 'not assigned yet'}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
