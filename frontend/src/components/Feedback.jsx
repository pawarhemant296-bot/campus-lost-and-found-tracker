/** Tiny presentational helpers: loading, empty state and error banner. */

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="center muted">
      <div className="spinner" />
      <div className="small">{label}</div>
    </div>
  );
}

export function Empty({ icon = '🔍', title = 'Nothing here yet', children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error row row-between">
      <span>{typeof error === 'string' ? error : error.message}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Badge({ tone = '', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
