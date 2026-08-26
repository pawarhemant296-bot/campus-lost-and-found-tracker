import { Link } from 'react-router-dom';
import { categoryIcon, humanStatus, relativeTime, statusTone } from '../utils/format.js';

/** Compact item tile used on search, dashboard and my-reports screens. */
export default function ItemCard({ item, footer }) {
  return (
    <article className="item-card">
      <Link to={`/items/${item.item_id}`} className="item-thumb" aria-label={item.title}>
        {item.image_url ? <img src={item.image_url} alt={item.title} loading="lazy" /> : <span>{categoryIcon(item.category)}</span>}
      </Link>
      <div className="item-body">
        <div className="row" style={{ gap: 6 }}>
          <span className={`badge badge-${item.type}`}>{item.type}</span>
          <span className={statusTone(item.status)}>{humanStatus(item.status)}</span>
          {Number(item.is_hidden) === 1 && <span className="badge badge-danger">hidden</span>}
        </div>
        <Link to={`/items/${item.item_id}`} className="item-title" style={{ color: 'inherit' }}>
          {item.title}
        </Link>
        <div className="item-meta">
          <span>
            {categoryIcon(item.category)} {item.category}
          </span>
          <span>📍 {item.location}</span>
          <span>
            🕒 {relativeTime(item.occurred_at)} · reported by {item.reporter?.name ?? 'a user'}
          </span>
        </div>
        {item.description && <p className="item-desc">{item.description}</p>}
        <div className="spacer" />
        {footer ?? (
          <Link to={`/items/${item.item_id}`} className="btn btn-sm btn-ghost btn-block">
            View details
          </Link>
        )}
      </div>
    </article>
  );
}
