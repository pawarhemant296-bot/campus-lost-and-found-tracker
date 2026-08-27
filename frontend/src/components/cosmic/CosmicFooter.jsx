import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext.jsx';
import { CosmicLogo } from './CosmicNav.jsx';
import {
  ArrowRight,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  XIcon,
} from './CosmicIcons.jsx';

const QUICK_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '#about' },
  { label: 'Services', to: '#services' },
  { label: 'Reports', to: '/search' },
  { label: 'Blog', to: '#stories' },
  { label: 'Contact', to: '#contact' },
];

const SERVICE_LINKS = [
  { label: 'Report Item', to: '/report/lost' },
  { label: 'Browse Listings', to: '/search' },
  { label: 'Verification', to: '/claims' },
  { label: 'Community Alerts', to: '/dashboard' },
  { label: 'Support', to: '#contact' },
];

const SOCIALS = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'Instagram', Icon: InstagramIcon },
  { label: 'LinkedIn', Icon: LinkedinIcon },
  { label: 'X', Icon: XIcon },
];

export default function CosmicFooter() {
  const toast = useToast();
  const [email, setEmail] = useState('');

  /**
   * There is no mailing-list backend yet, so this validates and acknowledges
   * locally. Point it at a real endpoint (or a provider like Buttondown) when
   * one exists.
   */
  const subscribe = (event) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    toast.success('Thanks! You are on the list.');
    setEmail('');
  };

  const renderLink = ({ label, to }) =>
    to.startsWith('#') ? (
      <li key={label}>
        <a href={to}>{label}</a>
      </li>
    ) : (
      <li key={label}>
        <Link to={to}>{label}</Link>
      </li>
    );

  return (
    <footer className="c-footer" id="contact">
      <div className="c-container">
        <div className="c-footer-grid">
          <div>
            <CosmicLogo compact />
            <p className="c-lead" style={{ marginTop: 18, fontSize: '0.9rem', maxWidth: '34ch' }}>
              A guardian network for lost belongings. We match reports, verify owners and get things home.
            </p>
            <div className="c-socials">
              {SOCIALS.map(({ label, Icon }) => (
                <a key={label} className="c-social" href="#contact" aria-label={label}>
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4>Quick Links</h4>
            <ul className="c-footer-links">{QUICK_LINKS.map(renderLink)}</ul>
          </div>

          <div>
            <h4>Services</h4>
            <ul className="c-footer-links">{SERVICE_LINKS.map(renderLink)}</ul>
          </div>

          <div>
            <h4>Contact Us</h4>
            <ul className="c-footer-contact">
              <li>
                <MailIcon />
                <a href="mailto:hello@findit.network">hello@findit.network</a>
              </li>
              <li>
                <PhoneIcon />
                <span>+91 90000 00001</span>
              </li>
              <li>
                <PinIcon />
                <span>
                  Campus Help Desk,
                  <br />
                  Block B, Ground Floor
                </span>
              </li>
            </ul>
          </div>

          <div className="c-newsletter">
            <h4 style={{ marginBottom: 6 }}>Stay Updated</h4>
            <p style={{ fontSize: '0.86rem', color: 'var(--c-text-faint)' }}>
              Recovery tips and new features, once a month.
            </p>
            <form onSubmit={subscribe}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                aria-label="Email address"
              />
              <button type="submit" aria-label="Subscribe">
                <ArrowRight size={15} />
              </button>
            </form>
          </div>
        </div>

        <div className="c-footer-bottom">© 2026 FindIt Lost &amp; Found Network. All Rights Reserved.</div>
      </div>
    </footer>
  );
}
