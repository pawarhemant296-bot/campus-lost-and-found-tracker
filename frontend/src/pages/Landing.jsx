import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ItemCard from '../components/ItemCard.jsx';
import { Field } from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useApi from '../hooks/useApi.js';

/** Landing Page - explanation, live statistics and search (spec section 12). */
export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const { data: stats } = useApi('/items/stats');
  const { data: recent } = useApi('/items?limit=6&sort=recent');

  const submit = (event) => {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="badge" style={{ background: 'rgba(255,255,255,.16)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>
            Smart matching · Verified handovers
          </span>
          <h1 style={{ marginTop: 14 }}>Lost something on campus? Let the match find it.</h1>
          <p>
            Report a lost or found item in seconds. Our matching engine compares every new report against the opposite
            side — category, description, location and time — then notifies both people when a likely match appears.
            Ownership is verified before anything changes hands.
          </p>

          <form className="hero-search" onSubmit={submit}>
            <Field
              id="hero-search"
              type="search"
              placeholder="Search for a wallet, phone, ID card…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              inputProps={{ 'aria-label': 'Search items' }}
              sx={{
                '& .MuiOutlinedInput-root': { background: 'rgba(255,255,255,0.95)' },
                '& .MuiOutlinedInput-input': { color: '#0f172a' },
                '& fieldset': { borderColor: 'transparent' },
              }}
            />
            <button type="submit" className="btn btn-ghost">
              Search
            </button>
          </form>

          <div className="row" style={{ marginTop: 18, gap: 10 }}>
            <Link className="btn btn-ghost" to={user ? '/report/lost' : '/register'}>
              Report a lost item
            </Link>
            <Link className="btn btn-ghost" to={user ? '/report/found' : '/register'}>
              I found something
            </Link>
          </div>

          {stats && (
            <div className="hero-stats">
              <div className="hero-stat">
                <b>{stats.total_items}</b>
                <span>Reports filed</span>
              </div>
              <div className="hero-stat">
                <b>{stats.lost}</b>
                <span>Lost</span>
              </div>
              <div className="hero-stat">
                <b>{stats.found}</b>
                <span>Found</span>
              </div>
              <div className="hero-stat">
                <b>{stats.returned}</b>
                <span>Returned</span>
              </div>
              <div className="hero-stat">
                <b>{stats.matches}</b>
                <span>Matches made</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="container" style={{ padding: '34px 20px 0' }}>
        <h2>How it works</h2>
        <p className="muted">The full journey, from a missing wallet to a confirmed handover.</p>
        <ol className="flow-steps" style={{ marginTop: 16 }}>
          <li>
            <strong>Report</strong>
            <span className="muted small">Item details, location, date/time and a photo.</span>
          </li>
          <li>
            <strong>Match</strong>
            <span className="muted small">The engine scores every opposite-type report and ranks the best.</span>
          </li>
          <li>
            <strong>Verify</strong>
            <span className="muted small">The claimant answers a private question only the owner can know.</span>
          </li>
          <li>
            <strong>Return</strong>
            <span className="muted small">Chat securely, hand over, and the case is marked resolved.</span>
          </li>
        </ol>
      </section>

      <section className="container" style={{ paddingTop: 34 }}>
        <div className="page-head">
          <div>
            <h2>Latest reports</h2>
            <p>Newly reported lost and found items from the community.</p>
          </div>
          <Link className="btn btn-ghost btn-sm" to="/search">
            Browse everything
          </Link>
        </div>
        <div className="grid grid-3">
          {(recent?.items ?? []).map((item) => (
            <ItemCard key={item.item_id} item={item} />
          ))}
        </div>
      </section>
    </>
  );
}
