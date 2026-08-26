import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { toFormData } from '../api/client.js';
import { ErrorBanner, Loading } from '../components/Feedback.jsx';
import { MatchBreakdown, ScoreRing } from '../components/MatchScore.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import { scoreLabel, toDateTimeLocal } from '../utils/format.js';

const EMPTY = {
  title: '',
  category: '',
  description: '',
  location: '',
  occurred_at: toDateTimeLocal(),
  latitude: '',
  longitude: '',
  verification_question: '',
  secret_details: '',
};

/** Report Lost Item / Report Found Item, and the edit form for both. */
export default function ReportItem({ editing = false }) {
  const { type: typeParam, id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: meta } = useApi('/items/categories');
  const { data: existing, loading: loadingItem, error: loadError } = useApi(editing ? `/items/${id}` : null);

  const [type, setType] = useState(typeParam === 'found' ? 'found' : 'lost');
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (typeParam) setType(typeParam === 'found' ? 'found' : 'lost');
  }, [typeParam]);

  // Prefill when editing.
  useEffect(() => {
    if (!editing || !existing?.item) return;
    const item = existing.item;
    setType(item.type);
    setForm({
      title: item.title ?? '',
      category: item.category ?? '',
      description: item.description ?? '',
      location: item.location ?? '',
      occurred_at: toDateTimeLocal(new Date(item.occurred_at)),
      latitude: item.latitude ?? '',
      longitude: item.longitude ?? '',
      verification_question: item.verification_question ?? '',
      secret_details: '',
    });
  }, [editing, existing]);

  const isFound = type === 'found';
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const categories = useMemo(() => meta?.categories ?? [], [meta]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('This browser cannot share your location');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({
          ...current,
          latitude: coords.latitude.toFixed(6),
          longitude: coords.longitude.toFixed(6),
        }));
        toast.success('Coordinates attached — matching can now use real distance');
      },
      () => toast.error('Could not read your location'),
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, type };
      // `datetime-local` has no timezone; send a full ISO string.
      payload.occurred_at = new Date(form.occurred_at).toISOString();

      if (editing) {
        const { item } = await api.upload(`/items/${id}`, toFormData(payload, file), 'PATCH');
        toast.success('Report updated');
        navigate(`/items/${item.item_id}`);
        return;
      }

      const response = await api.upload('/items', toFormData(payload, file));
      toast.success(
        response.new_matches > 0
          ? `Report saved — ${response.new_matches} possible match found!`
          : 'Report saved. You will be notified as soon as a match appears.',
      );
      setResult(response);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  if (editing && loadingItem) return <Loading />;
  if (editing && loadError) {
    return (
      <div className="container">
        <ErrorBanner error={loadError} />
      </div>
    );
  }

  // --- post-submit summary (the "possible match" moment) --------------------
  if (result) {
    const best = result.best_match;
    return (
      <div className="container" style={{ maxWidth: 780 }}>
        <div className="card">
          <h1>Report saved ✅</h1>
          <p className="muted">
            Your {result.item.type} report <strong>{result.item.title}</strong> is now stored and the matching engine has
            already compared it against every open report on the other side.
          </p>

          {best ? (
            <>
              <div className="alert alert-success">
                <strong>{scoreLabel(best.match_score)}</strong> — the engine scored a possible match at{' '}
                <strong>{best.match_score}%</strong>.
              </div>
              <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
                <ScoreRing score={best.match_score} size={84} />
                <div style={{ flex: 1, minWidth: 240 }}>
                  <h3 style={{ marginBottom: 4 }}>
                    {result.item.type === 'lost' ? best.found_item?.title : best.lost_item?.title}
                  </h3>
                  <p className="muted small">
                    📍 {result.item.type === 'lost' ? best.found_item?.location : best.lost_item?.location}
                  </p>
                  <MatchBreakdown breakdown={best.breakdown} />
                </div>
              </div>
              <div className="row" style={{ marginTop: 16 }}>
                <Link className="btn" to={`/matches/${best.match_id}`}>
                  Review the match
                </Link>
                <Link className="btn btn-ghost" to={`/items/${result.item.item_id}`}>
                  Open my report
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="alert alert-info">
                No match above the threshold yet. We keep scanning: every new report on the other side is scored against
                yours automatically, and you get a notification the moment something matches.
              </div>
              <div className="row">
                <Link className="btn" to={`/items/${result.item.item_id}`}>
                  Open my report
                </Link>
                <Link className="btn btn-ghost" to="/search">
                  Browse items manually
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- the form ------------------------------------------------------------
  return (
    <div className="container" style={{ maxWidth: 780 }}>
      <div className="page-head">
        <div>
          <h1>{editing ? 'Edit report' : isFound ? 'Report a found item' : 'Report a lost item'}</h1>
          <p>
            {isFound
              ? 'Thank you for helping. Describe what you found and keep one private detail to yourself for verification.'
              : 'Describe the item as precisely as you can — colour, brand and marks make matching much more accurate.'}
          </p>
        </div>
      </div>

      <ErrorBanner error={error} />

      <form className="card" onSubmit={submit}>
        {!editing && (
          <div className="field">
            <span className="label">What are you reporting?</span>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-option${!isFound ? ' selected' : ''}`}
                onClick={() => setType('lost')}
                aria-pressed={!isFound}
              >
                <b>😟 I lost an item</b>
                <span>Somebody may already have handed it in.</span>
              </button>
              <button
                type="button"
                className={`type-option${isFound ? ' selected' : ''}`}
                onClick={() => setType('found')}
                aria-pressed={isFound}
              >
                <b>🙌 I found an item</b>
                <span>Help us return it to the right owner.</span>
              </button>
            </div>
          </div>
        )}

        <div className="form-grid">
          <div className="field">
            <label className="label" htmlFor="title">
              Item title
            </label>
            <input id="title" required minLength={3} placeholder="Black leather wallet" value={form.title} onChange={update('title')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="category">
              Category
            </label>
            <input id="category" list="category-options" required placeholder="Wallet / Purse" value={form.category} onChange={update('category')} />
            <datalist id="category-options">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            placeholder={
              isFound
                ? 'Where exactly it was lying, colour, brand, visible condition…'
                : 'Colour, brand, distinguishing marks, what was inside…'
            }
            value={form.description}
            onChange={update('description')}
          />
          <div className="hint">Description similarity is worth 25% of the match score — details pay off.</div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label className="label" htmlFor="location">
              {isFound ? 'Where did you find it?' : 'Where did you lose it?'}
            </label>
            <input id="location" required minLength={2} placeholder="College Canteen, Block B" value={form.location} onChange={update('location')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="occurred_at">
              Date &amp; time
            </label>
            <input id="occurred_at" type="datetime-local" required value={form.occurred_at} onChange={update('occurred_at')} max={toDateTimeLocal()} />
          </div>
        </div>

        <div className="field">
          <div className="row row-between">
            <span className="label" style={{ marginBottom: 0 }}>
              Map coordinates <span className="muted">(optional)</span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={useMyLocation}>
              📍 Use my location
            </button>
          </div>
          <div className="form-grid" style={{ marginTop: 6 }}>
            <input placeholder="Latitude" value={form.latitude} onChange={update('latitude')} inputMode="decimal" />
            <input placeholder="Longitude" value={form.longitude} onChange={update('longitude')} inputMode="decimal" />
          </div>
          <div className="hint">With coordinates on both reports the engine uses real distance instead of text similarity.</div>
        </div>

        <div className="field">
          <label className="label" htmlFor="image">
            Photo {editing && <span className="muted">(upload a new one to replace it)</span>}
          </label>
          <input id="image" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <div className="hint">A photo on both sides unlocks the 15% image-similarity factor when the AI service is on.</div>
        </div>

        {isFound && (
          <fieldset className="card card-tight" style={{ boxShadow: 'none', background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
            <legend className="label">🔐 Ownership verification (recommended)</legend>
            <p className="muted small">
              Keep one detail out of the public listing. A claimant must describe it before you hand the item over — this
              is what stops anyone from simply claiming it.
            </p>
            <div className="field">
              <label className="label" htmlFor="verification_question">
                Question for the claimant
              </label>
              <input
                id="verification_question"
                placeholder="Which cards are inside, and what is unusual about its condition?"
                value={form.verification_question}
                onChange={update('verification_question')}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="secret_details">
                Expected answer / private detail
              </label>
              <input
                id="secret_details"
                placeholder="library card and a torn right corner"
                value={form.secret_details}
                onChange={update('secret_details')}
              />
              <div className="hint">
                Stored privately and never returned by the API — not even to you. Claim answers are graded against it
                automatically.
              </div>
            </div>
          </fieldset>
        )}

        <div className="row" style={{ marginTop: 18 }}>
          <button type="submit" className="btn btn-lg" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : isFound ? 'Submit found report' : 'Submit lost report'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
