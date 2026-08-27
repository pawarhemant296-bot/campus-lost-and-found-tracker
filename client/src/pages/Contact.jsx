import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Alert, Button, Card, CardHead, Field, Input, SectionTitle, Textarea } from '../components/ui.jsx';

const CHANNELS = [
  { icon: 'mail', label: 'Email', value: 'help@traceback.app', hint: 'Replies within one working day' },
  { icon: 'phone', label: 'Security desk', value: '+91 90000 00000', hint: 'Mon–Sat · 9am to 7pm' },
  { icon: 'building', label: 'Lost & Found counter', value: 'Block C, Campus Security Office', hint: 'Collect verified items here' },
];

const FAQ = [
  {
    q: 'Someone else claimed my item — what now?',
    a: 'Open the claim and raise a dispute. An admin reviews both sets of verification answers and decides.',
  },
  {
    q: 'How long does a report stay active?',
    a: 'Until you mark it returned or close it. The engine keeps re-scanning every new opposite report.',
  },
  {
    q: 'Do I have to share my phone number?',
    a: 'No. Chat inside TraceBack. Your name and email stay masked until a claim is approved.',
  },
  {
    q: 'Can I report on behalf of the security office?',
    a: 'Yes — staff accounts can be promoted to admin, which unlocks bulk moderation and analytics.',
  },
];

export default function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <div className="container section">
      <SectionTitle
        center
        eyebrow="Contact"
        title="Talk to the TraceBack team"
        subtitle="Questions about a claim, a dispute or deploying TraceBack on your campus? Reach out."
      />

      <div className="grid mt-8" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 'var(--s-6)' }}>
        <div className="col gap-6">
          <Card>
            <CardHead title="Reach us" icon="message" />
            <div className="card-body col gap-4">
              {CHANNELS.map((c) => (
                <div className="row gap-3" key={c.label} style={{ alignItems: 'flex-start' }}>
                  <span className="stat-icon" style={{ width: 38, height: 38 }}>
                    <Icon name={c.icon} size={17} />
                  </span>
                  <div>
                    <div className="stat-label">{c.label}</div>
                    <div className="small strong">{c.value}</div>
                    <div className="tiny faint">{c.hint}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Frequently asked" icon="sparkle" />
            <div className="card-body col gap-4">
              {FAQ.map((f) => (
                <div key={f.q}>
                  <div className="small strong">{f.q}</div>
                  <p className="tiny muted mt-2">{f.a}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHead title="Send a message" subtitle="We read every one" icon="send" />
          <form
            className="card-body col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            {sent && (
              <Alert tone="success">
                Thanks — your message is queued. In this demo build nothing leaves your machine.
              </Alert>
            )}
            <div className="grid grid-2" style={{ gap: 'var(--s-4)' }}>
              <Field label="Your name" required>
                <Input placeholder="Aarav Sharma" required icon="user" />
              </Field>
              <Field label="Email" required>
                <Input type="email" placeholder="you@college.edu" required icon="mail" />
              </Field>
            </div>
            <Field label="Subject">
              <Input placeholder="Dispute on claim #12" />
            </Field>
            <Field label="Message" required hint="Include item or claim IDs if you have them.">
              <Textarea rows={6} placeholder="Tell us what happened…" required />
            </Field>
            <Button type="submit" block iconRight="arrowRight">
              Send message
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
