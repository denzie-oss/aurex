BEGIN;

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL
    CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  normal_balance TEXT NOT NULL
    CHECK (normal_balance IN ('debit','credit')),
  owner_user_id UUID UNIQUE REFERENCES users(id),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  account_id UUID NOT NULL UNIQUE REFERENCES ledger_accounts(id),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','frozen','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL,
  transaction_type TEXT NOT NULL
    CHECK (transaction_type IN ('deposit','withdrawal','adjustment')),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','posted','rejected','reversed')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES wallet_transactions(id),
  account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  debit_kobo BIGINT NOT NULL DEFAULT 0 CHECK (debit_kobo >= 0),
  credit_kobo BIGINT NOT NULL DEFAULT 0 CHECK (credit_kobo >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (debit_kobo > 0 AND credit_kobo = 0)
    OR
    (credit_kobo > 0 AND debit_kobo = 0)
  )
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx
  ON wallet_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ledger_entries_account_idx
  ON ledger_entries(account_id, created_at DESC);

INSERT INTO ledger_accounts
  (account_code, name, account_type, normal_balance, currency)
VALUES
  ('AUREX-NGN-CLEARING', 'AUREX NGN Clearing Account',
   'asset', 'debit', 'NGN')
ON CONFLICT (account_code) DO NOTHING;

COMMIT;
