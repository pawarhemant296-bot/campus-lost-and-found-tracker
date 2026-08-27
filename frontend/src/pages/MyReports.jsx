import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBanner, Loading } from '../components/Feedback.jsx';
import ItemCard from '../components/ItemCard.jsx';
import { SelectField } from '../components/ui/Field.jsx';
import useApi from '../hooks/useApi.js';

const TABS = [
  { label: 'All', value: '' },
  { label: 'Lost', value: 'lost' },
  { label: 'Found', value: 'found' },
];

/** My Reports - track everything this user submitted (spec section 12). */
export default function MyReports() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ limit: '48', sort: 'recent' });
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    return `/items/mine?${params.toString()}`;
  }, [type, status]);

  const { data, error, loading, reload } = useApi(endpoint, [endpoint]);
  const { data: meta } = useApi('/items/categories');

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>My reports</h1>
          <p>Track the status of every item you reported.</p>
        </div>
        <div className="row">
          <Link className="btn btn-danger btn-sm" to="/report/lost">
            Report lost
          </Link>
          <Link className="btn btn-success btn-sm" to="/report/found">
            Report found
          </Link>
        </div>
      </div>

      <div className="row row-between" style={{ marginBottom: 14 }}>
        <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
          {TABS.map((tab) => (
            <button key={tab.value} type="button" className={`tab${type === tab.value ? ' active' : ''}`} onClick={() => setType(tab.value)}>
              {tab.label}
            </button>
          ))}
        </div>
        <SelectField
          id="status-filter"
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          sx={{ maxWidth: 240 }}
          placeholder="Any status"
          options={(meta?.statuses ?? []).map((entry) => ({ value: entry, label: entry.replace(/_/g, ' ') }))}
        />
      </div>

      <ErrorBanner error={error} onRetry={reload} />

      {loading ? (
        <Loading />
      ) : data?.items.length === 0 ? (
        <Empty icon="📝" title="Nothing to show">
          You have no reports matching this filter.
        </Empty>
      ) : (
        <div className="grid grid-3">
          {(data?.items ?? []).map((item) => (
            <ItemCard
              key={item.item_id}
              item={item}
              footer={
                <div className="row" style={{ gap: 6 }}>
                  <Link className="btn btn-sm btn-ghost" style={{ flex: 1 }} to={`/items/${item.item_id}`}>
                    Open
                  </Link>
                  <Link className="btn btn-sm btn-ghost" to={`/items/${item.item_id}/edit`}>
                    Edit
                  </Link>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
