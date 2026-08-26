import { formatDate, humanStatus } from '../utils/format.js';

/**
 * Item status lifecycle (spec section 8):
 * REPORTED -> POSSIBLE MATCH -> CLAIM REQUESTED -> VERIFICATION -> RETURNED -> CLOSED
 */
export default function StatusTimeline({ timeline = [] }) {
  return (
    <ol className="timeline">
      {timeline.map((event) => (
        <li key={event.status}>
          <span className={`timeline-dot${event.done ? ' done' : ''}`}>{event.done ? '✓' : ''}</span>
          <div>
            <div className="timeline-label">{humanStatus(event.status)}</div>
            <div className="muted small">{event.label}</div>
            {event.at && <div className="muted tiny">{formatDate(event.at)}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
