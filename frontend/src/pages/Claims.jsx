import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBanner, Loading } from '../components/Feedback.jsx';
import useApi from '../hooks/useApi.js';
import { formatDate, humanStatus, relativeTime, statusTone } from '../utils/format.js';

/** Two queues: claims I filed, and claims waiting for my review. */
export default function Claims() {
  const [tab, setTab] = useState('incoming');
  const incoming = useApi('/claims/incoming');
  const mine = useApi('/claims/mine');

  const active = tab === 'incoming' ? incoming : mine;
  const claims = (tab === 'incoming' ? incoming.data?.claims : mine.data?.claims) ?? [];
  const openIncoming = (incoming.data?.claims ?? []).filter((claim) => ['PENDING', 'UNDER_REVIEW'].includes(claim.status)).length;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Claims &amp; verification</h1>
          <p>Ownership must be proven before an item changes hands.</p>
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={`tab${tab === 'incoming' ? ' active' : ''}`} onClick={() => setTab('incoming')}>
          To review {openIncoming > 0 && <span className="badge badge-warn">{openIncoming}</span>}
        </button>
        <button type="button" className={`tab${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
          My claims
        </button>
      </div>

      <ErrorBanner error={active.error} onRetry={active.reload} />

      {active.loading ? (
        <Loading />
      ) : claims.length === 0 ? (
        <Empty icon="🔐" title={tab === 'incoming' ? 'No claims to review' : 'You have not claimed anything yet'}>
          {tab === 'incoming' ? (
            <>When somebody claims an item you found, it appears here for verification.</>
          ) : (
            <>
              Found your item in the listings? Open it and press <strong>Claim this item</strong>.
            </>
          )}
        </Empty>
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th>{tab === 'incoming' ? 'Claimant' : 'Reported by'}</th>
                <th>Proof score</th>
                <th>Status</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.claim_id}>
                  <td>
                    <Link to={`/items/${claim.item_id}`}>{claim.item_title}</Link>
                    <div className="muted tiny">{claim.item_type} report</div>
                  </td>
                  <td>{tab === 'incoming' ? claim.claimant_name : claim.item_owner_name}</td>
                  <td>
                    {claim.auto_score == null ? (
                      <span className="muted">—</span>
                    ) : (
                      <strong style={{ color: claim.auto_score >= 60 ? 'var(--found)' : 'var(--warn)' }}>{claim.auto_score}%</strong>
                    )}
                  </td>
                  <td>
                    <span className={statusTone(claim.status)}>{humanStatus(claim.status)}</span>
                  </td>
                  <td title={formatDate(claim.created_at)}>{relativeTime(claim.created_at)}</td>
                  <td>
                    <Link className="btn btn-sm btn-ghost" to={`/claims/${claim.claim_id}`}>
                      {tab === 'incoming' && ['PENDING', 'UNDER_REVIEW'].includes(claim.status) ? 'Review' : 'Open'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
