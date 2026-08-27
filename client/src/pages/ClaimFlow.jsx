import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardHead,
  ClaimStepper,
  Empty,
  Field,
  Input,
  ItemThumb,
  LifecycleStepper,
  LoadingBlock,
  MatchRing,
  Tag,
  Textarea,
  Timeline,
  useToast,
} from '../components/ui.jsx';
import { ClaimsAPI, MessagesAPI } from '../lib/api.js';
import { formatDateTime, timeAgo } from '../lib/format.js';

const STAGE_INDEX = { submitted: 0, verification: 1, review: 2, handover: 3, returned: 4, rejected: 2 };

export default function ClaimFlow() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState([]);
  const [note, setNote] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    ClaimsAPI.get(id)
      .then((d) => {
        setData(d);
        setAnswers((prev) =>
          prev.length ? prev : (d.questions || []).map((_, i) => d.claim?.proof?.answers?.[i]?.a || '')
        );
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <Card className="card-pad">
        <LoadingBlock rows={5} />
      </Card>
    );
  }
  if (!data) {
    return (
      <Empty
        icon="shield"
        title="Claim not found"
        message="It may have been withdrawn, or you may not have access to it."
        action={<Button to="/app/claims" iconRight="arrowRight">Back to claims</Button>}
      />
    );
  }

  const { claim, questions = [], item, disputes = [] } = data;
  const isClaimant = claim.role === 'claimant';
  const canDecide = claim.can_decide;
  const stageIdx = STAGE_INDEX[claim.stage] ?? 0;
  const scored = claim.proof?.scored_detail || [];

  const act = async (fn, successMessage) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMessage);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openChat = async () => {
    try {
      const other = isClaimant ? item.user_id : claim.claimant_id;
      navigate(`/app/messages?user=${other}&item=${claim.item_id}`);
    } catch {
      toast.error('Could not open the conversation');
    }
  };

  const timeline = [
    {
      title: 'Claim submitted',
      detail: claim.proof?.note || 'Claim opened on this report',
      time: formatDateTime(claim.created_at),
      state: 'done',
    },
    {
      title: 'Verification answers',
      detail:
        claim.answer_score != null
          ? `Auto-score ${Math.round(claim.answer_score)}% across ${questions.length} question(s)`
          : 'Waiting for the claimant to answer the private questions',
      time: claim.proof?.submitted_at ? formatDateTime(claim.proof.submitted_at) : undefined,
      state: claim.answer_score != null || claim.stage !== 'submitted' ? 'done' : 'current',
    },
    {
      title: 'Reviewed by finder / admin',
      detail:
        claim.status === 'approved'
          ? claim.decision_note || 'Ownership approved'
          : claim.status === 'rejected'
            ? claim.decision_note || 'Claim rejected'
            : 'Pending decision',
      state: ['approved', 'rejected', 'closed'].includes(claim.status)
        ? 'done'
        : claim.stage === 'review'
          ? 'current'
          : 'pending',
    },
    {
      title: 'Safe handover',
      detail: 'Both parties meet at a public place or the security desk',
      state: claim.stage === 'returned' ? 'done' : claim.stage === 'handover' ? 'current' : 'pending',
    },
    {
      title: 'Item returned · case closed',
      detail: claim.stage === 'returned' ? 'The lifecycle is complete' : 'Marks both reports as RETURNED',
      state: claim.stage === 'returned' ? 'done' : 'pending',
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/app/claims" className="row gap-2 small muted mb-3">
            <Icon name="arrowLeft" size={15} /> All claims
          </Link>
          <h1>
            Claim <span className="gradient-text">#{claim.id}</span>
          </h1>
          <p>
            {isClaimant ? 'You are claiming' : 'Someone is claiming'} “{claim.item_title}” ·{' '}
            {timeAgo(claim.updated_at)}
          </p>
        </div>
        <div className="row gap-2">
          <Tag icon="shield">{claim.stage}</Tag>
          <Tag icon="clock">{claim.status}</Tag>
        </div>
      </div>

      <Card className="card-pad mb-6">
        <ClaimStepper stage={claim.stage} />
      </Card>

      {claim.status === 'rejected' && (
        <div className="mb-6">
          <Alert tone="error" icon="x">
            <strong>This claim was not approved.</strong>{' '}
            {claim.decision_note || 'The verification answers did not match the details on record.'}
          </Alert>
        </div>
      )}
      {claim.stage === 'returned' && (
        <div className="mb-6">
          <Alert tone="success" icon="check">
            <strong>Item returned.</strong> Both reports are marked RETURNED and the case is closed.
            Thanks for using TraceBack.
          </Alert>
        </div>
      )}

      <div className="detail-grid">
        <div className="col gap-6">
          {/* ------------------------------------------- step 1: answer form */}
          {isClaimant && ['submitted', 'verification'].includes(claim.stage) && (
            <Card glow>
              <CardHead
                title="Prove it's yours"
                subtitle={`${questions.length} private question${questions.length === 1 ? '' : 's'} from the finder`}
                icon="lock"
              />
              <div className="card-body col gap-5">
                <Alert icon="shield">
                  Answers are compared with the finder's stored answers using text similarity. Be
                  specific — vague answers score low.
                </Alert>

                {questions.length === 0 ? (
                  <Alert tone="warn">
                    The finder didn't add specific questions. Describe any unique detail (marks, contents,
                    serial numbers) in the notes below instead.
                  </Alert>
                ) : (
                  questions.map((q, i) => (
                    <Field key={i} label={`Question ${i + 1}`} hint={q}>
                      <Input
                        placeholder="Your answer…"
                        value={answers[i] || ''}
                        onChange={(e) =>
                          setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))
                        }
                      />
                    </Field>
                  ))
                )}

                <Field label="Anything else?" hint="Optional — add proof like an old photo or a receipt detail.">
                  <Textarea
                    rows={3}
                    placeholder="I have a photo of me holding it from last week…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>

                <Button
                  block
                  loading={busy}
                  iconRight="arrowRight"
                  onClick={() =>
                    act(
                      () => ClaimsAPI.verify(claim.id, { answers, note }),
                      'Answers submitted — the finder will review them'
                    )
                  }
                >
                  Submit verification answers
                </Button>
              </div>
            </Card>
          )}

          {/* --------------------------------- step 2: review (finder/admin) */}
          {canDecide && claim.stage === 'review' && (
            <Card glow>
              <CardHead
                title="Review the answers"
                subtitle="Auto-scores are advisory — you decide"
                icon="scale"
              />
              <div className="card-body col gap-5">
                <div className="row gap-6 row-wrap">
                  <MatchRing
                    score={claim.answer_score ?? 0}
                    size={124}
                    caption="Auto-score"
                    pulse={(claim.answer_score ?? 0) >= 80}
                  />
                  <div className="grow col gap-3" style={{ minWidth: 220 }}>
                    {(claim.proof?.answers || []).map((a, i) => {
                      const s = scored[i];
                      return (
                        <div key={i} className="col gap-2">
                          <div className="tiny faint">{a.q}</div>
                          <div className="small soft">“{a.a || '— no answer —'}”</div>
                          {s && (
                            <div className="factor-bar">
                              <span style={{ width: `${s.similarity}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {claim.proof?.note && (
                  <div>
                    <div className="eyebrow mb-2">Claimant's note</div>
                    <p className="small">{claim.proof.note}</p>
                  </div>
                )}

                <Field label="Decision note" hint="Shared with the claimant.">
                  <Textarea
                    rows={2}
                    placeholder="Answers match the scratch and the contents — approving."
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                  />
                </Field>

                <div className="row gap-3">
                  <Button
                    variant="success"
                    className="grow"
                    icon="check"
                    loading={busy}
                    onClick={() =>
                      act(
                        () => ClaimsAPI.decide(claim.id, { decision: 'approve', note: decisionNote }),
                        'Claim approved — arrange the handover'
                      )
                    }
                  >
                    Approve ownership
                  </Button>
                  <Button
                    variant="danger"
                    icon="x"
                    loading={busy}
                    onClick={() =>
                      act(
                        () => ClaimsAPI.decide(claim.id, { decision: 'reject', note: decisionNote }),
                        'Claim rejected'
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* --------------------------------------------- step 3: handover */}
          {claim.stage === 'handover' && (
            <Card glow>
              <CardHead title="Arrange a safe handover" subtitle="Ownership verified" icon="handshake" />
              <div className="card-body col gap-5">
                <Alert tone="success" icon="check">
                  Ownership approved. Identities are now visible to both parties so you can coordinate.
                </Alert>
                <ul className="col gap-2 small soft">
                  {[
                    'Meet in a public place — the security desk or the canteen works well.',
                    'Bring an ID so both sides can confirm identity.',
                    'Check the item together before confirming the handover here.',
                  ].map((t) => (
                    <li className="row gap-2" key={t}>
                      <Icon name="check" size={14} style={{ color: 'var(--violet-300)', flex: '0 0 auto', marginTop: 3 }} />
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="row gap-3 row-wrap">
                  <Button variant="ghost" icon="message" onClick={openChat}>
                    Open chat
                  </Button>
                  <Button
                    className="grow"
                    icon="handshake"
                    loading={busy}
                    onClick={() => act(() => ClaimsAPI.handover(claim.id), 'Handover confirmed — item marked RETURNED')}
                  >
                    Confirm handover complete
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* ---------------------------------------------- step 4: closing */}
          {claim.stage === 'returned' && claim.item_status !== 'closed' && (
            <Card>
              <CardHead title="Close the case" subtitle="Final lifecycle step" icon="check" />
              <div className="card-body col gap-4">
                <p className="small muted">
                  Closing archives both reports so they stop appearing in active searches and matching.
                </p>
                <Button
                  variant="ghost"
                  icon="check"
                  loading={busy}
                  onClick={() => act(() => ClaimsAPI.close(claim.id), 'Case closed')}
                >
                  Mark case as CLOSED
                </Button>
              </div>
            </Card>
          )}

          {/* --------------------------------------------------- disputes */}
          {claim.status === 'rejected' && isClaimant && (
            <Card>
              <CardHead title="Disagree with the decision?" subtitle="Escalate to an admin" icon="scale" />
              <div className="card-body col gap-4">
                {disputes.length > 0 ? (
                  disputes.map((d) => (
                    <Alert key={d.id} tone={d.status === 'open' ? 'warn' : 'info'}>
                      <strong>Dispute {d.status}</strong> · {d.reason}
                      {d.resolution && <div className="tiny mt-2">Admin: {d.resolution}</div>}
                    </Alert>
                  ))
                ) : (
                  <>
                    <Textarea
                      rows={3}
                      placeholder="Explain why you believe the decision was wrong (min. 10 characters)…"
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      icon="flag"
                      loading={busy}
                      disabled={disputeReason.trim().length < 10}
                      onClick={() =>
                        act(() => ClaimsAPI.dispute(claim.id, disputeReason), 'Dispute raised — an admin will review it')
                      }
                    >
                      Raise a dispute
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )}

          {disputes.length > 0 && claim.status !== 'rejected' && (
            <Card>
              <CardHead title="Disputes" subtitle={`${disputes.length} raised`} icon="scale" />
              <div className="card-body col gap-3">
                {disputes.map((d) => (
                  <Alert key={d.id} tone={d.status === 'open' ? 'warn' : 'info'}>
                    <strong>{d.raised_by_name}</strong> · {d.reason}
                  </Alert>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ------------------------------------------------------ side panel */}
        <div className="col gap-6 sticky-side">
          <Card>
            <CardHead title="The item" icon="box" />
            <div className="card-body col gap-4">
              <Link to={`/items/${claim.item_id}`} className="row gap-3">
                <ItemThumb item={{ image_url: claim.item_image, title: claim.item_title }} size={58} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="small strong truncate">{claim.item_title}</div>
                  <div className="tiny muted truncate">
                    {claim.item_category} · {claim.item_location}
                  </div>
                </div>
                <Icon name="chevronRight" size={15} className="muted" />
              </Link>
              <div className="divider" style={{ margin: 0 }} />
              <div className="eyebrow">Item lifecycle</div>
              <LifecycleStepper status={claim.item_status} compact />
            </div>
          </Card>

          <Card>
            <CardHead title="Parties" icon="users" />
            <div className="card-body col gap-4">
              <div className="row gap-3">
                <Avatar name={claim.claimant_name} hue={claim.claimant_hue} />
                <div>
                  <div className="small strong">{claim.claimant_name}</div>
                  <div className="tiny faint">Claimant {isClaimant && '· you'}</div>
                </div>
              </div>
              <div className="row gap-3">
                <Avatar name={claim.reporter_name} hue={265} />
                <div>
                  <div className="small strong">{claim.reporter_name}</div>
                  <div className="tiny faint">Reporter / finder {canDecide && !isClaimant && '· you'}</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" icon="message" onClick={openChat} block>
                Message {isClaimant ? 'the finder' : 'the claimant'}
              </Button>
              {claim.status !== 'approved' && (
                <p className="tiny faint">
                  Full names and contact details unlock once the claim is approved.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Case timeline" icon="clock" />
            <div className="card-body">
              <Timeline items={timeline} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
