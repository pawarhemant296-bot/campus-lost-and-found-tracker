import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import {
  Alert,
  Button,
  Card,
  Empty,
  LoadingBlock,
  Textarea,
  useToast,
} from '../../components/ui.jsx';
import { AdminAPI } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

export default function AdminDisputes() {
  const toast = useToast();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    AdminAPI.disputes()
      .then((d) => setDisputes(d.disputes || []))
      .catch(() => setDisputes([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const resolve = async (d, status) => {
    try {
      await AdminAPI.updateDispute(d.id, { status, resolution: notes[d.id] || '' });
      toast.success(`Dispute ${status}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const open = disputes.filter((d) => d.status === 'open');

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Disputes</div>
          <h1>Contested claims</h1>
          <p>When a claimant disagrees with a rejection, the case lands here for a human decision.</p>
        </div>
        <span className="badge badge-claim_requested">{open.length} open</span>
      </div>

      {loading ? (
        <Card className="card-pad">
          <LoadingBlock rows={4} />
        </Card>
      ) : disputes.length === 0 ? (
        <Card className="card-pad">
          <Empty
            icon="scale"
            title="No disputes"
            message="Every claim decision has been accepted by both parties."
          />
        </Card>
      ) : (
        <div className="col gap-4">
          {disputes.map((d) => (
            <Card key={d.id} glow={d.status === 'open'} className="card-pad col gap-4">
              <div className="row-between row-wrap">
                <div className="row gap-3">
                  <span className="stat-icon">
                    <Icon name="scale" size={19} />
                  </span>
                  <div>
                    <div className="row gap-2 row-wrap">
                      <span className="strong">Dispute #{d.id}</span>
                      <span className={`badge badge-${d.status === 'open' ? 'claim_requested' : d.status === 'resolved' ? 'returned' : 'closed'}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="tiny muted">
                      raised by {d.raised_by_name} · {formatDateTime(d.created_at)}
                    </div>
                  </div>
                </div>
                <div className="row gap-2">
                  <Link to={`/items/${d.item_id}`} className="btn btn-subtle btn-sm">
                    <Icon name="box" size={14} /> Item
                  </Link>
                  <Link to={`/app/claims/${d.claim_id}`} className="btn btn-ghost btn-sm">
                    <Icon name="shield" size={14} /> Claim #{d.claim_id}
                  </Link>
                </div>
              </div>

              <div>
                <div className="eyebrow mb-2">Item</div>
                <div className="small strong">{d.item_title}</div>
                <div className="tiny faint">
                  claim stage: {d.claim_stage} · claim status: {d.claim_status}
                </div>
              </div>

              <div>
                <div className="eyebrow mb-2">Reason given</div>
                <p className="small">{d.reason}</p>
              </div>

              {d.resolution && (
                <Alert tone={d.status === 'resolved' ? 'success' : 'info'}>
                  <strong>Resolution:</strong> {d.resolution}
                </Alert>
              )}

              {d.status === 'open' && (
                <>
                  <Textarea
                    rows={2}
                    placeholder="Resolution note shared with the person who raised the dispute…"
                    value={notes[d.id] || ''}
                    onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
                  />
                  <div className="row gap-3">
                    <Button variant="success" icon="check" onClick={() => resolve(d, 'resolved')}>
                      Resolve in favour of claimant
                    </Button>
                    <Button variant="subtle" icon="x" onClick={() => resolve(d, 'dismissed')}>
                      Dismiss dispute
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
