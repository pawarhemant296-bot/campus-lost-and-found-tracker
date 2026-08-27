import Icon from '../components/Icon.jsx';
import {
  Button,
  Card,
  CardHead,
  LifecycleStepper,
  SectionTitle,
  Stepper,
  Timeline,
} from '../components/ui.jsx';
import { CLAIM_STEPS } from '../lib/format.js';

const JOURNEY = [
  {
    title: 'Register or sign in',
    detail: 'One account covers both lost and found reports. Admins get a moderation console.',
    state: 'done',
  },
  {
    title: 'Choose Report Lost or Report Found',
    detail: 'A single guided form with a live preview of exactly how your card will look.',
    state: 'done',
  },
  {
    title: 'Add details, location, date/time and a photo',
    detail: 'Finders can also attach private ownership questions only the real owner can answer.',
    state: 'done',
  },
  {
    title: 'The backend validates and stores the report',
    detail: 'Photos get a 64-bit perceptual hash so visually similar items can be compared later.',
    state: 'done',
  },
  {
    title: 'The matching engine scans opposite-type listings',
    detail: 'Five weighted signals produce a single confidence score for every candidate pair.',
    state: 'current',
  },
  {
    title: 'Possible matches are generated and notified',
    detail: 'Both the owner and the finder get an alert with the score and the reasons behind it.',
    state: 'pending',
  },
  {
    title: 'Claim submitted, then ownership verified',
    detail: 'Answers are auto-scored against the private answers, then reviewed by the finder or an admin.',
    state: 'pending',
  },
  {
    title: 'Safe handover, then RETURNED',
    detail: 'Both items in the pair flip to RETURNED and the case is closed.',
    state: 'pending',
  },
];

const SAFEGUARDS = [
  {
    icon: 'lock',
    title: 'Private verification questions',
    text: 'Finders store answers that are never returned by the API. Claimants only see the prompts.',
  },
  {
    icon: 'shield',
    title: 'Masked identities',
    text: 'Reporter names and emails are masked (Aa••• S.) until a claim is approved.',
  },
  {
    icon: 'scale',
    title: 'Human review + disputes',
    text: 'Auto-scores are advisory. The finder or an admin makes the call, and rejections can be disputed.',
  },
  {
    icon: 'eye',
    title: 'Moderation tools',
    text: 'Admins can hide suspicious reports, suspend accounts and resolve contested claims.',
  },
];

export default function HowItWorks() {
  return (
    <div className="container section">
      <SectionTitle
        center
        eyebrow="How it works"
        title="The full journey: lost, found, matched, returned"
        subtitle="TraceBack formalises what usually happens over scattered messages into one auditable pipeline."
      />

      <Card className="card-pad mt-8">
        <div className="eyebrow mb-6">Item status lifecycle</div>
        <LifecycleStepper status="claim_requested" />
      </Card>

      <div className="grid mt-8" style={{ gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)', gap: 'var(--s-6)' }}>
        <Card>
          <CardHead title="Step-by-step workflow" subtitle="13 stages, fully implemented" icon="list" />
          <div className="card-body">
            <Timeline items={JOURNEY} />
          </div>
        </Card>

        <div className="col gap-6">
          <Card>
            <CardHead title="Claim & verification wizard" subtitle="What a claimant walks through" icon="shield" />
            <div className="card-body col gap-6">
              <Stepper steps={CLAIM_STEPS} currentIndex={1} />
              <p className="small muted">
                Each answer is compared with the finder's stored answer using token overlap and
                character-bigram similarity, producing an advisory auto-score. The finder still decides.
              </p>
            </div>
          </Card>

          <Card>
            <CardHead title="Safeguards" subtitle="Why a stranger can't just claim your things" icon="lock" />
            <div className="card-body col gap-4">
              {SAFEGUARDS.map((s) => (
                <div className="row gap-3" key={s.title} style={{ alignItems: 'flex-start' }}>
                  <span className="stat-icon" style={{ width: 36, height: 36 }}>
                    <Icon name={s.icon} size={16} />
                  </span>
                  <div>
                    <div className="small strong">{s.title}</div>
                    <div className="tiny muted">{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card glow className="card-pad center mt-8" style={{ textAlign: 'center' }}>
        <h3>Ready to trace something back?</h3>
        <p className="mt-2">It takes under a minute to file a report.</p>
        <div className="row gap-3 mt-6 row-wrap center">
          <Button to="/app/report/lost" iconRight="arrowRight">
            Report a lost item
          </Button>
          <Button to="/app/report/found" variant="ghost" icon="box">
            Report a found item
          </Button>
        </div>
      </Card>
    </div>
  );
}
