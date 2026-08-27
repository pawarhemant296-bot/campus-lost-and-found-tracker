import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  LifecycleStepper,
  MatchRing,
  SectionTitle,
  StatusBadge,
  Tag,
} from '../components/ui.jsx';
import { MetaAPI } from '../lib/api.js';
import { compact, formatDate } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

const STEPS = [
  {
    icon: 'upload',
    title: 'Report',
    text: 'Log a lost or found item with a photo, place and time. Takes under a minute.',
  },
  {
    icon: 'target',
    title: 'Match',
    text: 'The engine scores every opposite report on 5 signals and surfaces the strongest.',
  },
  {
    icon: 'shield',
    title: 'Verify',
    text: 'Private ownership questions prove the claim before any identity is revealed.',
  },
  {
    icon: 'handshake',
    title: 'Return',
    text: 'Arrange a safe handover in chat and the case is closed as RETURNED.',
  },
];

const FACTORS = [
  { label: 'Item & category', weight: 25, icon: 'tag' },
  { label: 'Description text', weight: 25, icon: 'list' },
  { label: 'Location', weight: 20, icon: 'pin' },
  { label: 'Date & time', weight: 15, icon: 'clock' },
  { label: 'Image similarity', weight: 15, icon: 'camera' },
];

export default function Landing() {
  const { user, meta } = useAuth();
  const [stats, setStats] = useState(null);
  const [showcase, setShowcase] = useState([]);

  useEffect(() => {
    MetaAPI.stats().then(setStats).catch(() => {});
    MetaAPI.showcase().then((d) => setShowcase(d.items || [])).catch(() => {});
  }, []);

  const weights = meta?.matching?.weights;

  return (
    <>
      {/* ============================================================ HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="row gap-2 mb-4">
              <Badge>PCE SW PS 13</Badge>
              <Tag icon="sparkle">AI-assisted matching</Tag>
            </div>
            <h1>
              <span className="line">LOST SOMETHING?</span>
              <span className="gradient-text">WE'LL TRACE IT BACK</span>
            </h1>
            <p className="hero-sub mt-6">
              TraceBack is a centralised lost &amp; found network for campuses and public spaces. Report
              an item once — our matching engine keeps comparing every new report against yours,
              verifies ownership privately, and tracks the item all the way home.
            </p>
            <div className="row gap-3 row-wrap mt-8">
              <Button to={user ? '/app/report/lost' : '/register'} size="lg" iconRight="arrowRight">
                Report an Item
              </Button>
              <Button to="/how-it-works" size="lg" variant="ghost" icon="play">
                See How It Works
              </Button>
            </div>
            <div className="row gap-6 row-wrap mt-8 tiny muted">
              <span className="row gap-2">
                <Icon name="shield" size={14} /> Identities masked until verified
              </span>
              <span className="row gap-2">
                <Icon name="lock" size={14} /> Private ownership questions
              </span>
              <span className="row gap-2">
                <Icon name="clock" size={14} /> Live status tracking
              </span>
            </div>
          </div>

          {/* radar visual */}
          <div className="center">
            <div className="radar">
              <div className="radar-ring" style={{ inset: '6%' }} />
              <div className="radar-ring" style={{ inset: '22%' }} />
              <div className="radar-ring" style={{ inset: '38%' }} />
              <div className="radar-sweep" />
              <span className="radar-blip" style={{ top: '22%', left: '68%' }} />
              <span className="radar-blip" style={{ top: '64%', left: '26%', animationDelay: '1.1s' }} />
              <span className="radar-blip" style={{ top: '74%', left: '62%', animationDelay: '2.2s' }} />
              <div className="radar-core">
                <Icon name="radar" size={44} strokeWidth={1.3} style={{ color: '#fff' }} />
              </div>
            </div>
          </div>
        </div>

        {/* stats bar */}
        <div className="container mt-8">
          <div className="stats-bar">
            {[
              { label: 'Items Reported', value: compact(stats?.items_reported ?? 0) },
              { label: 'Match Success Rate', value: `${stats?.match_success_rate ?? 0}%` },
              { label: 'Items Returned', value: compact(stats?.items_returned ?? 0) },
              { label: 'Active Users', value: compact(stats?.active_users ?? 0) },
            ].map((s) => (
              <div key={s.label}>
                <div className="stat-value gradient-text">{s.value}</div>
                <div className="stat-label mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================== HOW IT WORKS */}
      <section className="section-tight" id="how">
        <div className="container">
          <SectionTitle
            center
            eyebrow="How it works"
            title="Four steps from lost to returned"
            subtitle="Every report enters the same guided pipeline, so nothing gets stuck in a spreadsheet or a WhatsApp group."
          />
          <div className="steps-flow mt-8">
            {STEPS.map((s, i) => (
              <div className="flow-step" key={s.title}>
                <span className="flow-icon">
                  <Icon name={s.icon} size={26} strokeWidth={1.5} />
                  <span className="flow-num">{i + 1}</span>
                </span>
                <h4>{s.title}</h4>
                <p className="small" style={{ maxWidth: '30ch' }}>
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================ MATCHING ENGINE */}
      <section className="section-tight">
        <div className="container">
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'var(--s-8)' }}>
            <div>
              <div className="eyebrow mb-3">The matching engine</div>
              <h2>
                It doesn't just look for the <span className="gradient-text">same words</span>
              </h2>
              <p className="mt-4">
                Two people describe the same wallet completely differently. TraceBack scores five
                independent signals — including a perceptual hash of the photo — and combines them
                into a single confidence value. Anything above the threshold becomes a
                <strong> Possible Match</strong> and both sides get notified instantly.
              </p>
              <div className="col gap-3 mt-6">
                {FACTORS.map((f) => {
                  const w =
                    weights?.[
                      f.label.startsWith('Item')
                        ? 'category'
                        : f.label.startsWith('Description')
                          ? 'description'
                          : f.label.startsWith('Location')
                            ? 'location'
                            : f.label.startsWith('Date')
                              ? 'date'
                              : 'image'
                    ] ?? f.weight;
                  return (
                    <div className="factor" key={f.label}>
                      <span className="row gap-2 soft">
                        <Icon name={f.icon} size={14} /> {f.label}
                      </span>
                      <span className="mono strong" style={{ color: 'var(--violet-200)' }}>
                        {w}%
                      </span>
                      <div className="factor-bar">
                        <span style={{ width: `${w * 3.4}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {meta?.matching?.image_similarity_enabled && (
                <p className="tiny faint mt-4">
                  Image similarity is computed from a 64-bit perceptual difference hash (dHash) —
                  robust to resizing, compression and lighting changes.
                </p>
              )}
            </div>

            <Card glow className="card-pad">
              <div className="row-between">
                <div>
                  <div className="eyebrow">Live example</div>
                  <h4 className="mt-2">Black wallet · Central Canteen</h4>
                </div>
                <StatusBadge status="possible_match" />
              </div>
              <div className="row gap-6 mt-6 row-wrap center">
                <MatchRing score={88} size={150} caption="Match" pulse />
                <div className="col gap-3 grow" style={{ minWidth: 190 }}>
                  {[
                    ['Category & item name', 81],
                    ['Description similarity', 75],
                    ['Location proximity', 100],
                    ['Date & time proximity', 100],
                    ['Image similarity', 94],
                  ].map(([label, v]) => (
                    <div className="factor" key={label}>
                      <span className="soft tiny">{label}</span>
                      <span className="mono tiny" style={{ color: 'var(--violet-200)' }}>
                        {v}%
                      </span>
                      <div className="factor-bar">
                        <span style={{ width: `${v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="divider mt-6" />
              <p className="small muted mt-4">
                “Black wallet + same canteen + same afternoon + similar description” — exactly the
                scenario from the problem statement, scored at <strong>88%</strong> by the live engine.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ======================================================= LIFECYCLE */}
      <section className="section-tight">
        <div className="container">
          <Card className="card-pad">
            <SectionTitle
              eyebrow="Item status lifecycle"
              title="Everyone can see exactly where a case stands"
              subtitle="The same stepper appears on the item page, the match card and the claim wizard — no more “did anyone hand it in?” messages."
            />
            <div className="mt-8">
              <LifecycleStepper status="verification" />
            </div>
          </Card>
        </div>
      </section>

      {/* ======================================================== SHOWCASE */}
      {showcase.length > 0 && (
        <section className="section-tight">
          <div className="container">
            <SectionTitle
              eyebrow="Live from the network"
              title="Recently reported"
              action={
                <Button to="/browse" variant="ghost" size="sm" iconRight="arrowRight">
                  Browse all items
                </Button>
              }
            />
            <div className="grid grid-auto">
              {showcase.map((it) => (
                <Link key={it.id} to={`/items/${it.id}`}>
                  <Card hover className="item-card">
                    <div className="item-media">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.title} loading="lazy" />
                      ) : (
                        <div className="center" style={{ height: '100%', color: 'var(--text-faint)' }}>
                          <Icon name="box" size={30} />
                        </div>
                      )}
                      <div className="item-media-top">
                        <span className={`badge badge-${it.type}`}>{it.type}</span>
                        <StatusBadge status={it.status} />
                      </div>
                    </div>
                    <div className="item-body">
                      <h4 style={{ fontSize: 'var(--fs-md)' }} className="clamp-2">
                        {it.title}
                      </h4>
                      <div className="item-meta">
                        <span>
                          <Icon name="tag" size={12} /> {it.category}
                        </span>
                        <span>
                          <Icon name="pin" size={12} /> {it.location || 'Unknown'}
                        </span>
                        <span>
                          <Icon name="calendar" size={12} /> {formatDate(it.item_date)}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================= CTA */}
      <section className="section-tight">
        <div className="container">
          <Card glow className="card-pad center" style={{ textAlign: 'center', padding: 'var(--s-12)' }}>
            <div className="eyebrow">Lost something today?</div>
            <h2 className="mt-3" style={{ maxWidth: '22ch' }}>
              Give it <span className="gradient-text">one minute</span> — we'll keep looking for you.
            </h2>
            <p className="mt-4" style={{ maxWidth: '58ch' }}>
              Reports stay active until the item is returned or you close them. Every new found report
              is automatically compared against yours.
            </p>
            <div className="row gap-3 row-wrap mt-6 center">
              <Button to={user ? '/app/report/lost' : '/register'} size="lg" iconRight="arrowRight">
                {user ? 'Report a lost item' : 'Create free account'}
              </Button>
              <Button to="/browse" variant="ghost" size="lg" icon="search">
                Search found items
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
