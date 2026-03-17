-- Cascade Apartment 6 — Supabase Schema
-- Run this in the Supabase SQL Editor (project → SQL Editor → New query)

-- ── Bookings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id               TEXT PRIMARY KEY,
  ref              TEXT NOT NULL DEFAULT '',
  guest_name       TEXT NOT NULL DEFAULT '',
  email            TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  checkin          DATE,
  checkout         DATE,
  nights           INTEGER NOT NULL DEFAULT 0,
  guests           INTEGER NOT NULL DEFAULT 2,
  total            NUMERIC NOT NULL DEFAULT 0,
  accom            NUMERIC NOT NULL DEFAULT 0,
  addons           JSONB NOT NULL DEFAULT '[]',
  extra_guest_total NUMERIC NOT NULL DEFAULT 0,
  cleaning         NUMERIC NOT NULL DEFAULT 0,
  service          NUMERIC NOT NULL DEFAULT 0,
  tax              NUMERIC NOT NULL DEFAULT 0,
  special_requests TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'confirmed',
  payment_status   TEXT NOT NULL DEFAULT 'paid',
  stripe_id        TEXT NOT NULL DEFAULT '',
  booked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes            TEXT NOT NULL DEFAULT ''
);

-- ── Payments ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  booking_ref  TEXT NOT NULL DEFAULT '',
  booking_id   TEXT NOT NULL DEFAULT '',
  guest_name   TEXT NOT NULL DEFAULT '',
  guest_email  TEXT NOT NULL DEFAULT '',
  amount       NUMERIC NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'succeeded',
  stripe_id    TEXT NOT NULL DEFAULT '',
  method       TEXT NOT NULL DEFAULT 'card',
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_msg    TEXT NOT NULL DEFAULT ''
);

-- ── Rates (single row, id always = 1) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rates (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  peak_weekend    NUMERIC NOT NULL DEFAULT 800,
  peak_midweek    NUMERIC NOT NULL DEFAULT 600,
  shoulder        NUMERIC NOT NULL DEFAULT 465,
  green           NUMERIC NOT NULL DEFAULT 200,
  cleaning_fee    NUMERIC NOT NULL DEFAULT 60,
  service_rate    NUMERIC NOT NULL DEFAULT 10,
  extra_guest_fee NUMERIC NOT NULL DEFAULT 50
);

-- Seed the single rates row so GET always returns something
INSERT INTO rates (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Property Settings (single row, id always = 1) ────────────────────────────
CREATE TABLE IF NOT EXISTS property_settings (
  id   INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO property_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Site Settings (single row, id always = 1) ────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  id   INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Blocked Dates ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_dates (
  id         TEXT PRIMARY KEY,
  from_date  DATE NOT NULL,
  to_date    DATE NOT NULL,
  reason     TEXT NOT NULL DEFAULT ''
);

-- ── Admin Users ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  hash       TEXT NOT NULL,
  salt       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  name       TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial admin account (password: RachelM1972$, hashed with scrypt)
-- To change the password: update the hash and salt columns for this row,
-- or use the admin Change Password feature.
INSERT INTO admin_users (email, hash, salt, role, name)
VALUES (
  'admin@cascadeapartments.com.au',
  '457937f67f0ca3d129adc29deb1ab43b3d9988aa41a106ca1b0275cae1581ea7c06dc41e618ade5327136fde47d722abcc6373a2793fc96f936676a8e0e7f971',
  '4dacc56c5f31dd5891df05923a637500',
  'admin',
  'Admin'
) ON CONFLICT (email) DO NOTHING;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- All access goes through the service-role key in Vercel API functions,
-- so anon access is disabled for safety.
ALTER TABLE bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings     ENABLE ROW LEVEL SECURITY;
