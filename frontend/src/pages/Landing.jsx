import { Link } from 'react-router-dom';
import CosmicFooter from '../components/cosmic/CosmicFooter.jsx';
import CosmicNav from '../components/cosmic/CosmicNav.jsx';
import GuardianOrb from '../components/cosmic/GuardianOrb.jsx';
import PortalScene from '../components/cosmic/PortalScene.jsx';
import StarField from '../components/cosmic/StarField.jsx';
import StoryArt from '../components/cosmic/StoryArt.jsx';
import { Bars, Ring, Sparkline } from '../components/cosmic/MiniChart.jsx';
import {
  AlertIcon,
  ArrowRight,
  MapIcon,
  PlayIcon,
  RecoveredIcon,
  SmartSearchIcon,
  SupportIcon,
  TargetIcon,
  UsersIcon,
  VerifiedIcon,
  YearsIcon,
} from '../components/cosmic/CosmicIcons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useApi from '../hooks/useApi.js';
import '../styles/cosmic.css';

/**
 * FindIt — marketing landing page.
 *
 * Rendered outside the application shell (see App.jsx) so it can own its own
 * navigation, footer and near-black cosmic palette without fighting the
 * product UI or the light/dark theme switch.
 */

/**
 * Headline figures.
 *
 * `Items Recovered` and `Match Success Rate` are replaced with live values from
 * /api/items/stats as soon as the API answers; the numbers below are the
 * fallback used before that resolves (and on a brand new install). The other two
 * have no data source yet and are placeholders from the design brief — wire them
 * up or edit them here.
 */
const FALLBACK_STATS = {
  recovered: '10,000+',
  successRate: '95%',
  years: '5+',
  users: '50K+',
};

const SERVICES = [
  {
    Icon: SmartSearchIcon,
    title: 'Smart Item Search',
    copy: 'AI matches lost and found listings automatically, scoring every pair on description, place and time.',
  },
  {
    Icon: AlertIcon,
    title: 'Community Alerts',
    copy: 'Get notified the moment something similar is reported near you — no refreshing required.',
  },
  {
    Icon: VerifiedIcon,
    title: 'Verified Claims',
    copy: 'Secure identity and ownership verification before anything changes hands.',
  },
  {
    Icon: MapIcon,
    title: 'Location Mapping',
    copy: 'Pinpoint exactly where an item was lost or found, down to the building and hour.',
  },
  {
    Icon: SupportIcon,
    title: '24/7 Support',
    copy: 'Real people helping you recover your belongings whenever you need a hand.',
  },
];

const RESULTS = [
  { value: '320%', label: 'More Matches Since Launch', chart: <Sparkline /> },
  { value: '200%', label: 'Growth in Reports', chart: <Bars /> },
  { value: '150%', label: 'Faster Recovery Time', chart: <Ring percent={72} label="150%" /> },
  { value: '98%', label: 'User Satisfaction', chart: <Ring percent={98} label="98%" /> },
];

const STORIES = [
  { kind: 'pets', title: 'Pets Found', copy: '1,240 reunions', to: '/search?q=pet' },
  { kind: 'wallets', title: 'Lost Wallets & IDs', copy: '3,880 returned', to: '/search?category=Wallet+%2F+Purse' },
  { kind: 'electronics', title: 'Electronics Recovered', copy: '2,150 devices home', to: '/search?category=Mobile+Phone' },
  { kind: 'travel', title: 'Travel & Luggage', copy: '960 bags recovered', to: '/search?category=Bag+%2F+Backpack' },
];

const STEPS = [
  { step: '01', title: 'Report it', copy: 'Describe the item, where and when. Add a photo if you have one.' },
  { step: '02', title: 'We match it', copy: 'The engine scores every report on the other side and ranks the best.' },
  { step: '03', title: 'Verify ownership', copy: 'Answer a private detail only the true owner could know.' },
  { step: '04', title: 'Get reunited', copy: 'Chat securely, arrange a safe handover, case closed.' },
];

const CHECKLIST = [
  'AI-Powered Item Matching',
  'Verified Community Reports',
  'Real-Time Location Alerts',
  'Secure Owner Verification',
];

/** 12400 -> "12.4K+", 940 -> "940+" */
function formatCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}K+`;
  return `${number}+`;
}

export default function Landing() {
  const { user } = useAuth();
  const { data: stats } = useApi('/items/stats');

  const reportHref = user ? '/report/lost' : '/register';

  const statBar = [
    {
      Icon: RecoveredIcon,
      value: formatCount(stats?.returned) ?? FALLBACK_STATS.recovered,
      label: 'Items Recovered',
    },
    {
      Icon: TargetIcon,
      value: stats?.average_match_score ? `${Math.round(stats.average_match_score)}%` : FALLBACK_STATS.successRate,
      label: 'Match Success Rate',
    },
    { Icon: YearsIcon, value: FALLBACK_STATS.years, label: 'Years Helping Communities' },
    { Icon: UsersIcon, value: FALLBACK_STATS.users, label: 'Active Users' },
  ];

  return (
    <div className="cosmic">
      <StarField count={110} />
      <CosmicNav />

      {/* ---------------------------------------------------------------- hero */}
      <section className="c-hero">
        <div className="c-container c-hero-grid">
          <div>
            <h1>
              <span>Lost Something?</span>
              <span className="c-accent">We&apos;ll Find It</span>
            </h1>
            <p className="c-hero-tagline">Recover. Reconnect. Restore.</p>
            <p className="c-lead">
              FindIt is a guardian network for missing belongings. Our AI compares every lost report with every found
              report — description, location and timing — then connects the two people behind them and verifies
              ownership before anything changes hands.
            </p>
            <div className="c-hero-actions">
              <Link className="c-btn c-btn-primary" to={reportHref}>
                Report a Lost Item <ArrowRight />
              </Link>
              <a className="c-btn c-btn-ghost" href="#how-it-works">
                <span className="c-play">
                  <PlayIcon />
                </span>
                Watch How It Works
              </a>
            </div>
          </div>

          <div className="c-hero-visual c-float">
            <GuardianOrb />
          </div>
        </div>

        {/* stat bar */}
        <div className="c-container" style={{ marginTop: 26 }}>
          <div className="c-statbar">
            {statBar.map(({ Icon, value, label }) => (
              <div className="c-stat" key={label}>
                <span className="c-stat-icon">
                  <Icon />
                </span>
                <span>
                  <span className="c-stat-value">{value}</span>
                  <span className="c-stat-label" style={{ display: 'block' }}>
                    {label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- about */}
      <section className="c-section" id="about">
        <div className="c-container c-about-grid">
          <div className="c-portal-frame">
            <PortalScene />
          </div>
          <div>
            <span className="c-eyebrow">About Us</span>
            <h2 className="c-h2">
              We Reunite People
              <br />
              With What They <span className="c-accent">Love</span>
            </h2>
            <p className="c-lead" style={{ marginTop: 18 }}>
              Every day people lose things that matter far more than their price tag — a grandmother&apos;s ring, a
              wallet with an ID inside, a laptop holding a year of work. FindIt exists to close the gap between the
              person who lost it and the stranger who found it, quickly and safely.
            </p>
            <ul className="c-checklist">
              {CHECKLIST.map((item) => (
                <li key={item}>
                  <span className="c-dot">
                    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2.5 6.2l2.4 2.4L9.6 3.9" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <a className="c-btn c-btn-primary" href="#services">
              Learn More <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- how it works */}
      <section className="c-section-tight" id="how-it-works">
        <div className="c-container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span className="c-eyebrow">How It Works</span>
            <h2 className="c-h2">
              Four Steps From Lost To <span className="c-accent">Found</span>
            </h2>
          </div>
          <div className="c-services" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 0 }}>
            {STEPS.map(({ step, title, copy }) => (
              <article className="c-card c-service" key={step}>
                <span className="c-service-icon" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                  {step}
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ services */}
      <section className="c-section" id="services">
        <div className="c-container">
          <div style={{ textAlign: 'center' }}>
            <span className="c-eyebrow">Our Services</span>
            <h2 className="c-h2">
              Solutions That <span className="c-accent">Bring It Back</span>
            </h2>
          </div>
          <div className="c-services">
            {SERVICES.map(({ Icon, title, copy }) => (
              <article className="c-card c-service" key={title}>
                <span className="c-service-icon">
                  <Icon size={25} />
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- results */}
      <section className="c-section" id="results">
        <div className="c-container c-results-grid">
          <div>
            <span className="c-eyebrow">Our Impact</span>
            <h2 className="c-h2">
              Results That <span className="c-accent">Matter</span>
            </h2>
            <p className="c-lead" style={{ marginTop: 16 }}>
              We measure ourselves on one thing: how many people get their belongings back, and how fast. Here is what
              the network has achieved since launch.
            </p>
            <a className="c-btn c-btn-primary" style={{ marginTop: 26 }} href="#stories">
              See Success Stories <ArrowRight />
            </a>
          </div>

          <div className="c-result-cards">
            {RESULTS.map(({ value, label, chart }) => (
              <article className="c-card c-result" key={label}>
                <span className="c-result-value">{value}</span>
                <span className="c-result-label">{label}</span>
                <div className="c-result-chart">{chart}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- stories */}
      <section className="c-section" id="stories">
        <div className="c-container">
          <span className="c-eyebrow">Real Stories</span>
          <h2 className="c-h2">
            Real People. <span className="c-accent">Real Reunions.</span>
          </h2>
          <div className="c-stories">
            {STORIES.map(({ kind, title, copy, to }) => (
              <Link className="c-story" to={to} key={kind}>
                <StoryArt kind={kind} />
                <div className="c-story-body">
                  <strong>{title}</strong>
                  <span>{copy}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- cta banner */}
      <section className="c-section-tight">
        <div className="c-container">
          <div className="c-cta">
            <div>
              <h2>Ready to Find What You Lost?</h2>
              <p>Join thousands who&apos;ve already been reunited with their belongings.</p>
              <Link className="c-btn c-btn-primary" style={{ marginTop: 26 }} to={reportHref}>
                Get Started Free <ArrowRight />
              </Link>
            </div>
            <div className="c-cta-art">
              <PortalScene compact />
            </div>
          </div>
        </div>
      </section>

      <CosmicFooter />
    </div>
  );
}
