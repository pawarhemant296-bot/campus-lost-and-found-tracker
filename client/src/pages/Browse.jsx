import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ItemCard from '../components/ItemCard.jsx';
import {
  Button,
  Card,
  Empty,
  PillSelect,
  SectionTitle,
  Skeleton,
  ToggleGroup,
} from '../components/ui.jsx';
import { ItemsAPI } from '../lib/api.js';
import { STATUS_LABELS, STATUS_FLOW } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

const SORTS = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
];

export default function Browse() {
  const { meta } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const filters = useMemo(
    () => ({
      q: params.get('q') || '',
      type: params.get('type') || '',
      category: params.get('category') || '',
      location: params.get('location') || '',
      status: params.get('status') || '',
      from: params.get('from') || '',
      to: params.get('to') || '',
      sort: params.get('sort') || 'recent',
    }),
    [params]
  );

  const setFilter = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    ItemsAPI.list({ ...filters, limit: 120 })
      .then((data) => {
        if (!alive) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [filters]);

  const activeCount = Object.entries(filters).filter(
    ([k, v]) => v && !['sort'].includes(k)
  ).length;

  return (
    <div className="container section-tight">
      <SectionTitle
        eyebrow="Search & browse"
        title="Every reported item, in one place"
        subtitle="Filter by category, location, date range or status. Found something? File a report and let the engine do the matching."
        action={
          <div className="row gap-2">
            <Button to="/app/report/found" variant="ghost" size="sm" icon="box">
              Report found
            </Button>
            <Button to="/app/report/lost" size="sm" icon="search">
              Report lost
            </Button>
          </div>
        }
      />

      {/* ------------------------------------------------------ filter bar */}
      <Card className="filter-bar">
        <div className="search" style={{ maxWidth: 320 }}>
          <span className="input-icon">
            <Icon name="search" size={16} />
          </span>
          <input
            className="input"
            placeholder="Search title, description, place…"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
          />
        </div>

        <ToggleGroup
          value={filters.type}
          onChange={(v) => setFilter('type', v)}
          options={[
            { value: '', label: 'All' },
            { value: 'lost', label: 'Lost', icon: 'search' },
            { value: 'found', label: 'Found', icon: 'box' },
          ]}
        />

        <PillSelect
          placeholder="Category"
          value={filters.category}
          onChange={(v) => setFilter('category', v)}
          options={meta?.categories || []}
        />
        <PillSelect
          placeholder="Location"
          value={filters.location}
          onChange={(v) => setFilter('location', v)}
          options={meta?.locations || []}
        />
        <PillSelect
          placeholder="Status"
          value={filters.status}
          onChange={(v) => setFilter('status', v)}
          options={STATUS_FLOW.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />

        <label className="row gap-2 tiny muted">
          From
          <input
            type="date"
            className="pill-input"
            value={filters.from}
            onChange={(e) => setFilter('from', e.target.value)}
          />
        </label>
        <label className="row gap-2 tiny muted">
          To
          <input
            type="date"
            className="pill-input"
            value={filters.to}
            onChange={(e) => setFilter('to', e.target.value)}
          />
        </label>

        <PillSelect
          placeholder="Sort"
          value={filters.sort === 'recent' ? '' : filters.sort}
          onChange={(v) => setFilter('sort', v || 'recent')}
          options={SORTS}
        />

        {activeCount > 0 && (
          <Button variant="subtle" size="sm" icon="x" onClick={() => setParams({}, { replace: true })}>
            Clear ({activeCount})
          </Button>
        )}
      </Card>

      <div className="row-between mt-6 mb-4">
        <span className="small muted">
          {loading ? 'Scanning…' : `${items.length} of ${total} report${total === 1 ? '' : 's'}`}
        </span>
        <span className="tiny faint row gap-2">
          <Icon name="shield" size={13} /> Reporter identities are masked for privacy
        </span>
      </div>

      {/* ---------------------------------------------------------- results */}
      {loading ? (
        <div className="grid grid-auto">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="item-card">
              <Skeleton h={190} style={{ borderRadius: 0 }} />
              <div className="item-body col gap-2">
                <Skeleton h={16} w="80%" />
                <Skeleton h={12} w="60%" />
                <Skeleton h={12} w="40%" />
              </div>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="card-pad">
          <Empty
            icon="search"
            title="No items found"
            message="Nothing matches those filters yet. Try widening the date range or clearing the category — or file a report so the engine can watch for it."
            action={
              <div className="row gap-3 row-wrap center">
                <Button variant="ghost" icon="refresh" onClick={() => setParams({}, { replace: true })}>
                  Reset filters
                </Button>
                <Button to="/app/report/lost" iconRight="arrowRight">
                  Report an item
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-auto">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
