/**
 * Stroke icons for the landing page, drawn with currentColor so they inherit the
 * violet accent and glow from their container.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Svg = ({ size = 24, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...stroke} {...rest}>
    {children}
  </svg>
);

/* --- stat bar ------------------------------------------------------------- */

export const RecoveredIcon = (props) => (
  <Svg {...props}>
    <path d="M3.6 7.5 12 3l8.4 4.5v9L12 21l-8.4-4.5z" />
    <path d="M3.6 7.5 12 12l8.4-4.5M12 12v9" />
  </Svg>
);

export const TargetIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.4" />
    <circle cx="12" cy="12" r="4.4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Svg>
);

export const YearsIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.4V12l3.4 2.1" />
  </Svg>
);

export const UsersIcon = (props) => (
  <Svg {...props}>
    <circle cx="9.2" cy="8.6" r="3.4" />
    <path d="M3.4 19.4c0-3.1 2.6-5.2 5.8-5.2s5.8 2.1 5.8 5.2" />
    <path d="M16.4 6.2a3.2 3.2 0 0 1 0 6.1M18.2 19.4c0-2 -.6-3.6-1.7-4.7 2.6.2 4.3 2 4.3 4.7" />
  </Svg>
);

/* --- services ------------------------------------------------------------ */

export const SmartSearchIcon = (props) => (
  <Svg {...props}>
    <circle cx="10.6" cy="10.6" r="6.4" />
    <path d="M15.4 15.4 21 21" />
    <path d="M10.6 7.6l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" />
  </Svg>
);

export const AlertIcon = (props) => (
  <Svg {...props}>
    <path d="M18 9.6a6 6 0 1 0-12 0c0 5-2.2 6.6-2.2 6.6h16.4S18 14.6 18 9.6" />
    <path d="M10.2 19.6a2 2 0 0 0 3.6 0" />
  </Svg>
);

export const VerifiedIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3.2l7 2.6v5.6c0 4.3-2.9 7.6-7 9.4-4.1-1.8-7-5.1-7-9.4V5.8z" />
    <path d="M8.9 11.9l2.2 2.2 4-4.2" />
  </Svg>
);

export const MapIcon = (props) => (
  <Svg {...props}>
    <path d="M12 21s6.4-5.4 6.4-10.4A6.4 6.4 0 0 0 5.6 10.6C5.6 15.6 12 21 12 21z" />
    <circle cx="12" cy="10.4" r="2.4" />
  </Svg>
);

export const SupportIcon = (props) => (
  <Svg {...props}>
    <path d="M4 13.4v-1.6a8 8 0 0 1 16 0v1.6" />
    <path d="M4 13.4h2.4v5H5.2A1.2 1.2 0 0 1 4 17.2zM20 13.4h-2.4v5h1.2a1.2 1.2 0 0 0 1.2-1.2z" />
    <path d="M17.6 18.4v.8a2.4 2.4 0 0 1-2.4 2.4H12" />
  </Svg>
);

/* --- contact & misc ------------------------------------------------------ */

export const MailIcon = (props) => (
  <Svg size={17} {...props}>
    <rect x="2.6" y="4.8" width="18.8" height="14.4" rx="2.4" />
    <path d="m3.4 6.6 8.6 6 8.6-6" />
  </Svg>
);

export const PhoneIcon = (props) => (
  <Svg size={17} {...props}>
    <path d="M7 3.4h3l1.6 4-2 1.4a10.4 10.4 0 0 0 5.6 5.6l1.4-2 4 1.6v3a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 5 5.6 2 2 0 0 1 7 3.4z" />
  </Svg>
);

export const PinIcon = (props) => (
  <Svg size={17} {...props}>
    <path d="M12 21s6-5 6-9.8A6 6 0 0 0 6 11.2C6 16 12 21 12 21z" />
    <circle cx="12" cy="11" r="2.2" />
  </Svg>
);

export const ArrowRight = ({ size = 16, ...rest }) => (
  <Svg size={size} className="c-btn-arrow" {...rest}>
    <path d="M4.5 12h14M13 6.4l5.6 5.6L13 17.6" />
  </Svg>
);

export const PlayIcon = ({ size = 11, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" {...rest}>
    <path d="M3 2.2 10 6l-7 3.8z" fill="#fff" />
  </svg>
);

export const CompassIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="m15 9-2 4.2-4.2 2 2-4.2z" fill="currentColor" fillOpacity="0.25" />
  </Svg>
);

/* --- socials (simple outline marks) -------------------------------------- */

export const FacebookIcon = (props) => (
  <Svg size={17} {...props}>
    <path d="M14.6 8.4h-1.8c-.9 0-1.4.5-1.4 1.4v1.6h3l-.5 3h-2.5v6.2H8.4V14.4H6.2v-3h2.2V9.4C8.4 6.9 9.9 5.4 12.4 5.4h2.2z" />
  </Svg>
);

export const InstagramIcon = (props) => (
  <Svg size={17} {...props}>
    <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="16.6" cy="7.4" r="1" fill="currentColor" />
  </Svg>
);

export const LinkedinIcon = (props) => (
  <Svg size={17} {...props}>
    <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3.2" />
    <path d="M7.6 10.4v6.2M7.6 7.6v.1M11.4 16.6v-6.2M11.4 13.2c0-1.6.9-2.6 2.4-2.6s2.6 1 2.6 2.8v3.2" />
  </Svg>
);

export const XIcon = (props) => (
  <Svg size={17} {...props}>
    <path d="M5 5l14 14M19 5 5 19" />
  </Svg>
);

export default {
  RecoveredIcon,
  TargetIcon,
  YearsIcon,
  UsersIcon,
  SmartSearchIcon,
  AlertIcon,
  VerifiedIcon,
  MapIcon,
  SupportIcon,
};
