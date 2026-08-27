/* Hand-rolled SVG charts so the analytics screens stay on-theme (purple
   gradient fills, glow strokes, dark grid) with zero chart dependencies. */

const PALETTE = ['#a855f7', '#c084fc', '#8b5cf6', '#6d28d9', '#e9d5ff', '#7dd3fc', '#f472b6', '#fbbf24'];

/** Rounds the axis maximum up to a value divisible by 4 so every gridline
 *  label is a whole number (4 ticks + zero). */
function niceMax(v) {
  if (v <= 4) return 4;
  if (v <= 8) return 8;
  const mag = 10 ** Math.floor(Math.log10(v));
  const stepped = Math.ceil(v / mag) * mag;
  return Math.ceil(stepped / 4) * 4;
}

/* --------------------------------------------------------------- LineChart */

export function LineChart({
  data = [],
  series = [{ key: 'value', label: 'Value', color: '#a855f7' }],
  xKey = 'day',
  height = 220,
  formatX = (v) => String(v).slice(5),
  area = true,
}) {
  const W = 720;
  const H = height;
  const pad = { t: 14, r: 14, b: 26, l: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  if (!data.length) {
    return <div className="empty" style={{ padding: 'var(--s-8)' }}><span className="muted small">No data yet</span></div>;
  }

  const max = niceMax(
    Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)))
  );
  const x = (i) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => pad.t + ih - ((Number(v) || 0) / max) * ih;

  const ticks = 4;
  const step = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        <defs>
          {series.map((s, si) => (
            <linearGradient key={s.key} id={`lg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color || PALETTE[si]} stopOpacity="0.45" />
              <stop offset="100%" stopColor={s.color || PALETTE[si]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        <g className="chart-grid">
          {Array.from({ length: ticks + 1 }).map((_, i) => {
            const gy = pad.t + (ih / ticks) * i;
            return <line key={i} x1={pad.l} y1={gy} x2={W - pad.r} y2={gy} />;
          })}
        </g>
        {Array.from({ length: ticks + 1 }).map((_, i) => (
          <text key={i} className="chart-axis" x={4} y={pad.t + (ih / ticks) * i + 3}>
            {Math.round(max - (max / ticks) * i)}
          </text>
        ))}

        {series.map((s, si) => {
          const color = s.color || PALETTE[si];
          const pts = data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(' L');
          return (
            <g key={s.key}>
              {area && (
                <path
                  d={`M${pad.l},${pad.t + ih} L${pts} L${x(data.length - 1)},${pad.t + ih} Z`}
                  fill={`url(#lg-${s.key})`}
                />
              )}
              <path
                d={`M${pts}`}
                fill="none"
                stroke={color}
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 5px ${color}aa)` }}
              />
              {data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(d[s.key])} r="2.8" fill={color}>
                  <title>{`${formatX(d[xKey])} · ${s.label}: ${d[s.key] ?? 0}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {data.map((d, i) =>
          i % step === 0 || i === data.length - 1 ? (
            <text key={i} className="chart-axis" x={x(i)} y={H - 8} textAnchor="middle">
              {formatX(d[xKey])}
            </text>
          ) : null
        )}
      </svg>
      <div className="chart-legend mt-3">
        {series.map((s, si) => (
          <span key={s.key}>
            <i className="legend-swatch" style={{ background: s.color || PALETTE[si] }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- BarChart */

export function BarChart({ data = [], height = 220, horizontal = false, formatLabel = (v) => v }) {
  if (!data.length) {
    return <div className="empty" style={{ padding: 'var(--s-8)' }}><span className="muted small">No data yet</span></div>;
  }
  const max = niceMax(Math.max(1, ...data.map((d) => Number(d.value) || 0)));

  if (horizontal) {
    return (
      <div className="col gap-3">
        {data.map((d, i) => (
          <div className="factor" key={d.label}>
            <span className="soft truncate">{formatLabel(d.label)}</span>
            <span className="mono strong" style={{ color: 'var(--violet-200)' }}>{d.value}</span>
            <div className="factor-bar">
              <span
                style={{
                  width: `${((Number(d.value) || 0) / max) * 100}%`,
                  background: `linear-gradient(90deg, ${PALETTE[i % PALETTE.length]}, #c084fc)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Narrow the canvas for sparse data so a 2-bar chart still fills its card.
  const W = Math.max(300, Math.min(720, 90 * data.length + 80));
  const H = height;
  const pad = { t: 14, r: 12, b: 34, l: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const bw = Math.min(52, (iw / data.length) * 0.62);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ height }}>
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <g className="chart-grid">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={pad.l} y1={pad.t + (ih / 4) * i} x2={W - pad.r} y2={pad.t + (ih / 4) * i} />
        ))}
      </g>
      {[0, 1, 2, 3, 4].map((i) => (
        <text key={i} className="chart-axis" x={4} y={pad.t + (ih / 4) * i + 3}>
          {Math.round(max - (max / 4) * i)}
        </text>
      ))}
      {data.map((d, i) => {
        const h = ((Number(d.value) || 0) / max) * ih;
        const cx = pad.l + (iw / data.length) * (i + 0.5);
        return (
          <g key={d.label}>
            <rect
              x={cx - bw / 2}
              y={pad.t + ih - h}
              width={bw}
              height={Math.max(2, h)}
              rx="6"
              fill="url(#barGrad)"
              style={{ filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.45))' }}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text className="chart-axis" x={cx} y={H - 12} textAnchor="middle">
              {formatLabel(d.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------------------- DonutChart */

export function DonutChart({ data = [], size = 210, thickness = 26, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  if (!total) {
    return <div className="empty" style={{ padding: 'var(--s-6)' }}><span className="muted small">No data yet</span></div>;
  }

  return (
    <div className="row gap-6 row-wrap">
      <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} stroke="rgba(255,255,255,0.06)" />
          {data.map((d, i) => {
            const frac = (Number(d.value) || 0) / total;
            const dash = frac * c;
            const el = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={thickness}
                stroke={PALETTE[i % PALETTE.length]}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.45))' }}
              >
                <title>{`${d.label}: ${d.value} (${Math.round(frac * 100)}%)`}</title>
              </circle>
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
          }}
        >
          <div>
            <div className="stat-value">{centerValue ?? total}</div>
            <div className="stat-label">{centerLabel || 'Total'}</div>
          </div>
        </div>
      </div>
      <ul className="col gap-2 grow" style={{ minWidth: 180 }}>
        {data.slice(0, 8).map((d, i) => (
          <li key={d.label} className="row-between small">
            <span className="row gap-2 truncate">
              <i className="legend-swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="soft truncate">{d.label}</span>
            </span>
            <span className="mono muted">
              {d.value} · {Math.round(((Number(d.value) || 0) / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- Sparkline */

export function Sparkline({ values = [], width = 120, height = 38, color = '#c084fc' }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(' L');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <path
        d={`M${pts}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}cc)` }}
      />
    </svg>
  );
}

export { PALETTE };
