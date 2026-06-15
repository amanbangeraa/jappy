import { type FC } from 'react';

type IconName =
  | 'home'
  | 'book-open'
  | 'check-circle'
  | 'trophy'
  | 'flame'
  | 'x'
  | 'check'
  | 'arrow-left'
  | 'arrow-right'
  | 'upload'
  | 'play'
  | 'chevron-left'
  | 'star'
  | 'clock'
  | 'lightning';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

const paths: Record<IconName, JSX.Element> = {
  'home': (
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
  ),
  'book-open': (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  'trophy': (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 0 0 5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 1 0 5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </>
  ),
  'flame': (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),
  'x': (
    <path d="M18 6 6 18M6 6l12 12" />
  ),
  'check': (
    <path d="M20 6 9 17l-5-5" />
  ),
  'arrow-left': (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="m12 5 7 7-7 7" />
      <path d="M5 12h14" />
    </>
  ),
  'upload': (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  'play': (
    <polygon points="6 3 20 12 6 21 6 3" />
  ),
  'chevron-left': (
    <path d="m15 18-6-6 6-6" />
  ),
  'star': (
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  'clock': (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  'lightning': (
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  ),
};

const Icon: FC<IconProps> = ({ name, size = 20, color = 'currentColor', strokeWidth = 2, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', flexShrink: 0, ...style }}
  >
    {paths[name]}
  </svg>
);

export default Icon;
