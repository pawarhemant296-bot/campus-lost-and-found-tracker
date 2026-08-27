import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ItemCard from '../components/ItemCard.jsx';
import {
  Button,
  Card,
  Empty,
  ItemThumb,
  LoadingBlock,
  PillSelect,
  StatusBadge,
  ToggleGroup,
  useToast,
} from '../components/ui.jsx';
import { ItemsAPI } from '../lib/api.js';
import { STATUS_FLOW, STATUS_LABELS, formatDate, timeAgo } from '../lib/format.js';

export default function MyReports() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('table');

  const load = useCallback(() => {
    setLoading(true);
    ItemsAPI.list({ mine: 1, type, status, limit: 200 })
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [type, status]);

  useEffect(load, [load]);

  const rescan = async (item) => {
    try {
      const res = await ItemsAPI.rescan(item.id);
      toast.success(
        res.match_count
          ? `${res.match_count} match${res.match_count === 1 ? '' : 'es'} found for “${item.title}”`
          : 'No new matches above the threshold yet'
      );
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete the report “${item.title}”? This cannot be undone.`)) return;
    try {
      await ItemsAPI.remove(item.id);
      toast.success('Report deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">My reports</div>
          <h1>Everything you've filed</h1>
          <p>Track each report through the lifecycle, re-scan for matches or close a case.</p>
        </div>
        <div className="row gap-3">
          <Button to="/app/report/found" variant="ghost" icon="box">
            Report Found
          </Button>
          <Button to="/app/report/lost" icon="search">
            Report Lost
          </Button>
        </div>
      </div>

      <Card className="filter-bar mb-6">
        <ToggleGroup
          value={type}
          onChange={setType}
          options={[
            { value: '', label: 'All' },
            { value: 'lost', label: 'Lost', icon: 'search' },
            { value: 'found', label: 'Found', icon: 'box' },
          ]}
        />
        <PillSelect
          placeholder="Status"
          value={status}
          onChange={setStatus}
          options={STATUS_FLOW.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        <div className="ml-auto row gap-2">
          <button
            className={`btn btn-icon ${view === 'table' ? 'btn-ghost' : 'btn-subtle'}`}
            onClick={() => setView('table')}
            aria-label="Table view"
          >
            <Icon name="list" size={16} />
          </button>
          <button
            className={`btn btn-icon ${view === 'grid' ? 'btn-ghost' : 'btn-subtle'}`}
            onClick={() => setView('grid')}
            aria-label="Grid view"
          >
            <Icon name="grid" size={16} />
          </button>
        </div>
      </Card>

      {loading ? (
        <Card className="card-pad">
          <LoadingBlock rows={5} />
        </Card>
      ) : items.length === 0 ? (
        <Card className="card-pad">
          <Empty
            icon="box"
            title="No reports match this filter"
            message="File a lost or found report and it will show up here with its live status."
            action={
              <Button to="/app/report/lost" iconRight="arrowRight">
                Report an item
              </Button>
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-auto">
          {items.map((it) => (
            <ItemCard key={it.id} item={it} />
          ))}
        </div>
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <Link to={`/items/${it.id}`} className="row gap-3" style={{ color: 'inherit' }}>
                        <ItemThumb item={it} />
                        <span className="cell-strong truncate" style={{ maxWidth: 240 }}>
                          {it.title}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`badge badge-${it.type} badge-plain`}>{it.type}</span>
                    </td>
                    <td className="tiny">{it.category}</td>
                    <td className="tiny">{it.location || '—'}</td>
                    <td className="tiny">{formatDate(it.item_date)}</td>
                    <td>
                      <StatusBadge status={it.status} />
                    </td>
                    <td className="tiny faint">{timeAgo(it.updated_at)}</td>
                    <td>
                      <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                        <Link
                          to={`/items/${it.id}`}
                          className="btn btn-icon btn-subtle btn-sm"
                          title="View"
                        >
                          <Icon name="eye" size={14} />
                        </Link>
                        <button
                          className="btn btn-icon btn-subtle btn-sm"
                          title="Re-scan for matches"
                          onClick={() => rescan(it)}
                        >
                          <Icon name="refresh" size={14} />
                        </button>
                        <button
                          className="btn btn-icon btn-subtle btn-sm"
                          title="Delete report"
                          onClick={() => remove(it)}
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
