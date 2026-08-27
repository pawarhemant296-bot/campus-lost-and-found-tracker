import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Empty, ErrorBanner, Loading } from '../components/Feedback.jsx';
import ItemCard from '../components/ItemCard.jsx';
import { Field, SelectField } from '../components/ui/Field.jsx';
import useApi from '../hooks/useApi.js';

const BLANK = { q: '', type: '', category: '', location: '', date_from: '', date_to: '', sort: 'recent' };

/** Search & Filter - category, location, date and keyword (spec section 12). */
export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: meta } = useApi('/items/categories');

  const [filters, setFilters] = useState(() => ({
    ...BLANK,
    ...Object.fromEntries([...searchParams.entries()]),
  }));
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  // Keep the URL shareable.
  useEffect(() => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) next.set(key, value);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [filters, page, setSearchParams]);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    params.set('page', String(page));
    params.set('limit', '12');
    return `/items?${params.toString()}`;
  }, [filters, page]);

  const { data, error, loading, reload } = useApi(endpoint);

  const update = (key) => (event) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const activeFilters = Object.entries(filters).filter(([key, value]) => value && key !== 'sort').length;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Search items</h1>
          <p>Filter by keyword, category, place and date. Anyone can browse — no account needed.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="form-grid">
          <div className="field">
            <Field id="q" label="Keyword" type="search" placeholder="wallet, redmi, id card…" value={filters.q} onChange={update('q')} />
          </div>
          <div className="field">
            <SelectField
              id="type"
              label="Report type"
              value={filters.type}
              onChange={update('type')}
              options={[
                { value: '', label: 'Lost and found' },
                { value: 'lost', label: 'Lost items only' },
                { value: 'found', label: 'Found items only' },
              ]}
            />
          </div>
          <div className="field">
            <SelectField
              id="category"
              label="Category"
              value={filters.category}
              onChange={update('category')}
              placeholder="All categories"
              options={meta?.categories ?? []}
            />
          </div>
          <div className="field">
            <Field id="location" label="Location contains" placeholder="canteen, library…" value={filters.location} onChange={update('location')} />
          </div>
          <div className="field">
            <Field
              id="date_from"
              label="From date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.date_from}
              onChange={update('date_from')}
            />
          </div>
          <div className="field">
            <Field
              id="date_to"
              label="To date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.date_to}
              onChange={update('date_to')}
            />
          </div>
          <div className="field">
            <SelectField
              id="sort"
              label="Sort by"
              value={filters.sort}
              onChange={update('sort')}
              options={[
                { value: 'recent', label: 'Newest reports' },
                { value: 'oldest', label: 'Oldest reports' },
                { value: 'date', label: 'Event date' },
                { value: 'title', label: 'Title A–Z' },
              ]}
            />
          </div>
        </div>
        <div className="row row-between">
          <span className="muted small">
            {data ? `${data.pagination.total} report(s) found` : 'Searching…'}
            {activeFilters > 0 && ` · ${activeFilters} filter(s) active`}
          </span>
          {activeFilters > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFilters(BLANK);
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <ErrorBanner error={error} onRetry={reload} />

      {loading ? (
        <Loading />
      ) : data?.items.length === 0 ? (
        <Empty icon="🔍" title="No reports match those filters">
          Try a broader keyword, or clear the date range.
        </Empty>
      ) : (
        <>
          <div className="grid grid-3">
            {(data?.items ?? []).map((item) => (
              <ItemCard key={item.item_id} item={item} />
            ))}
          </div>

          {data && data.pagination.pages > 1 && (
            <div className="row center" style={{ justifyContent: 'center', marginTop: 24 }}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                ← Previous
              </button>
              <span className="small muted">
                Page {data.pagination.page} of {data.pagination.pages}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!data.pagination.has_more}
                onClick={() => setPage((value) => value + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
