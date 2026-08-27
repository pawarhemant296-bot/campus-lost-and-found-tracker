/**
 * Small decorative charts for the impact cards: a rising sparkline, a bar
 * series, and a progress ring. Pure SVG, no charting library.
 */

const GRADIENT_ID = 'cChartFill';

/** Rising line with a soft area fill. */
export function Sparkline({ points = [8, 22, 16, 34, 30, 52, 46, 72, 88], height = 66 }) {
  const width = 210;
  const max = Math.max(...points) || 1;
  const step = width / (points.length - 1);
  const coords = points.map((value, index) => [index * step, height - (value / max) * (height - 8) - 4]);
  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} aria-hidden="true">
      <defs>
        <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${GRADIENT_ID})`} />
      <path d={line} fill="none" stroke="#a78bfa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.slice(-1).map(([x, y]) => (
        <circle key="tip" cx={x} cy={y} r="3.6" fill="#ede9fe" />
      ))}
    </svg>
  );
}

/** Bar series, rising left to right. */
export function Bars({ values = [26, 38, 32, 52, 60, 74, 92], height = 66 }) {
  const width = 210;
  const max = Math.max(...values) || 1;
  const gap = 7;
  const barWidth = (width - gap * (values.length - 1)) / values.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} aria-hidden="true">
      <defs>
        <linearGradient id="cBarFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {values.map((value, index) => {
        const barHeight = (value / max) * (height - 6);
        return (
          <rect
            key={index}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={Math.min(barWidth / 2, 5)}
            fill="url(#cBarFill)"
            opacity={0.55 + (index / values.length) * 0.45}
          />
        );
      })}
    </svg>
  );
}

/** Progress ring, used for percentage-style figures. */
export function Ring({ percent = 75, size = 66, label }) {
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(Math.max(percent, 0), 100) / 100) * circumference;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="cRingFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#cRingFill)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {label && (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ede9fe"
          fontSize={size * 0.24}
          fontWeight="700"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

export default { Sparkline, Bars, Ring };
