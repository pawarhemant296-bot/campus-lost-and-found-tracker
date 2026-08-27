/* A single stroked-SVG icon set so the whole UI stays visually consistent
   without pulling in an icon dependency. 24x24 grid, currentColor stroke. */

const P = {
  home: 'M3 10.5 12 3l9 7.5V21H3z M9 21v-7h6v7',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16.5 16.5 21 21',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4z M12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bell: 'M18 15V10a6 6 0 1 0-12 0v5l-2 3h16zM10 21h4',
  message: 'M21 11.5A7.5 7.5 0 0 1 13.5 19H8l-4 3v-5.5A7.5 7.5 0 0 1 11.5 4h2A7.5 7.5 0 0 1 21 11.5z',
  send: 'M4 12 21 4l-7 17-2.5-7z M11.5 14 21 4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6 8-6s8 2 8 6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2 21c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5 M16.5 11.5a3 3 0 1 0 0-6 M18 15.4c2.4.6 4 2.3 4 5.6',
  logout: 'M15 17l5-5-5-5 M20 12H9 M12 4H5v16h7',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01',
  check: 'M4 12.5 9.5 18 20 6.5',
  x: 'M6 6l12 12 M18 6 6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7.5V12l3.2 2',
  calendar: 'M4 6h16v15H4z M4 10h16 M8.5 3v4 M15.5 3v4',
  pin: 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  shield: 'M12 3l8 3v6c0 5-3.5 8.2-8 9-4.5-.8-8-4-8-9V6z M8.8 12.2 11.3 15l4-5',
  chart: 'M4 20V4 M4 20h16 M8 17v-5 M12.5 17V8 M17 17v-8',
  pie: 'M12 3a9 9 0 1 0 9 9h-9z M12 3v9h9A9 9 0 0 0 12 3z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.2 1.1z',
  sliders: 'M4 7h10 M18 7h2 M4 12h4 M12 12h8 M4 17h9 M17 17h3 M14 4.5v5 M8 9.5v5 M13 14.5v5',
  alert: 'M12 4 2.5 20h19z M12 10v4.5 M12 17.5h.01',
  flag: 'M5 21V4h9l-1 3h6l-1.5 5 1.5 5h-9l-1-3H5z',
  scale: 'M12 4v16 M7 20h10 M12 7 5 9l3 5 3-5z M12 7l7 2-3 5-3-5z',
  arrowRight: 'M5 12h13 M13 6l6 6-6 6',
  arrowLeft: 'M19 12H6 M11 6l-6 6 6 6',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  trash: 'M4 7h16 M9.5 7V4h5v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6',
  edit: 'M4 20h4L20 8l-4-4L4 16z M14.5 5.5 18.5 9.5',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  radar: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16.5a4.5 4.5 0 1 0 0-9 M12 12l6.4-6.4',
  link: 'M9.5 14.5 14.5 9.5 M8 12H6.5a4 4 0 0 1 0-8H10 M16 12h1.5a4 4 0 0 1 0 8H14',
  tag: 'M20 12.5 12.5 20 4 11.5V4h7.5z M8 8h.01',
  star: 'M12 3.5 14.6 9l6 .9-4.3 4.3 1 6-5.3-2.9L6.7 20l1-6L3.4 9.9 9.4 9z',
  box: 'M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5z M3.5 7.5 12 12l8.5-4.5 M12 12v9',
  refresh: 'M20 12a8 8 0 1 1-2.4-5.7 M20 4v5h-5',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  lock: 'M6 11h12v9H6z M9 11V8a3 3 0 0 1 6 0v3 M12 15v2',
  mail: 'M3 6h18v12H3z M3 7l9 6 9-6',
  phone: 'M6 3h4l1.5 5-2.5 2a11 11 0 0 0 5 5l2-2.5 5 1.5v4a1 1 0 0 1-1 1A17 17 0 0 1 5 4a1 1 0 0 1 1-1z',
  building: 'M4 21V6l8-3 8 3v15 M9 21v-5h6v5 M8 10h.01 M12 10h.01 M16 10h.01',
  sparkle: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  handshake: 'M3 12l4-4 3 3 2-2 2 2 3-3 4 4-4 4-3-3-2 2-2-2-3 3z',
  download: 'M12 4v12 M7 11l5 5 5-5 M4 20h16',
  key: 'M15.5 10.5a4 4 0 1 0-4-4 4 4 0 0 0 4 4z M12.6 9.4 4 18v2h3v-2h2v-2h2l1.6-1.6',
  play: 'M8 5.5v13l11-6.5z',
  logo: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
};

export default function Icon({ name, size = 18, strokeWidth = 1.7, className = '', style }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {d.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : `M${seg}`} />
      ))}
    </svg>
  );
}

export const iconNames = Object.keys(P);
