import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import {
  Button,
  Card,
  Empty,
  ItemThumb,
  LoadingBlock,
  PillSelect,
  Select,
  StatusBadge,
  ToggleGroup,
  useToast,
} from '../../components/ui.jsx';
import { AdminAPI } from '../../lib/api.js';
import { STATUS_FLOW, STATUS_LABELS, formatDate } from '../../lib/format.js';

export default function AdminItems() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', type: '', status: '' });

  const load = useCallback(() => {
    setLoading(true);
    AdminAPI.items(filters)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const act = async (fn, message) => {
    try {
      await fn();
      toast.success(message);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Manage items</div>
          <h1>All reports</h1>
          <p>Override a status, hide a suspicious listing or delete spam.</p>
        </div>
      </div>

      <Card className="filter-bar mb-6">
        <div className="search" style={{ maxWidth: 280 }}>
          <span className="input-icon">
            <Icon name="search" size={16} />
          </span>
          <input
            className="input"
            placeholder="Search title, description, place…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
        <ToggleGroup
          value={filters.type}
          onChange={(type) => setFilters({ ...filters, type })}
          options={[
            { value: '', label: 'All' },
            { value: 'lost', label: 'Lost' },
            { value: 'found', label: 'Found' },
          ]}
        />
        <PillSelect
          placeholder="Status"
          value={filters.status}
          onChange={(status) => setFilters({ ...filters, status })}
          options={STATUS_FLOW.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        <span className="ml-auto small muted">{items.length} report(s)</span>
      </Card>

      {loading ? (
        <Card className="card-pad">
          <LoadingBlock rows={5} />
        </Card>
      ) : items.length === 0 ? (
        <Card className="card-pad">
          <Empty icon="box" title="Nothing matches those filters" />
        </Card>
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Reporter</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Matches</th>
                  <th>Claims</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={it.is_flagged ? { opacity: 0.62 } : undefined}>
                    <td>
                      <Link to={`/items/${it.id}`} className="row gap-3" style={{ color: 'inherit' }}>
                        <ItemThumb item={it} />
                        <div style={{ minWidth: 0 }}>
                          <div className="row gap-2">
                            <span className={`badge badge-${it.type} badge-plain`}>{it.type}</span>
                            {it.is_flagged === 1 && <span className="badge badge-claim_requested">hidden</span>}
                          </div>
                          <div className="cell-strong truncate mt-2" style={{ maxWidth: 240 }}>
                            {it.title}
                          </div>
                          <div className="tiny faint truncate" style={{ maxWidth: 240 }}>
                            {it.location}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <div className="tiny">{it.reporter}</div>
                      <div className="tiny faint">{it.reporter_email}</div>
                    </td>
                    <td className="tiny">{it.category}</td>
                    <td className="tiny">{formatDate(it.item_date)}</td>
                    <td className="mono">{it.match_count}</td>
                    <td className="mono">{it.claim_count}</td>
                    <td>
                      <Select
                        className="small"
                        style={{ padding: '7px 30px 7px 10px', fontSize: 'var(--fs-xs)' }}
                        options={STATUS_FLOW.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                        value={it.status}
                        onChange={(e) =>
                          act(() => AdminAPI.updateItem(it.id, { status: e.target.value }), 'Status updated')
                        }
                      />
                    </td>
                    <td>
                      <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                        <Link to={`/items/${it.id}`} className="btn btn-icon btn-subtle btn-sm" title="View">
                          <Icon name="eye" size={14} />
                        </Link>
                        <button
                          className="btn btn-icon btn-subtle btn-sm"
                          title={it.is_flagged ? 'Restore' : 'Hide from public'}
                          onClick={() =>
                            act(
                              () => AdminAPI.updateItem(it.id, { is_flagged: it.is_flagged ? 0 : 1 }),
                              it.is_flagged ? 'Report restored' : 'Report hidden'
                            )
                          }
                        >
                          <Icon name={it.is_flagged ? 'eye' : 'flag'} size={14} />
                        </button>
                        <button
                          className="btn btn-icon btn-subtle btn-sm"
                          title="Delete"
                          onClick={() => {
                            if (window.confirm(`Delete “${it.title}”? This cannot be undone.`))
                              act(() => AdminAPI.removeItem(it.id), 'Report deleted');
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
