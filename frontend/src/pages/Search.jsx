import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Empty, ErrorBanner, Loading } from '../components/Feedback.jsx';
import ItemCard from '../components/ItemCard.jsx';
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
            <label className="label" htmlFor="q">
              Keyword
            </label>
            <input id="q" type="search" placeholder="wallet, redmi, id card…" value={filters.q} onChange={update('q')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="type">
              Report type
            </label>
            <select id="type" value={filters.type} onChange={update('type')}>
              <option value="">Lost and found</option>
              <option value="lost">Lost items only</option>
              <option value="found">Found items only</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="category">
              Category
            </label>
            <select id="category" value={filters.category} onChange={update('category')}>
              <option value="">All categories</option>
              {(meta?.categories ?? []).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="location">
              Location contains
            </label>
            <input id="location" placeholder="canteen, library…" value={filters.location} onChange={update('location')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="date_from">
              From date
            </label>
            <input id="date_from" type="date" value={filters.date_from} onChange={update('date_from')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="date_to">
              To date
            </label>
            <input id="date_to" type="date" value={filters.date_to} onChange={update('date_to')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="sort">
              Sort by
            </label>
            <select id="sort" value={filters.sort} onChange={update('sort')}>
              <option value="recent">Newest reports</option>
              <option value="oldest">Oldest reports</option>
              <option value="date">Event date</option>
              <option value="title">Title A–Z</option>
            </select>
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
