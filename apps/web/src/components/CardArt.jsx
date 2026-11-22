import { useId } from 'react';
import {
  Gift, Wallet, Receipt, Smartphone, Wifi, Lightbulb, Bitcoin, CreditCard, Trophy, Users
} from 'lucide-react';
import './cards.css';

/* Original card artwork. Palettes only evoke each brand; these are not official logos. */
export const PALETTE = {
  amazon: { a: '#1b2432', b: '#33415a', c: '#ff9900' },
  apple: { a: '#161618', b: '#3b3b42', c: '#dcdce2' },
  steam: { a: '#13202e', b: '#2a475e', c: '#66c0f4' },
  'google-play': { a: '#0b3d2e', b: '#1b6b4f', c: '#7be0a8' },
  'razer-gold': { a: '#0b0f0b', b: '#1a2a14', c: '#44d62c' },
  xbox: { a: '#0b2d0b', b: '#14591a', c: '#7ddc63' },
  playstation: { a: '#0a2560', b: '#14479a', c: '#6fb4ff' },
  sephora: { a: '#0a0a0a', b: '#262626', c: '#ffffff' }
};
const DEFAULT = { a: '#1d1915', b: '#3a2f1c', c: '#e8b960' };

export function CardArt({ slug, name, label = 'GIFT CARD', className = '' }) {
  const p = PALETTE[slug] || DEFAULT;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const title = String(name || slug || 'Card').replace(/\s*\/.*$/, '');
  return (
    <svg className={`ca ${className}`} viewBox="0 0 320 200" role="img" aria-label={`${title} gift card`}>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.a} /><stop offset="1" stopColor={p.b} />
        </linearGradient>
        <radialGradient id={`r${uid}`} cx=".88" cy=".08" r=".75">
          <stop offset="0" stopColor={p.c} stopOpacity=".5" /><stop offset="1" stopColor={p.c} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`c${uid}`}><rect width="320" height="200" rx="20" /></clipPath>
      </defs>
      <g clipPath={`url(#c${uid})`}>
        <rect width="320" height="200" fill={`url(#g${uid})`} />
        <rect width="320" height="200" fill={`url(#r${uid})`} />
        <g fill="none" stroke={p.c} strokeOpacity=".2">
          <circle cx="270" cy="170" r="60" /><circle cx="270" cy="170" r="92" /><circle cx="270" cy="170" r="124" />
        </g>
        <path d="M0 0H190L110 200H0Z" fill="#fff" opacity=".04" />
      </g>
      <rect x=".5" y=".5" width="319" height="199" rx="20" fill="none" stroke={p.c} strokeOpacity=".5" />
      <circle cx="46" cy="48" r="20" fill={p.c} />
      <text x="46" y="56" textAnchor="middle" fontSize="23" fontWeight="700" fill={p.a} fontFamily="Fraunces,Georgia,serif">{title[0]}</text>
      <text x="78" y="55" fontSize="21" fontWeight="700" fill="#fff" fontFamily="Fraunces,Georgia,serif">{title}</text>
      <text x="24" y="176" fontSize="10" letterSpacing="3" fill={p.c} fontFamily="Manrope,sans-serif" fontWeight="700">{label}</text>
      <text x="296" y="176" textAnchor="end" fontSize="10" letterSpacing="3" fill="#fff" fillOpacity=".7" fontFamily="Manrope,sans-serif" fontWeight="700">AUREX</text>
    </svg>
  );
}

export const SERVICES = [
  { key: 'trade', label: 'Gift cards', icon: Gift, live: true },
  { key: 'wallet', label: 'Wallet', icon: Wallet, live: true },
  { key: 'statements', label: 'Statements', icon: Receipt, live: true },
  { key: 'airtime', label: 'Airtime', icon: Smartphone },
  { key: 'data', label: 'Data', icon: Wifi },
  { key: 'bills', label: 'Bills', icon: Lightbulb },
  { key: 'crypto', label: 'Crypto', icon: Bitcoin },
  { key: 'virtual', label: 'Virtual cards', icon: CreditCard },
  { key: 'rewards', label: 'Rewards', icon: Trophy },
  { key: 'refer', label: 'Refer & earn', icon: Users }
];

export function ServiceGrid({ onOpen }) {
  return (
    <div className="svc-grid">
      {SERVICES.map(({ key, label, icon: Icon, live }) => (
        <button
          key={key}
          className={`svc ${live ? 'live' : 'soon'}`}
          disabled={!live || !onOpen}
          onClick={() => onOpen && onOpen(key)}
        >
          <span className="svc-ico"><Icon size={21} /></span>
          <b>{label}</b>
          <em>{live ? 'Live' : 'Soon'}</em>
        </button>
      ))}
    </div>
  );
}
