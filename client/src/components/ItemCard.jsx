import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Card, StatusBadge } from './ui.jsx';
import { formatDate, timeAgo } from '../lib/format.js';

export default function ItemCard({ item, to }) {
  return (
    <Link to={to || `/items/${item.id}`} style={{ display: 'block', height: '100%' }}>
      <Card hover className="item-card">
        <div className="item-media">
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} loading="lazy" />
          ) : (
            <div className="center" style={{ height: '100%', color: 'var(--text-faint)' }}>
              <Icon name="box" size={32} strokeWidth={1.3} />
            </div>
          )}
          <div className="item-media-top">
            <span className={`badge badge-${item.type}`}>{item.type}</span>
            <StatusBadge status={item.status} />
          </div>
          <div className="item-media-overlay">
            <span className="tag">
              <Icon name="tag" size={12} /> {item.category}
            </span>
            <span className="tiny faint">{timeAgo(item.created_at)}</span>
          </div>
        </div>

        <div className="item-body">
          <h4 style={{ fontSize: 'var(--fs-md)' }} className="clamp-2">
            {item.title}
          </h4>
          {item.description && <p className="tiny muted clamp-2">{item.description}</p>}
          <div className="item-meta" style={{ marginTop: 'auto' }}>
            <span>
              <Icon name="pin" size={12} /> {item.location || 'Unknown'}
            </span>
            <span>
              <Icon name="calendar" size={12} /> {formatDate(item.item_date)}
            </span>
          </div>
          {item.reporter && (
            <div className="tiny faint row gap-2">
              <Icon name="user" size={12} />
              {item.reporter.is_you ? 'Reported by you' : `Reported by ${item.reporter.name}`}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
