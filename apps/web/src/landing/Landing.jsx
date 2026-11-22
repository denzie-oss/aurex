import { useEffect, useRef, useState } from 'react';
import './landing.css';

/* Sample rates for preview only. Live rates are not connected yet
   (the API's /catalog/rates intentionally returns an empty list). */
const SAMPLE = [
  { slug: 'apple', name: 'Apple', perUsd: 1050 },
  { slug: 'amazon', name: 'Amazon', perUsd: 1000 },
  { slug: 'steam', name: 'Steam', perUsd: 980 },
  { slug: 'google-play', name: 'Google Play', perUsd: 960 },
  { slug: 'razer', name: 'Razer Gold', perUsd: 900 }
];
const PRESETS = [25, 50, 100, 200, 500];
const STEPS = ['Submitted', 'Reviewing', 'Approved', 'Paid'];
const naira = n => '₦' + Math.round(n).toLocaleString('en-NG');
const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch { /* ignore */ } };

function useCountUp(target, ms = 700) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduceMotion()) { setValue(target); from.current = target; return undefined; }
    const start = from.current;
    const t0 = performance.now();
    let raf;
    const tick = now => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = start + (target - start) * eased;
      from.current = cur;
      setValue(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function RateDial({ onStart }) {
  const [brand, setBrand] = useState(0);
  const [amount, setAmount] = useState(100);
  const [flipped, setFlipped] = useState(false);
  const wrap = useRef(null);
  const b = SAMPLE[brand];
  const payout = amount * b.perUsd;
  const shown = useCountUp(payout);

  const tilt = e => {
    if (reduceMotion() || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    wrap.current.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
    wrap.current.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
  };
  const untilt = () => {
    if (!wrap.current) return;
    wrap.current.style.setProperty('--rx', '0deg');
    wrap.current.style.setProperty('--ry', '0deg');
  };

  return (
    <section className="lp-dial" aria-label="Payout estimator">
      <div className="lp-chips" role="tablist">
        {SAMPLE.map((s, i) => (
          <button
            key={s.slug}
            role="tab"
            aria-selected={i === brand}
            className={i === brand ? 'on' : ''}
            onClick={() => { setBrand(i); buzz(); }}
          >{s.name}</button>
        ))}
      </div>

      <div className="lp-stage" ref={wrap} onPointerMove={tilt} onPointerLeave={untilt}>
        <div className={`lp-card ${flipped ? 'flip' : ''}`} onClick={() => { setFlipped(f => !f); buzz(); }}>
          <div className="lp-face lp-front">
            <span className="lp-sheen" />
            <div className="lp-card-top">
              <b>{b.name}</b><i>GIFT CARD</i>
            </div>
            <div className="lp-amt">${amount.toLocaleString()}</div>
            <div className="lp-card-foot">
              <span>You receive</span>
              <strong>{naira(shown)}</strong>
            </div>
          </div>
          <div className="lp-face lp-back">
            <h4>How we got there</h4>
            <dl>
              <div><dt>Card value</dt><dd>${amount.toLocaleString()}</dd></div>
              <div><dt>Sample rate</dt><dd>₦{b.perUsd.toLocaleString()} / $1</dd></div>
              <div><dt>Estimate</dt><dd>{naira(payout)}</dd></div>
            </dl>
            <p>Final payout is confirmed after the card is reviewed.</p>
          </div>
        </div>
      </div>

      <label className="lp-slider">
        <span>Card amount</span>
        <input
          type="range" min="10" max="1000" step="5" value={amount}
          onChange={e => setAmount(Number(e.target.value))}
        />
      </label>
      <div className="lp-presets">
        {PRESETS.map(p => (
          <button key={p} className={p === amount ? 'on' : ''} onClick={() => { setAmount(p); buzz(); }}>${p}</button>
        ))}
      </div>

      <p className="lp-note">Sample rates · preview only. Live rates are coming soon.</p>
      <button className="lp-btn gold wide" onClick={() => onStart('register')}>Trade this card</button>
    </section>
  );
}

function TradeTicket() {
  const [step, setStep] = useState(reduceMotion() ? STEPS.length - 1 : 0);
  useEffect(() => {
    if (reduceMotion()) return undefined;
    const id = setInterval(() => setStep(s => (s + 1) % (STEPS.length + 1)), 1500);
    return () => clearInterval(id);
  }, []);
  const active = Math.min(step, STEPS.length - 1);
  return (
    <div className="lp-ticket" aria-label="Example trade progress">
      <div className="lp-ticket-head">
        <span>TRADE TICKET</span>
        <em>#AX-2048</em>
      </div>
      <div className="lp-track">
        <i style={{ width: `${(active / (STEPS.length - 1)) * 100}%` }} />
        {STEPS.map((s, i) => (
          <div key={s} className={`lp-dot ${i <= active ? 'done' : ''}`}>
            <b>{i < active ? '✓' : i + 1}</b>
            <span>{s}</span>
          </div>
        ))}
      </div>
      <p>Follow every trade, step by step. No guessing.</p>
    </div>
  );
}

function InstallCta() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const h = e => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return (
    <section className="lp-install">
      <div>
        <h3>Keep AUREX on your home screen</h3>
        <p>Opens full screen like an app. No app store needed.</p>
      </div>
      {evt ? (
        <button className="lp-btn gold" onClick={() => evt.prompt()}>Install app</button>
      ) : (
        <small>Chrome: ⋮ menu → Add to Home screen</small>
      )}
    </section>
  );
}

export default function Landing({ onAuth }) {
  return (
    <div className="lp">
      <header className="lp-bar">
        <div className="lp-logo"><span>A</span>AUREX</div>
        <button className="lp-btn ghost sm" onClick={() => onAuth('login')}>Sign in</button>
      </header>

      <main>
        <section className="lp-hero">
          <span className="lp-eyebrow">GIFT CARD EXCHANGE</span>
          <h1>
            {['Turn', 'gift', 'cards', 'into'].map((w, i) => (
              <span key={w} className="lp-w" style={{ '--i': i }}>{w} </span>
            ))}
            <span className="lp-w lp-gold" style={{ '--i': 4 }}>naira.</span>
          </h1>
          <p>See your estimate first. Track every trade. Keep a verified record of every naira.</p>
          <div className="lp-cta">
            <button className="lp-btn gold" onClick={() => onAuth('register')}>Create account</button>
            <button className="lp-btn ghost" onClick={() => onAuth('login')}>Sign in</button>
          </div>
        </section>

        <RateDial onStart={onAuth} />

        <section className="lp-sec">
          <h2>Every trade, in plain sight</h2>
          <TradeTicket />
        </section>

        <section className="lp-sec">
          <h2>Built to be trusted</h2>
          <div className="lp-bento">
            <article className="big">
              <b>Ledger-verified</b>
              <p>Every movement of money is recorded in a double-entry ledger, so balances always add up.</p>
            </article>
            <article><b>Receipts</b><p>Open a receipt for any transaction.</p></article>
            <article><b>Statements</b><p>Generate a statement for any period.</p></article>
            <article className="wide">
              <b>Calm by design</b>
              <p>Clear amounts, clear status, no surprises on screen.</p>
            </article>
          </div>
        </section>

        <InstallCta />
      </main>

      <footer className="lp-foot">
        <span>© AUREX · Trade value. Move forward.</span>
        <button className="lp-btn gold wide" onClick={() => onAuth('register')}>Get started</button>
      </footer>
    </div>
  );
}
