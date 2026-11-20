import React, { useEffect, useState } from 'react';
import {
  ArrowDownUp, ArrowUpRight, Bell, ChevronRight, Heart,
  CircleDollarSign, CreditCard, LayoutDashboard,
  LogOut, Menu, Package, ShieldCheck, Wallet,
  RefreshCw, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

const brandsFallback = [
  { slug:'amazon', name:'Amazon' },
  { slug:'apple', name:'Apple / iTunes' },
  { slug:'google-play', name:'Google Play' },
  { slug:'steam', name:'Steam' },
  { slug:'xbox', name:'Xbox' },
  { slug:'playstation', name:'PlayStation' },
  { slug:'razer-gold', name:'Razer Gold' },
  { slug:'sephora', name:'Sephora' }
];

function formatNaira(kobo) {
  const amount = Number(kobo || 0) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(amount);
}

function makeIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `aurex-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [page, setPage] = useState('overview');
  const [brands, setBrands] = useState(brandsFallback);
  const [trades, setTrades] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [walletTransactions, setWalletTransactions] = useState([]);

  const [token, setToken] = useState(
    localStorage.getItem('aurex_token') || ''
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const [statement, setStatement] = useState(null);
  const [statementFrom, setStatementFrom] = useState('1970-01-01');
  const [statementTo, setStatementTo] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [statementPage, setStatementPage] = useState(1);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const [form, setForm] = useState({
    direction: 'sell',
    brandSlug: 'amazon',
    cardCurrency: 'USD',
    cardAmount: '100',
    cardCountry: 'US',
    cardType: 'ecode'
  });

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body?.error?.message ||
        body?.error?.code ||
        `Request failed (${response.status})`
      );
    }

    return body;
  }

  async function loadWallet() {
    if (!token) return;

    setWalletLoading(true);

    try {
      const [walletResult, historyResult] = await Promise.all([
        api('/wallet'),
        api('/wallet/transactions')
      ]);

      setWallet(walletResult.data);
      setWalletTransactions(historyResult.data || []);
    } catch (error) {
      setMessage(`Wallet: ${error.message}`);
    } finally {
      setWalletLoading(false);
    }
  }


  async function loadStatement(pageNumber = 1) {
    if (!token) return;

    setStatementLoading(true);
    setStatementError('');

    try {
      const params = new URLSearchParams({
        from: statementFrom,
        to: statementTo,
        page: String(pageNumber),
        limit: '25'
      });

      const result = await api(`/wallet/statement?${params.toString()}`);

      setStatement(result.data);
      setStatementPage(pageNumber);
    } catch (error) {
      setStatementError(error.message);
    } finally {
      setStatementLoading(false);
    }
  }

  async function exportStatement() {
    if (!token) return;

    setExportLoading(true);
    setStatementError('');

    try {
      const params = new URLSearchParams({
        from: statementFrom,
        to: statementTo
      });

      const response = await fetch(
        `${API}/wallet/statement.csv?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body?.error?.message ||
          body?.error?.code ||
          `Export failed (${response.status})`
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = 'aurex-wallet-statement.csv';

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      setStatementError(error.message);
    } finally {
      setExportLoading(false);
    }
  }

  async function viewReceipt(reference) {
    if (!token) return;

    setReceiptLoading(true);
    setSelectedReceipt(null);

    try {
      const result = await api(
        `/wallet/transactions/${encodeURIComponent(reference)}/receipt`
      );

      setSelectedReceipt(result.data);
    } catch (error) {
      setMessage(`Receipt: ${error.message}`);
    } finally {
      setReceiptLoading(false);
    }
  }

  async function load() {
    try {
      const result = await api('/catalog/brands');
      if (result.data?.length) setBrands(result.data);
    } catch {}

    if (token) {
      try {
        const result = await api('/trades');
        setTrades(result.data || []);
      } catch (error) {
        setMessage(error.message);
      }

      await loadWallet();
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function authenticate(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const path = authMode === 'login'
        ? '/auth/login'
        : '/auth/register';

      const payload = authMode === 'login'
        ? { email, password }
        : { email, password, displayName };

      const result = await api(path, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      localStorage.setItem('aurex_token', result.data.token);
      setToken(result.data.token);
      setMessage('Welcome to AUREX.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitTrade(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const result = await api('/trades', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          cardAmount: Number(form.cardAmount)
        })
      });

      setMessage(
        `Demo trade created: ${result.data.client_reference}. No real card or funds were processed.`
      );

      setTrades(previous => [result.data, ...previous]);
      setPage('transactions');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitDeposit(e) {
    e.preventDefault();

    const normalized = depositAmount.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      setMessage('Enter a valid NGN amount with up to two decimal places.');
      return;
    }

    const amountKobo = Math.round(Number(normalized) * 100);

    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
      setMessage('Enter a valid deposit amount.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const result = await api('/wallet/deposit-requests', {
        method: 'POST',
        headers: {
          'Idempotency-Key': makeIdempotencyKey()
        },
        body: JSON.stringify({ amountKobo })
      });

      setMessage(
        `${result.data.reference}: Deposit request created. Payment has NOT been confirmed and your wallet has NOT been credited.`
      );

      setDepositAmount('');
      await loadWallet();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem('aurex_token');
    setToken('');
    setTrades([]);
    setWallet(null);
    setWalletTransactions([]);
    setPage('overview');
    setMessage('');
  }

  if (!token) {
    return (
      <main className="auth-wrap">
        <div className="auth-card">
          <Brand />
          <span className="eyebrow">YOUR GIFT CARD EXCHANGE</span>
          <h1>
            {authMode === 'login'
              ? 'Welcome back'
              : 'Create your account'}
          </h1>
          <p className="muted">Trade value. Move forward.</p>

          <form onSubmit={authenticate} className="stack">
            {authMode === 'register' && (
              <label>
                Display name
                <input
                  required
                  minLength="2"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
            )}

            <label>
              Email address
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <input
                required
                minLength="12"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 12 characters"
              />
            </label>

            <button className="primary" disabled={busy}>
              {busy
                ? 'Please wait…'
                : authMode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>

          <p className="muted switch">
            {authMode === 'login'
              ? 'New to AUREX?'
              : 'Already registered?'}
            {' '}
            <button
              className="link"
              onClick={() =>
                setAuthMode(
                  authMode === 'login' ? 'register' : 'login'
                )
              }
            >
              {authMode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </p>

          {message && <p className="notice">{message}</p>}

          <p className="fine">
            Development build · Demo trading only · No real funds are moved
          </p>
        </div>
      </main>
    );
  }

  const pageTitles = {
    overview: 'Overview',
    trade: 'Trade gift cards',
    transactions: 'Transactions',
    wallet: 'My wallet',
    appreciation: 'Customer appreciation'
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />

        <div className="side-label">WORKSPACE</div>

        <Nav
          icon={LayoutDashboard}
          active={page === 'overview'}
          onClick={() => setPage('overview')}
        >
          Overview
        </Nav>

        <Nav
          icon={ArrowDownUp}
          active={page === 'trade'}
          onClick={() => setPage('trade')}
        >
          Trade gift cards
        </Nav>

        <Nav
          icon={Package}
          active={page === 'transactions'}
          onClick={() => setPage('transactions')}
        >
          Transactions
        </Nav>

        <Nav
          icon={Heart}
          active={page === 'appreciation'}
          onClick={() => setPage('appreciation')}
        >
          Appreciation
        </Nav>

        <div className="side-label lower">ACCOUNT</div>

        <Nav
          icon={Wallet}
          active={page === 'wallet'}
          onClick={() => {
            setPage('wallet');
            loadWallet();
            loadStatement(1);
          }}
        >
          Wallet
        </Nav>

        <Nav
          icon={ShieldCheck}
          onClick={() =>
            setMessage(
              'Identity verification will be integrated with an approved KYC provider.'
            )
          }
        >
          Verification
        </Nav>

        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">A</div>
            <div>
              <b>AUREX member</b>
              <small>Customer account</small>
            </div>
            <button title="Sign out" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu">
            <Menu />
          </button>

          <div>
            <span className="eyebrow">AUREX / CUSTOMER PORTAL</span>
            <h2>{pageTitles[page]}</h2>
          </div>

          <button className="icon-button">
            <Bell size={18} />
          </button>
        </header>

        {message && (
          <div className="notice banner">
            <span>{message}</span>
            <button onClick={() => setMessage('')}>×</button>
          </div>
        )}

        {page === 'overview' && (
          <>
            <section className="wx-hero">
              <div className="wx-card glass">
                <div className="wx-card-top">
                  <span>Available balance</span>
                  <span className={`wx-chip ${wallet?.status || ''}`}>{wallet?.status || 'Loading'}</span>
                </div>
                <strong className="wx-balance">
                  {wallet ? formatNaira(wallet.balanceKobo) : '₦ —'}
                </strong>
                <div className="wx-card-bottom">
                  <span>AUREX · {wallet?.currency || 'NGN'}</span>
                  <span className="wx-mark">A<i>✦</i></span>
                </div>
              </div>

              <div className="wx-quick">
                <button onClick={() => { setForm({ ...form, direction: 'sell' }); setPage('trade'); }}>
                  <span><ArrowUpRight size={20} /></span>Sell
                </button>
                <button onClick={() => { setForm({ ...form, direction: 'buy' }); setPage('trade'); }}>
                  <span><CreditCard size={20} /></span>Buy
                </button>
                <button onClick={() => { setPage('wallet'); loadWallet(); loadStatement(1); }}>
                  <span><Wallet size={20} /></span>Top up
                </button>
                <button onClick={() => setPage('transactions')}>
                  <span><Clock size={20} /></span>History
                </button>
              </div>
            </section>

            <div className="section-head">
              <div><h3>Recent activity</h3></div>
              <button className="wx-link" onClick={() => setPage('transactions')}>See all</button>
            </div>
            <div className="wx-list glass">
              {walletTransactions.length === 0 ? (
                <p className="wx-empty">No activity yet. Make a trade or top up to get started.</p>
              ) : walletTransactions.slice(0, 4).map(t => (
                <button key={t.reference} className="wx-row" onClick={() => viewReceipt(t.reference)}>
                  <span className="wx-ico"><Wallet size={17} /></span>
                  <span className="wx-meta">
                    <b>{String(t.transaction_type || '').replace(/_/g, ' ')}</b>
                    <small>{new Date(t.created_at).toLocaleDateString()}</small>
                  </span>
                  <span className="wx-amt">{formatNaira(t.amount_kobo)}</span>
                </button>
              ))}
            </div>

            <div className="section-head">
              <div>
                <span className="eyebrow">YOUR ACCOUNT</span>
                <h3>Trading overview</h3>
              </div>
              <span className="status">
                <i /> Demo environment
              </span>
            </div>

            <div className="stat-grid">
              <Stat
                icon={Wallet}
                label="Available balance"
                value={wallet ? formatNaira(wallet.balanceKobo) : '₦ —'}
                hint={wallet ? `Wallet ${wallet.status}` : 'Loading wallet'}
              />

              <Stat
                icon={ArrowDownUp}
                label="Total trades"
                value={String(trades.length)}
                hint="Your submitted demo trades"
              />

              <Stat
                icon={CircleDollarSign}
                label="Live exchange rates"
                value="—"
                hint="Provider connection pending"
              />
            </div>

            <div className="section-head">
              <div>
                <span className="eyebrow">GET STARTED</span>
                <h3>Choose your trade</h3>
              </div>
            </div>

            <div className="action-grid">
              <Action
                title="Sell a gift card"
                text="Submit a card for review and NGN settlement."
                icon={CreditCard}
                onClick={() => {
                  setForm({ ...form, direction: 'sell' });
                  setPage('trade');
                }}
              />

              <Action
                title="Buy a gift card"
                text="Purchase a digital gift card for delivery."
                icon={Package}
                onClick={() => {
                  setForm({ ...form, direction: 'buy' });
                  setPage('trade');
                }}
              />
            </div>
          </>
        )}

        {page === 'appreciation' && (
          <section className="appreciation-page">
            <div className="appreciation-hero">
              <div className="appreciation-symbol"><Heart size={30} /></div>
              <span className="eyebrow">THE AUREX CUSTOMER PROMISE</span>
              <h1>Thank you for being part of <em>AUREX.</em></h1>
              <p>
                Every customer helps shape what we build next. We appreciate
                the trust you place in us and the opportunity to make gift-card
                trading clearer, safer and more rewarding.
              </p>
              <div className="appreciation-signoff">Trade Value. Move Forward.</div>
            </div>

            <div className="section-head">
              <div>
                <span className="eyebrow">BUILT AROUND YOU</span>
                <h3>What you can expect from us</h3>
              </div>
            </div>

            <div className="appreciation-grid">
              <article className="appreciation-card">
                <ShieldCheck size={22} />
                <h3>Clarity comes first</h3>
                <p>We aim to show transaction status and wallet activity transparently, without presenting pending requests as completed payments.</p>
              </article>
              <article className="appreciation-card">
                <Heart size={22} />
                <h3>Your voice matters</h3>
                <p>Your feedback helps us improve the customer experience. We will make official support and feedback channels visible here when they are configured.</p>
              </article>
              <article className="appreciation-card">
                <CircleDollarSign size={22} />
                <h3>Honest rewards</h3>
                <p>We will only announce loyalty benefits when their terms and availability are confirmed. No reward or cash credit is promised by this page.</p>
              </article>
            </div>

            <div className="appreciation-note">
              <div>
                <span className="eyebrow">A NOTE FROM AUREX</span>
                <h3>Thank you for growing with us.</h3>
                <p>
                  AUREX is being developed with customer trust at its centre.
                  We are committed to communicating clearly as new services
                  become available.
                </p>
              </div>
              <div className="appreciation-mark">A<span>✦</span></div>
            </div>
          </section>
        )}

        {page === 'trade' && (
          <section className="panel">
            <span className="eyebrow">GIFT CARD MARKETPLACE</span>
            <h3>Start a trade</h3>
            <p className="muted">
              Choose a direction and card. This milestone creates demo records only.
            </p>

            <form onSubmit={submitTrade} className="trade-form">
              <label>
                Trade direction
                <select
                  value={form.direction}
                  onChange={e =>
                    setForm({ ...form, direction: e.target.value })
                  }
                >
                  <option value="sell">Sell gift card</option>
                  <option value="buy">Buy gift card</option>
                </select>
              </label>

              <label>
                Gift card brand
                <select
                  value={form.brandSlug}
                  onChange={e =>
                    setForm({ ...form, brandSlug: e.target.value })
                  }
                >
                  {brands.map(brand => (
                    <option key={brand.slug} value={brand.slug}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="two">
                <label>
                  Card amount
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={form.cardAmount}
                    onChange={e =>
                      setForm({ ...form, cardAmount: e.target.value })
                    }
                  />
                </label>

                <label>
                  Card currency
                  <select
                    value={form.cardCurrency}
                    onChange={e =>
                      setForm({ ...form, cardCurrency: e.target.value })
                    }
                  >
                    {['USD', 'GBP', 'EUR', 'CAD', 'NGN'].map(currency => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="two">
                <label>
                  Card country
                  <input
                    maxLength="2"
                    value={form.cardCountry}
                    onChange={e =>
                      setForm({
                        ...form,
                        cardCountry: e.target.value.toUpperCase()
                      })
                    }
                  />
                </label>

                <label>
                  Card type
                  <select
                    value={form.cardType}
                    onChange={e =>
                      setForm({ ...form, cardType: e.target.value })
                    }
                  >
                    <option value="ecode">E-code</option>
                    <option value="physical">Physical</option>
                    <option value="digital_receipt">Digital receipt</option>
                  </select>
                </label>
              </div>

              <div className="warning">
                <ShieldCheck size={18} />
                <span>
                  Never submit a real gift card code in this demo. Secure card intake is not enabled.
                </span>
              </div>

              <button className="primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Create demo trade'}
                <ChevronRight size={17} />
              </button>
            </form>
          </section>
        )}

        {page === 'wallet' && (
          <section className="wallet-page">
            <div className="wallet-heading">
              <div>
                <span className="eyebrow">AUREX FINANCIAL ACCOUNT</span>
                <h3>Your NGN wallet</h3>
                <p className="muted">
                  View your posted ledger balance and deposit requests.
                </p>
              </div>

              <button
                className="refresh-button"
                onClick={() => {
                  loadWallet();
                  loadStatement(1);
                }}
                disabled={walletLoading || statementLoading}
              >
                <RefreshCw size={16} />
                {walletLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div className="balance-card">
              <div className="balance-top">
                <span>AVAILABLE WALLET BALANCE</span>
                <Wallet size={22} />
              </div>

              <strong>
                {wallet ? formatNaira(wallet.balanceKobo) : '₦ —'}
              </strong>

              <div className="balance-bottom">
                <span>Currency: {wallet?.currency || 'NGN'}</span>
                <span className={`wallet-status ${wallet?.status || 'unknown'}`}>
                  {wallet?.status || 'Loading'}
                </span>
              </div>
            </div>

            <div className="wallet-grid">
              <section className="panel">
                <span className="eyebrow">ADD FUNDS</span>
                <h3>Request a deposit</h3>

                <p className="muted">
                  Create a deposit request for tracking. No payment is collected in this development build.
                </p>

                <form onSubmit={submitDeposit} className="trade-form">
                  <label>
                    Amount in Nigerian naira
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="Example: 5000.00"
                      required
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                    />
                  </label>

                  {depositAmount && (
                    <div className="amount-preview">
                      Request amount: {formatNaira(
                        Math.round(Number(depositAmount) * 100)
                      )}
                    </div>
                  )}

                  <div className="warning">
                    <AlertCircle size={18} />
                    <span>
                      This creates a pending record only. Do not transfer money based on this request. Payment integration is not active.
                    </span>
                  </div>

                  <button
                    className="primary"
                    disabled={busy || wallet?.status !== 'active'}
                  >
                    {busy ? 'Creating request…' : 'Create deposit request'}
                    <ChevronRight size={17} />
                  </button>
                </form>
              </section>

              <section className="panel wallet-info">
                <span className="eyebrow">ACCOUNT INFORMATION</span>
                <h3>Wallet details</h3>

                <div className="info-row">
                  <span>Wallet ID</span>
                  <b>{wallet?.id || 'Loading…'}</b>
                </div>

                <div className="info-row">
                  <span>Currency</span>
                  <b>{wallet?.currency || 'NGN'}</b>
                </div>

                <div className="info-row">
                  <span>Account status</span>
                  <b>{wallet?.status || 'Unknown'}</b>
                </div>

                <div className="wallet-security">
                  <ShieldCheck size={20} />
                  <div>
                    <b>Ledger-based balance</b>
                    <p>
                      Your displayed balance is calculated from posted ledger entries, not pending requests.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <section className="panel wallet-history">
              <div className="history-heading">
                <div>
                  <span className="eyebrow">WALLET ACTIVITY</span>
                  <h3>Deposit requests and transactions</h3>
                </div>
                <Clock size={20} />
              </div>

              {walletTransactions.length === 0 ? (
                <div className="empty">
                  <Wallet size={30} />
                  <b>No wallet transactions yet</b>
                  <p>Your wallet activity will appear here.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>

                    <tbody>
                      {walletTransactions.map(transaction => (
                        <tr key={transaction.reference}>
                          <td>{transaction.reference}</td>
                          <td>{transaction.transaction_type}</td>
                          <td>{formatNaira(transaction.amount_kobo)}</td>
                          <td>
                            <span className={`pill status-${transaction.status}`}>
                              {transaction.status}
                            </span>
                          </td>
                          <td>
                            {new Date(transaction.created_at).toLocaleString()}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="receipt-button"
                              onClick={() => viewReceipt(transaction.reference)}
                              disabled={receiptLoading}
                            >
                              View receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel statement-panel">
              <div className="history-heading">
                <div>
                  <span className="eyebrow">FINANCIAL REPORTING</span>
                  <h3>Account statement</h3>
                  <p className="muted">
                    Review your wallet activity and download your statement.
                  </p>
                </div>
                <CircleDollarSign size={22} />
              </div>

              <form
                className="statement-filters"
                onSubmit={e => {
                  e.preventDefault();
                  loadStatement(1);
                }}
              >
                <label>
                  From date
                  <input
                    type="date"
                    required
                    value={statementFrom}
                    max={statementTo}
                    onChange={e => setStatementFrom(e.target.value)}
                  />
                </label>

                <label>
                  To date
                  <input
                    type="date"
                    required
                    value={statementTo}
                    min={statementFrom}
                    onChange={e => setStatementTo(e.target.value)}
                  />
                </label>

                <button
                  type="submit"
                  className="primary statement-action"
                  disabled={statementLoading}
                >
                  {statementLoading ? 'Loading…' : 'Generate statement'}
                </button>

                <button
                  type="button"
                  className="refresh-button"
                  onClick={exportStatement}
                  disabled={exportLoading}
                >
                  {exportLoading ? 'Preparing…' : 'Download CSV'}
                </button>
              </form>

              {statementError && (
                <div className="statement-error">
                  {statementError}
                </div>
              )}

              {statementLoading && (
                <div className="statement-loading">
                  Loading your account statement…
                </div>
              )}

              {statement && !statementLoading && (
                <>
                  <div className="statement-summary">
                    <div>
                      <span>Opening balance</span>
                      <b>{formatNaira(statement.openingBalanceKobo)}</b>
                    </div>

                    <div>
                      <span>Period net change</span>
                      <b>{formatNaira(statement.periodNetChangeKobo)}</b>
                    </div>

                    <div>
                      <span>Closing balance</span>
                      <b>{formatNaira(statement.closingBalanceKobo)}</b>
                    </div>
                  </div>

                  <div className="statement-meta">
                    <span>
                      {statement.period?.from} — {statement.period?.to}
                    </span>
                    <span>
                      {statement.total} transaction record(s)
                    </span>
                  </div>

                  {statement.transactions?.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Reference</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Movement</th>
                            <th>Running balance</th>
                            <th>Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {statement.transactions.map((item, index) => (
                            <tr key={`${item.reference}-${index}`}>
                              <td>
                                {new Date(item.created_at).toLocaleDateString()}
                              </td>
                              <td>{item.reference}</td>
                              <td>{item.transaction_type}</td>
                              <td>{formatNaira(item.amount_kobo)}</td>
                              <td>{formatNaira(item.balance_change_kobo)}</td>
                              <td>{formatNaira(item.running_balance_kobo)}</td>
                              <td>
                                <span className={`pill status-${item.status}`}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty statement-empty">
                      <Wallet size={28} />
                      <b>No activity in this period</b>
                      <p>There are no wallet transactions for these dates.</p>
                    </div>
                  )}

                  <div className="statement-pagination">
                    <button
                      type="button"
                      className="refresh-button"
                      disabled={statementPage <= 1 || statementLoading}
                      onClick={() => loadStatement(statementPage - 1)}
                    >
                      Previous
                    </button>

                    <span>
                      Page {statementPage} of {
                        Math.max(
                          1,
                          Math.ceil(
                            Number(statement.total || 0) /
                            Number(statement.limit || 25)
                          )
                        )
                      }
                    </span>

                    <button
                      type="button"
                      className="refresh-button"
                      disabled={
                        statementPage >= Math.max(
                          1,
                          Math.ceil(
                            Number(statement.total || 0) /
                            Number(statement.limit || 25)
                          )
                        ) || statementLoading
                      }
                      onClick={() => loadStatement(statementPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>

            {receiptLoading && (
              <div className="receipt-backdrop">
                <div className="receipt-modal">
                  <p>Retrieving your transaction receipt…</p>
                </div>
              </div>
            )}

            {selectedReceipt && (
              <div
                className="receipt-backdrop"
                onClick={() => setSelectedReceipt(null)}
              >
                <section
                  className="receipt-modal"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="receipt-heading">
                    <div>
                      <span className="eyebrow">AUREX TRANSACTION RECORD</span>
                      <h3>Transaction receipt</h3>
                    </div>

                    <button
                      type="button"
                      className="receipt-close"
                      onClick={() => setSelectedReceipt(null)}
                    >
                      ×
                    </button>
                  </div>

                  <div className="receipt-brand">
                    <div className="brand-mark">A<span>✦</span></div>
                    <div>
                      <b>AUREX</b>
                      <small>TRADE VALUE. MOVE FORWARD.</small>
                    </div>
                  </div>

                  <div className="receipt-amount">
                    {formatNaira(selectedReceipt.amountKobo)}
                  </div>

                  <div className="receipt-status">
                    <span className={`pill status-${selectedReceipt.status}`}>
                      {selectedReceipt.receiptStatus}
                    </span>
                    <p>
                      {selectedReceipt.receiptStatus === 'confirmed'
                        ? 'This transaction has been posted to the wallet ledger.'
                        : selectedReceipt.receiptStatus === 'pending'
                          ? 'This transaction is pending. Payment has not been confirmed.'
                          : `Transaction status: ${selectedReceipt.receiptStatus}`}
                    </p>
                  </div>

                  <div className="receipt-details">
                    <div>
                      <span>Reference</span>
                      <b>{selectedReceipt.reference}</b>
                    </div>
                    <div>
                      <span>Transaction type</span>
                      <b>{selectedReceipt.transaction_type}</b>
                    </div>
                    <div>
                      <span>Currency</span>
                      <b>{selectedReceipt.currency}</b>
                    </div>
                    <div>
                      <span>Transaction status</span>
                      <b>{selectedReceipt.status}</b>
                    </div>
                    <div>
                      <span>Description</span>
                      <b>{selectedReceipt.description || '—'}</b>
                    </div>
                    <div>
                      <span>Created</span>
                      <b>
                        {new Date(selectedReceipt.created_at).toLocaleString()}
                      </b>
                    </div>
                    <div>
                      <span>Last updated</span>
                      <b>
                        {new Date(selectedReceipt.updated_at).toLocaleString()}
                      </b>
                    </div>
                  </div>

                  <p className="receipt-disclaimer">
                    This is an account transaction record, not independent
                    proof of a bank transfer or external payment.
                  </p>

                  <button
                    type="button"
                    className="primary receipt-done"
                    onClick={() => setSelectedReceipt(null)}
                  >
                    Close receipt
                  </button>
                </section>
              </div>
            )}
          </section>
        )}

        {page === 'transactions' && (
          <section className="panel">
            <span className="eyebrow">ACTIVITY</span>
            <h3>Recent transactions</h3>

            {trades.length === 0 ? (
              <div className="empty">
                <Package size={30} />
                <b>No trades yet</b>
                <p>Your trades will appear here.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Direction</th>
                      <th>Gift card</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {trades.map(trade => (
                      <tr key={trade.id}>
                        <td>{trade.client_reference}</td>
                        <td>{trade.direction}</td>
                        <td>{trade.brand_slug}</td>
                        <td>
                          {trade.card_currency} {trade.card_amount}
                        </td>
                        <td>
                          <span className="pill">{trade.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <footer>
          © {new Date().getFullYear()} AUREX Technologies · Secure exchange infrastructure
        </footer>
      </main>
      <nav className="wx-tabs" aria-label="Primary">
        {[['overview',LayoutDashboard,'Home'],['trade',ArrowDownUp,'Trade'],['transactions',Package,'History'],['wallet',Wallet,'Wallet']].map(([k,Icon,l]) => (
          <button key={k} className={page===k?'on':''} onClick={() => { setPage(k); if(k==='wallet'){loadWallet();loadStatement(1);} }}>
            <Icon size={20} /><span>{l}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">A<span>✦</span></div>
      <div>
        <b>AUREX</b>
        <small>GIFT CARD EXCHANGE</small>
      </div>
    </div>
  );
}

function Nav({ icon: Icon, children, active, onClick }) {
  return (
    <button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <Icon size={18} />
      {children}
    </button>
  );
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={19} />
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function Action({ title, text, icon: Icon, onClick }) {
  return (
    <button className="action-card" onClick={onClick}>
      <div className="action-icon">
        <Icon size={22} />
      </div>
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
      <ArrowUpRight className="action-arrow" size={18} />
    </button>
  );
}
