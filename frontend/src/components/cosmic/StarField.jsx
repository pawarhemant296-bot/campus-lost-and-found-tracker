import { useMemo } from 'react';

/**
 * Star and particle texture.
 *
 * Positions come from a seeded generator rather than Math.random, so the layout
 * is stable across re-renders (and between server/client if this is ever
 * pre-rendered) instead of shuffling on every paint.
 */
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    return value / 0x7fffffff;
  };
}

export default function StarField({ count = 90, seed = 7, className = '' }) {
  const stars = useMemo(() => {
    const random = seeded(seed);
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      x: random() * 100,
      y: random() * 100,
      r: 0.4 + random() * 1.5,
      opacity: 0.2 + random() * 0.7,
      delay: random() * 4,
    }));
  }, [count, seed]);

  return (
    <svg className={`c-stars ${className}`} aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
      {stars.map((star) => (
        <circle
          key={star.id}
          className="c-star"
          cx={star.x}
          cy={star.y}
          r={star.r / 10}
          fill={star.id % 7 === 0 ? '#c4b5fd' : '#ffffff'}
          opacity={star.opacity}
          style={{ animationDelay: `${star.delay}s` }}
        />
      ))}
    </svg>
  );
}
