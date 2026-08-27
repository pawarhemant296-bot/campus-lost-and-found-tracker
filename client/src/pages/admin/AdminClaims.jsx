import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import {
  Button,
  Card,
  Empty,
  ItemThumb,
  LoadingBlock,
  MatchRing,
  Modal,
  PillSelect,
  Textarea,
  useToast,
} from '../../components/ui.jsx';
import { AdminAPI, ClaimsAPI } from '../../lib/api.js';
import { CLAIM_STEPS, timeAgo } from '../../lib/format.js';

const STAGE_TONE = {
  submitted: 'claim_requested',
  verification: 'verification',
  review: 'verification',
  handover: 'possible_match',
  returned: 'returned',
  rejected: 'closed',
};

export default function AdminClaims() {
  const toast = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', stage: '' });
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    AdminAPI.claims(filters)
      .then((d) => setClaims(d.claims || []))
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(load, [load]);

  const openDetail = async (c) => {
    try {
      const d = await ClaimsAPI.get(c.id);
      setDetail(d);
      setNote('');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const decide = async (decision) => {
    setBusy(true);
    try {
      await ClaimsAPI.decide(detail.claim.id, { decision, note });
      toast.success(decision === 'approve' ? 'Claim approved' : 'Claim rejected');
      setDetail(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Manage claims</div>
          <h1>Ownership review queue</h1>
          <p>Inspect verification answers, override a finder's decision or force a handover.</p>
        </div>
      </div>

      <Card className="filter-bar mb-6">
        <PillSelect
          placeholder="Any status"
          value={filters.status}
          onChange={(status) => setFilters({ ...filters, status })}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        <PillSelect
          placeholder="Any stage"
          value={filters.stage}
          onChange={(stage) => setFilters({ ...filters, stage })}
          options={CLAIM_STEPS.map((s) => ({ value: s.key, label: s.label }))}
        />
        <span className="ml-auto small muted">{claims.length} claim(s)</span>
      </Card>

      {loading ? (
        <Card className="card-pad">
          <LoadingBlock rows={5} />
        </Card>
      ) : claims.length === 0 ? (
        <Card className="card-pad">
          <Empty icon="shield" title="No claims match those filters" />
        </Card>
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Claimant</th>
                  <th>Reporter</th>
                  <th>Auto-score</th>
                  <th>Stage</th>
                  <th>Updated</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td className="mono faint">{c.id}</td>
                    <td>
                      <Link to={`/items/${c.item_id}`} className="row gap-3" style={{ color: 'inherit' }}>
                        <ItemThumb item={{ image_url: c.item_image, title: c.item_title }} />
                        <span className="cell-strong truncate" style={{ maxWidth: 210 }}>
                          {c.item_title}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <div className="tiny">{c.claimant}</div>
                      <div className="tiny faint">{c.claimant_email}</div>
                    </td>
                    <td className="tiny">{c.reporter}</td>
                    <td>
                      {c.answer_score == null ? (
                        <span className="tiny faint">—</span>
                      ) : (
                        <span
                          className="mono strong"
                          style={{
                            color:
                              c.answer_score >= 75
                                ? 'var(--green)'
                                : c.answer_score >= 45
                                  ? 'var(--amber)'
                                  : 'var(--red)',
                          }}
                        >
                          {Math.round(c.answer_score)}%
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="row gap-2">
                        <span className={`badge badge-${STAGE_TONE[c.stage] || 'reported'}`}>{c.stage}</span>
                        {c.open_disputes > 0 && (
                          <span className="badge badge-claim_requested">disputed</span>
                        )}
                      </div>
                    </td>
                    <td className="tiny faint">{timeAgo(c.updated_at)}</td>
                    <td>
                      <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="ghost" onClick={() => openDetail(c)}>
                          Review
                        </Button>
                        <Link to={`/app/claims/${c.id}`} className="btn btn-icon btn-subtle btn-sm" title="Open case">
                          <Icon name="arrowRight" size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {detail && (
        <Modal
          wide
          title={`Claim #${detail.claim.id} · ${detail.claim.item_title}`}
          onClose={() => setDetail(null)}
          footer={
            <div className="row gap-3 ml-auto row-wrap">
              <Button variant="subtle" onClick={() => setDetail(null)}>
                Close
              </Button>
              {detail.claim.status === 'open' && (
                <>
                  <Button variant="danger" icon="x" loading={busy} onClick={() => decide('reject')}>
                    Reject
                  </Button>
                  <Button variant="success" icon="check" loading={busy} onClick={() => decide('approve')}>
                    Approve
                  </Button>
                </>
              )}
            </div>
          }
        >
          <div className="col gap-5">
            <div className="row gap-6 row-wrap">
              <MatchRing score={detail.claim.answer_score ?? 0} size={116} caption="Auto-score" />
              <div className="grow col gap-3" style={{ minWidth: 240 }}>
                {(detail.claim.proof?.answers || []).length === 0 && (
                  <p className="small muted">The claimant hasn't submitted answers yet.</p>
                )}
                {(detail.claim.proof?.answers || []).map((a, i) => {
                  const s = detail.claim.proof?.scored_detail?.[i];
                  return (
                    <div key={i} className="col gap-2">
                      <div className="tiny faint">{a.q}</div>
                      <div className="small soft">“{a.a || '— no answer —'}”</div>
                      {s && (
                        <div className="factor-bar">
                          <span style={{ width: `${s.similarity}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {detail.claim.proof?.note && (
              <div>
                <div className="eyebrow mb-2">Claimant's note</div>
                <p className="small">{detail.claim.proof.note}</p>
              </div>
            )}

            {detail.disputes?.length > 0 && (
              <div>
                <div className="eyebrow mb-2">Disputes</div>
                {detail.disputes.map((d) => (
                  <p className="small" key={d.id}>
                    <strong>{d.raised_by_name}</strong> ({d.status}): {d.reason}
                  </p>
                ))}
              </div>
            )}

            <Textarea
              rows={2}
              placeholder="Moderation note (shared with the claimant)…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
