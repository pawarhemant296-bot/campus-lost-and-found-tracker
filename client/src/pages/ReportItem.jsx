import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  Alert,
  Button,
  Card,
  CardHead,
  Field,
  Input,
  MatchRing,
  Modal,
  Select,
  StatusBadge,
  Stepper,
  Tag,
  Textarea,
  ToggleGroup,
  useToast,
} from '../components/ui.jsx';
import { ItemsAPI } from '../lib/api.js';
import { formatDate, toLocalInput } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

const STEPS = [
  { key: 'details', label: 'Details' },
  { key: 'photo', label: 'Photo' },
  { key: 'review', label: 'Review' },
];

export default function ReportItem() {
  const { type: routeType } = useParams();
  const { meta, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [step, setStep] = useState(0);
  const [type, setType] = useState(routeType === 'found' ? 'found' : 'lost');
  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    location: '',
    item_date: toLocalInput(),
  });
  const [questions, setQuestions] = useState([{ q: '', a: '' }]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    setType(routeType === 'found' ? 'found' : 'lost');
  }, [routeType]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const detailsValid =
    form.title.trim().length >= 3 && form.category && form.item_date && !Number.isNaN(Date.parse(form.item_date));

  const filledQuestions = useMemo(
    () => questions.filter((q) => q.q.trim() && q.a.trim()),
    [questions]
  );

  const pickFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast.error('Please choose an image file');
    if (f.size > 8 * 1024 * 1024) return toast.error('Image must be under 8 MB');
    setFile(f);
  };

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('type', type);
      fd.append('title', form.title.trim());
      fd.append('category', form.category);
      fd.append('description', form.description.trim());
      fd.append('location', form.location.trim());
      fd.append('item_date', new Date(form.item_date).toISOString());
      if (type === 'found' && filledQuestions.length) {
        fd.append('questions', JSON.stringify(filledQuestions));
      }
      if (file) fd.append('photo', file);

      const res = await ItemsAPI.create(fd);
      setResult(res);
      toast.success(
        res.match_count
          ? `Report saved — ${res.match_count} possible match${res.match_count === 1 ? '' : 'es'} found!`
          : 'Report saved — we’ll keep scanning for matches'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const switchType = (t) => {
    setType(t);
    navigate(`/app/report/${t}`, { replace: true });
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">New report</div>
          <h1>
            Report {type === 'lost' ? 'a lost' : 'a found'}{' '}
            <span className="gradient-text">item</span>
          </h1>
          <p>
            {type === 'lost'
              ? 'Describe what you lost. Every new found report gets compared against yours automatically.'
              : 'Thanks for handing it in. Add private ownership questions so only the real owner can claim it.'}
          </p>
        </div>
        <ToggleGroup
          value={type}
          onChange={switchType}
          options={[
            { value: 'lost', label: 'Lost', icon: 'search' },
            { value: 'found', label: 'Found', icon: 'box' },
          ]}
        />
      </div>

      <Card className="card-pad mb-6">
        <Stepper steps={STEPS} currentIndex={step} />
      </Card>

      <div className="form-grid">
        {/* ------------------------------------------------------------ form */}
        <Card>
          <CardHead
            title={STEPS[step].label}
            subtitle={`Step ${step + 1} of ${STEPS.length}`}
            icon={step === 0 ? 'edit' : step === 1 ? 'camera' : 'check'}
          />
          <div className="card-body col gap-6">
            {error && <Alert tone="error">{error}</Alert>}

            {step === 0 && (
              <>
                <Field label="Item title" required hint="Short and specific — e.g. “Black leather wallet”">
                  <Input
                    placeholder={type === 'lost' ? 'Black leather wallet' : 'Black wallet found near canteen counter'}
                    value={form.title}
                    onChange={set('title')}
                    maxLength={120}
                  />
                </Field>

                <div className="grid grid-2" style={{ gap: 'var(--s-4)' }}>
                  <Field label="Category" required>
                    <Select
                      placeholder="Select a category"
                      options={meta?.categories || []}
                      value={form.category}
                      onChange={set('category')}
                    />
                  </Field>
                  <Field label="Date & time" required hint={type === 'lost' ? 'When did you lose it?' : 'When did you find it?'}>
                    <Input type="datetime-local" value={form.item_date} onChange={set('item_date')} />
                  </Field>
                </div>

                <Field label="Location" hint="Pick a known place or type your own below">
                  <Select
                    placeholder="Select a location"
                    options={meta?.locations || []}
                    value={(meta?.locations || []).includes(form.location) ? form.location : ''}
                    onChange={set('location')}
                  />
                </Field>
                <Field label="Or describe the place">
                  <Input
                    icon="pin"
                    placeholder="Near the billing counter, first floor"
                    value={form.location}
                    onChange={set('location')}
                  />
                </Field>

                <Field
                  label="Description"
                  hint="Colour, brand, marks, contents — the more detail, the better the match score."
                >
                  <Textarea
                    rows={5}
                    placeholder="Black leather bifold with a silver zip. Contains a college ID and a blue metro card. Faded scratch on the front."
                    value={form.description}
                    onChange={set('description')}
                    maxLength={1200}
                  />
                </Field>

                {type === 'found' && (
                  <div className="col gap-3">
                    <div className="row-between">
                      <span className="label" style={{ margin: 0 }}>
                        Private ownership questions
                      </span>
                      <span className="tiny faint">{filledQuestions.length} ready</span>
                    </div>
                    <Alert icon="lock">
                      Answers are stored privately and never shown to anyone. Claimants only see the
                      questions — their answers are auto-scored against yours.
                    </Alert>
                    {questions.map((q, i) => (
                      <Card key={i} className="card-pad-sm col gap-3">
                        <div className="row-between">
                          <span className="tiny eyebrow">Question {i + 1}</span>
                          {questions.length > 1 && (
                            <button
                              className="btn btn-icon btn-subtle btn-sm"
                              onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                              aria-label="Remove question"
                            >
                              <Icon name="x" size={13} />
                            </button>
                          )}
                        </div>
                        <Select
                          placeholder="Choose a suggested question…"
                          options={meta?.question_templates || []}
                          value={(meta?.question_templates || []).includes(q.q) ? q.q : ''}
                          onChange={(e) =>
                            setQuestions(questions.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))
                          }
                        />
                        <Input
                          placeholder="…or write your own question"
                          value={q.q}
                          onChange={(e) =>
                            setQuestions(questions.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))
                          }
                        />
                        <Input
                          icon="lock"
                          placeholder="The correct answer (kept private)"
                          value={q.a}
                          onChange={(e) =>
                            setQuestions(questions.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))
                          }
                        />
                      </Card>
                    ))}
                    {questions.length < 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="plus"
                        onClick={() => setQuestions([...questions, { q: '', a: '' }])}
                      >
                        Add another question
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                {preview ? (
                  <div className="col gap-4">
                    <div className="dropzone-preview">
                      <img src={preview} alt="Selected item" />
                    </div>
                    <div className="row gap-3">
                      <Button variant="ghost" icon="refresh" onClick={() => fileRef.current?.click()}>
                        Replace photo
                      </Button>
                      <Button variant="subtle" icon="trash" onClick={() => setFile(null)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`dropzone ${dragging ? 'dragging' : ''}`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="dropzone-icon">
                      <Icon name="upload" size={22} />
                    </span>
                    <div className="strong">Drag &amp; drop a photo here</div>
                    <div className="small muted">or click to browse · JPG, PNG or WebP · max 8 MB</div>
                    <div className="tiny faint mt-2">
                      A photo enables image similarity matching (15% of the score)
                    </div>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <Alert>
                  No photo? That's fine — the engine drops the image factor and re-normalises the other
                  four weights so scores stay comparable.
                </Alert>
              </>
            )}

            {step === 2 && (
              <div className="col gap-4">
                <Alert tone="success" icon="check">
                  Everything looks good. Submitting runs the matching engine immediately against all
                  open {type === 'lost' ? 'found' : 'lost'} reports.
                </Alert>
                <dl className="kv">
                  <dt>Type</dt>
                  <dd className="strong" style={{ textTransform: 'capitalize' }}>{type}</dd>
                  <dt>Title</dt>
                  <dd>{form.title || '—'}</dd>
                  <dt>Category</dt>
                  <dd>{form.category || '—'}</dd>
                  <dt>Location</dt>
                  <dd>{form.location || '—'}</dd>
                  <dt>Date &amp; time</dt>
                  <dd>{form.item_date ? new Date(form.item_date).toLocaleString() : '—'}</dd>
                  <dt>Photo</dt>
                  <dd>{file ? file.name : 'Not attached'}</dd>
                  {type === 'found' && (
                    <>
                      <dt>Questions</dt>
                      <dd>{filledQuestions.length} private question(s)</dd>
                    </>
                  )}
                </dl>
              </div>
            )}

            <div className="divider" />

            <div className="row-between">
              <Button
                variant="subtle"
                icon="arrowLeft"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  iconRight="arrowRight"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={step === 0 && !detailsValid}
                >
                  Continue
                </Button>
              ) : (
                <Button iconRight="arrowRight" loading={busy} onClick={submit} disabled={!detailsValid}>
                  Submit Report
                </Button>
              )}
            </div>
            {step === 0 && !detailsValid && (
              <span className="tiny faint">
                Add a title (3+ characters), pick a category and set the date to continue.
              </span>
            )}
          </div>
        </Card>

        {/* --------------------------------------------------- live preview */}
        <div className="col gap-6 sticky-side">
          <Card>
            <CardHead title="Live preview" subtitle="How your card will appear" icon="eye" />
            <div className="card-body">
              <Card className="item-card">
                <div className="item-media">
                  {preview ? (
                    <img src={preview} alt="preview" />
                  ) : (
                    <div className="center" style={{ height: '100%', color: 'var(--text-faint)' }}>
                      <div className="col center gap-2">
                        <Icon name="camera" size={30} strokeWidth={1.3} />
                        <span className="tiny">Photo preview</span>
                      </div>
                    </div>
                  )}
                  <div className="item-media-top">
                    <span className={`badge badge-${type}`}>{type}</span>
                    <StatusBadge status="reported" />
                  </div>
                </div>
                <div className="item-body">
                  <h4 style={{ fontSize: 'var(--fs-md)' }}>
                    {form.title || 'Your item title appears here'}
                  </h4>
                  <p className="tiny muted clamp-3">
                    {form.description || 'Your description will be used for text similarity matching.'}
                  </p>
                  <div className="item-meta">
                    <span>
                      <Icon name="tag" size={12} /> {form.category || 'Category'}
                    </span>
                    <span>
                      <Icon name="pin" size={12} /> {form.location || 'Location'}
                    </span>
                    <span>
                      <Icon name="calendar" size={12} /> {form.item_date ? formatDate(form.item_date) : 'Date'}
                    </span>
                  </div>
                  <div className="tiny faint row gap-2">
                    <Icon name="user" size={12} /> Reported by {user?.name}
                  </div>
                </div>
              </Card>
            </div>
          </Card>

          <Card className="card-pad col gap-3">
            <div className="eyebrow">Match strength checklist</div>
            {[
              { ok: form.title.trim().length >= 3, label: 'Descriptive title', weight: '25%' },
              { ok: form.description.trim().length >= 25, label: 'Detailed description', weight: '25%' },
              { ok: Boolean(form.location.trim()), label: 'Location provided', weight: '20%' },
              { ok: Boolean(form.item_date), label: 'Date & time set', weight: '15%' },
              { ok: Boolean(file), label: 'Photo attached', weight: '15%' },
            ].map((c) => (
              <div className="row gap-3 small" key={c.label}>
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    flex: '0 0 auto',
                    background: c.ok ? 'var(--grad-primary)' : 'rgba(255,255,255,0.07)',
                    color: c.ok ? '#fff' : 'var(--text-faint)',
                    boxShadow: c.ok ? 'var(--glow-xs)' : 'none',
                  }}
                >
                  <Icon name={c.ok ? 'check' : 'minus'} size={12} strokeWidth={2.6} />
                </span>
                <span className={c.ok ? 'soft' : 'faint'}>{c.label}</span>
                <span className="tiny faint ml-auto mono">{c.weight}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------------ result modal */}
      {result && (
        <Modal
          title={result.match_count ? 'Possible match found!' : 'Report submitted'}
          onClose={() => navigate('/app/reports')}
          footer={
            <div className="row gap-3 ml-auto">
              <Button variant="subtle" onClick={() => navigate('/app/reports')}>
                Go to my reports
              </Button>
              {result.match_count > 0 ? (
                <Button onClick={() => navigate('/app/matches')} iconRight="arrowRight">
                  View {result.match_count} match{result.match_count === 1 ? '' : 'es'}
                </Button>
              ) : (
                <Button onClick={() => navigate(`/items/${result.item.id}`)} iconRight="arrowRight">
                  View my report
                </Button>
              )}
            </div>
          }
        >
          <div className="col gap-5">
            {result.match_count > 0 ? (
              <>
                <Alert tone="success" icon="target">
                  The engine compared your report against every open{' '}
                  {type === 'lost' ? 'found' : 'lost'} listing and found{' '}
                  <strong>
                    {result.match_count} candidate{result.match_count === 1 ? '' : 's'}
                  </strong>{' '}
                  above the threshold. Both sides have been notified.
                </Alert>
                {result.matches.slice(0, 3).map((m) => {
                  const other = m.lost_item?.id === result.item.id ? m.found_item : m.lost_item;
                  return (
                    <div className="row gap-4" key={m.id}>
                      <MatchRing score={m.match_score} size={78} stroke={7} caption="" />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="small strong truncate">{other?.title}</div>
                        <div className="tiny muted truncate">
                          {other?.category} · {other?.location}
                        </div>
                        <div className="row gap-2 mt-2 row-wrap">
                          {(m.breakdown?.reasons || []).slice(0, 2).map((r) => (
                            <Tag key={r}>{r}</Tag>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <Alert icon="radar">
                Nothing scores above the match threshold yet. Your report stays active — the engine
                re-runs automatically every time an opposite report is filed, and you'll be notified
                instantly.
              </Alert>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
