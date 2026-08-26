import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api, { toFormData } from '../api/client.js';
import { ErrorBanner, Loading } from '../components/Feedback.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';

/**
 * Claim & Verification (spec section 7). The claimant answers a question only
 * the true owner can answer, and can attach extra proof.
 */
export default function ClaimForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: prompt, error: promptError, loading } = useApi(`/claims/prompt/${id}`);
  const [answer, setAnswer] = useState('');
  const [proof, setProof] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const matchId = searchParams.get('match');
      const { claim } = await api.upload(
        '/claims',
        toFormData({ item_id: id, answer, proof, ...(matchId ? { match_id: matchId } : {}) }, file, 'image'),
      );
      toast.success('Claim submitted — the finder has been notified');
      navigate(`/claims/${claim.claim_id}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (promptError) {
    return (
      <div className="container" style={{ maxWidth: 720 }}>
        <ErrorBanner error={promptError} />
        <Link className="btn btn-ghost" to={`/items/${id}`}>
          Back to the item
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="row small muted" style={{ marginBottom: 12 }}>
        <Link to={`/items/${id}`}>← Back to the item</Link>
      </div>

      <div className="page-head">
        <div>
          <h1>Claim “{prompt.title}”</h1>
          <p>Prove the item is yours. The finder (or an administrator) reviews every claim before anything is handed over.</p>
        </div>
      </div>

      {prompt.already_claimed && (
        <div className="alert alert-warn">You already have a claim under review for this item.</div>
      )}

      <ErrorBanner error={error} />

      <form className="card" onSubmit={submit}>
        <div className="alert alert-info">
          <strong>Verification question</strong>
          <div style={{ marginTop: 4 }}>{prompt.question}</div>
        </div>

        <div className="field">
          <label className="label" htmlFor="answer">
            Your answer {prompt.requires_answer && <span className="muted">(graded automatically)</span>}
          </label>
          <input
            id="answer"
            required={prompt.requires_answer}
            placeholder="Be specific — contents, marks, serial numbers…"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          />
          <div className="hint">
            Your answer is compared with the private detail the finder stored. A human still makes the final call.
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="proof">
            Additional proof of ownership
          </label>
          <textarea
            id="proof"
            required
            minLength={10}
            placeholder="When and where you lost it, unique marks, what else was inside, a previous photo you have…"
            value={proof}
            onChange={(event) => setProof(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="proof-image">
            Supporting photo <span className="muted">(optional)</span>
          </label>
          <input id="proof-image" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <div className="hint">For example an older photo of you with the item, or a receipt.</div>
        </div>

        <div className="row">
          <button type="submit" className="btn btn-lg" disabled={busy || prompt.already_claimed}>
            {busy ? 'Submitting…' : 'Submit claim'}
          </button>
          <Link className="btn btn-ghost" to={`/items/${id}`}>
            Cancel
          </Link>
        </div>

        <p className="muted tiny" style={{ marginTop: 12, marginBottom: 0 }}>
          Filing a deliberately false claim is logged and can get your account blocked by a moderator.
        </p>
      </form>
    </div>
  );
}
