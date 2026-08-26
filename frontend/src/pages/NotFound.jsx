import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container">
      <div className="empty">
        <div className="empty-icon">🧭</div>
        <h1>Page not found</h1>
        <p className="muted">That screen does not exist. It may have been moved or the case was closed.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn" to="/">
            Go home
          </Link>
          <Link className="btn btn-ghost" to="/search">
            Browse items
          </Link>
        </div>
      </div>
    </div>
  );
}
