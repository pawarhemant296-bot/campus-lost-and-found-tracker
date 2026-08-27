import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { CLAIM_STEPS, STATUS_FLOW, STATUS_LABELS, avatarStyle, initials } from '../lib/format.js';

/* ============================================================== Button ==== */

export function Button({
  as,
  to,
  href,
  variant = 'primary',
  size,
  loading = false,
  icon,
  iconRight,
  block,
  className = '',
  children,
  ...rest
}) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    loading ? 'btn-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {icon && <Icon name={icon} size={16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={16} />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {inner}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {inner}
      </a>
    );
  }
  const Tag = as || 'button';
  return (
    <Tag className={cls} disabled={loading || rest.disabled} {...rest}>
      {inner}
    </Tag>
  );
}

/* =============================================================== Badge ==== */

export function StatusBadge({ status, className = '' }) {
  if (!status) return null;
  return (
    <span className={`badge badge-${status} ${className}`}>{STATUS_LABELS[status] || status}</span>
  );
}

export function TypeBadge({ type }) {
  return <span className={`badge badge-${type}`}>{type === 'lost' ? 'Lost' : 'Found'}</span>;
}

export function Badge({ tone = 'violet', children, plain }) {
  return <span className={`badge badge-${tone} ${plain ? 'badge-plain' : ''}`}>{children}</span>;
}

export function Tag({ icon, children }) {
  return (
    <span className="tag">
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

/* ================================================================ Card ==== */

export function Card({ hover, glow, pad, className = '', children, ...rest }) {
  return (
    <div
      className={[
        'card',
        hover ? 'card-hover' : '',
        glow ? 'card-glow' : '',
        pad === true ? 'card-pad' : pad === 'sm' ? 'card-pad-sm' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHead({ title, subtitle, action, icon }) {
  return (
    <div className="card-head">
      <div className="row gap-3" style={{ minWidth: 0 }}>
        {icon && (
          <span className="stat-icon" style={{ width: 36, height: 36 }}>
            <Icon name={icon} size={17} />
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h4 className="truncate">{title}</h4>
          {subtitle && <div className="tiny muted">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon, label, value, trend, hint, to }) {
  const body = (
    <Card hover={Boolean(to)} className="stat-card">
      <span className="stat-icon">
        <Icon name={icon} size={20} />
      </span>
      <div className="grow">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {(trend || hint) && (
          <div className="row gap-2 mt-2">
            {trend && (
              <span className={`stat-trend ${trend.dir}`}>
                {trend.dir === 'up' ? '+' : '-'}
                {trend.value}
              </span>
            )}
            {hint && <span className="tiny faint">{hint}</span>}
          </div>
        )}
      </div>
    </Card>
  );
  return to ? (
    <Link to={to} className="stat-link">
      {body}
    </Link>
  ) : (
    body
  );
}

/* =========================================================== MatchRing ==== */

export function MatchRing({ score = 0, size = 116, stroke = 9, caption = 'Match', pulse }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gradId = `ringGrad`;

  return (
    <div className={`ring ${pulse ? 'pulse' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="55%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
        />
      </svg>
      <div className="ring-label">
        <span className="ring-value" style={{ fontSize: size * 0.26 }}>
          {Math.round(value)}%
        </span>
        {caption && <span className="ring-caption" style={{ fontSize: Math.max(9, size * 0.082) }}>{caption}</span>}
      </div>
    </div>
  );
}

/* ========================================================= FactorBars ==== */

export function FactorBars({ factors = [] }) {
  return (
    <div className="col gap-3">
      {factors.map((f) => (
        <div className="factor" key={f.key}>
          <span className={f.available ? 'soft' : 'faint'}>
            {f.label}
            {!f.available && <span className="tiny faint"> · no data</span>}
          </span>
          <span className="mono strong" style={{ color: f.available ? 'var(--violet-200)' : 'var(--text-faint)' }}>
            {f.available ? `${f.value}%` : '—'}
            <span className="tiny faint"> ·w{f.weight}</span>
          </span>
          <div className={`factor-bar ${f.available ? '' : 'dim'}`}>
            <span style={{ width: `${f.available ? f.value : 4}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================= Stepper ==== */

export function Stepper({ steps, currentIndex, compact }) {
  return (
    <div className={`stepper ${compact ? 'stepper-compact' : ''}`}>
      {steps.map((s, i) => (
        <div
          key={s.key || s}
          className={`stepper-step ${i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending'}`}
        >
          <span className="stepper-node">
            {i < currentIndex ? <Icon name="check" size={14} strokeWidth={2.4} /> : i + 1}
          </span>
          <span className="stepper-caption">{s.label || s}</span>
        </div>
      ))}
    </div>
  );
}

/** The item lifecycle stepper used across item, match and claim screens. */
export function LifecycleStepper({ status, compact }) {
  const idx = Math.max(0, STATUS_FLOW.indexOf(status));
  return (
    <Stepper
      steps={STATUS_FLOW.map((s) => ({ key: s, label: STATUS_LABELS[s] }))}
      currentIndex={idx}
      compact={compact}
    />
  );
}

export function ClaimStepper({ stage }) {
  const order = CLAIM_STEPS.map((s) => s.key);
  const idx = stage === 'rejected' ? 2 : Math.max(0, order.indexOf(stage));
  return <Stepper steps={CLAIM_STEPS} currentIndex={idx} />;
}

export function Timeline({ items }) {
  return (
    <div className="timeline">
      {items.map((it, i) => (
        <div key={i} className={`timeline-item ${it.state}`}>
          <span className="timeline-dot">
            {it.state === 'done' ? <Icon name="check" size={13} strokeWidth={2.6} /> : i + 1}
          </span>
          <div>
            <div className="timeline-title">{it.title}</div>
            {it.detail && <div className="tiny muted">{it.detail}</div>}
            {it.time && <div className="tiny faint">{it.time}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================== Avatar ==== */

export function Avatar({ name, hue = 265, size = 'md', title }) {
  return (
    <span
      className={`avatar ${size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : ''}`}
      style={avatarStyle(hue)}
      title={title || name}
    >
      {initials(name)}
    </span>
  );
}

/* ======================================================== Form helpers ==== */

export function Field({ label, required, hint, error, children, htmlFor }) {
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label} {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="error-text">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ icon, className = '', ...rest }) {
  if (!icon) return <input className={`input ${className}`} {...rest} />;
  return (
    <div className="input-group">
      <span className="input-icon">
        <Icon name={icon} size={16} />
      </span>
      <input className={`input ${className}`} {...rest} />
    </div>
  );
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={`textarea ${className}`} {...rest} />;
}

export function Select({ options = [], placeholder, className = '', ...rest }) {
  return (
    <select className={`select ${className}`} {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        )
      )}
    </select>
  );
}

export function Switch({ checked, onChange, label, hint }) {
  return (
    <button type="button" className="row gap-3" onClick={() => onChange(!checked)} style={{ textAlign: 'left' }}>
      <span className={`switch ${checked ? 'on' : ''}`} />
      <span>
        <span className="small strong">{label}</span>
        {hint && <span className="tiny muted" style={{ display: 'block' }}>{hint}</span>}
      </span>
    </button>
  );
}

export function ToggleGroup({ value, onChange, options }) {
  return (
    <div className="toggle-group" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`toggle-option ${value === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PillSelect({ value, onChange, options, placeholder, ariaLabel }) {
  return (
    <span className={`pill-select ${value ? 'active' : ''}`}>
      <select aria-label={ariaLabel || placeholder} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )
        )}
      </select>
    </span>
  );
}

/* ============================================================== States ==== */

export function Empty({ title, message, action, icon = 'search' }) {
  return (
    <div className="empty">
      <div className="empty-orb">
        <Icon name={icon} size={38} strokeWidth={1.4} />
      </div>
      <div>
        <h3 style={{ fontSize: 'var(--fs-lg)' }}>{title}</h3>
        {message && <p className="muted small mt-2" style={{ maxWidth: '46ch' }}>{message}</p>}
      </div>
      {action}
    </div>
  );
}

export function Alert({ tone = 'info', icon, children }) {
  const cls = tone === 'info' ? 'alert' : `alert alert-${tone}`;
  return (
    <div className={cls}>
      <Icon
        name={icon || (tone === 'error' ? 'alert' : tone === 'success' ? 'check' : tone === 'warn' ? 'alert' : 'sparkle')}
        size={17}
        style={{ flex: '0 0 auto', marginTop: 2 }}
      />
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

export function LoadingBlock({ rows = 3 }) {
  return (
    <div className="col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} h={i === 0 ? 22 : 14} w={i === 0 ? '45%' : `${88 - i * 9}%`} />
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal" onClick={onClose}>
      <Card
        glow
        className="modal-card"
        style={wide ? { width: 'min(760px, 100%)' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head">
          <h4>{title}</h4>
          <button className="btn btn-icon btn-subtle" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="card-body">{children}</div>
        {footer && <div className="card-head" style={{ borderTop: '1px solid var(--border-soft)', borderBottom: 0 }}>{footer}</div>}
      </Card>
    </div>
  );
}

/* =============================================================== Toasts ==== */

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(
    () => ({
      toast: push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <Icon
              name={t.tone === 'success' ? 'check' : t.tone === 'error' ? 'alert' : 'sparkle'}
              size={16}
              style={{
                color:
                  t.tone === 'success'
                    ? 'var(--green)'
                    : t.tone === 'error'
                      ? 'var(--red)'
                      : 'var(--violet-300)',
              }}
            />
            <span className="grow">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx) || { toast: () => {}, success: () => {}, error: () => {} };
}

/* ========================================================= Misc atoms ==== */

export function SectionTitle({ eyebrow, title, subtitle, center, action }) {
  return (
    <div className={`row-between mb-6 ${center ? 'col' : ''}`} style={center ? { textAlign: 'center' } : undefined}>
      <div style={center ? { margin: '0 auto', maxWidth: '62ch' } : { maxWidth: '62ch' }}>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h2>{title}</h2>
        {subtitle && <p className="mt-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ItemThumb({ item, size = 44 }) {
  const cls = size > 50 ? 'thumb thumb-lg' : 'thumb';
  if (!item?.image_url) {
    return (
      <span className={cls} style={{ display: 'grid', placeItems: 'center', color: 'var(--text-faint)' }}>
        <Icon name="box" size={18} />
      </span>
    );
  }
  return <img className={cls} src={item.image_url} alt={item.title} loading="lazy" />;
}
