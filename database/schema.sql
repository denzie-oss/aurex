CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','support','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gift_card_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('buy','sell')),
  card_currency CHAR(3) NOT NULL,
  payout_currency CHAR(3) NOT NULL DEFAULT 'NGN',
  rate NUMERIC(20,8) NOT NULL CHECK (rate >= 0),
  source TEXT NOT NULL DEFAULT 'demo',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  client_reference TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_reference TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('buy','sell')),
  brand_slug TEXT NOT NULL,
  card_country CHAR(2),
  card_type TEXT,
  card_currency CHAR(3) NOT NULL,
  card_amount NUMERIC(20,2) NOT NULL CHECK (card_amount > 0),
  payout_currency CHAR(3) NOT NULL DEFAULT 'NGN',
  quoted_rate NUMERIC(20,8),
  estimated_payout NUMERIC(20,2),
  status TEXT NOT NULL DEFAULT 'created',
  status_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trades_user_created_idx ON trades(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trades_provider_ref_idx ON trades(provider, provider_reference);

INSERT INTO gift_card_brands (slug, name) VALUES
 ('amazon','Amazon'), ('apple','Apple / iTunes'), ('google-play','Google Play'),
 ('steam','Steam'), ('xbox','Xbox'), ('playstation','PlayStation'),
 ('razer-gold','Razer Gold'), ('sephora','Sephora')
ON CONFLICT (slug) DO NOTHING;
