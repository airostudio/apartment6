-- Cascade Apartment 6 — Supabase Schema
-- Run this in the Supabase SQL Editor

-- Admin users table (for server-side authentication)
CREATE TABLE IF NOT EXISTS admin_users (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  hash       TEXT NOT NULL,
  salt       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  name       TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default admin account
-- Password: RachelM1972$ (scrypt hash)
INSERT INTO admin_users (email, hash, salt, role, name)
VALUES (
  'admin@cascadeapartments.com.au',
  '457937f67f0ca3d129adc29deb1ab43b3d9988aa41a106ca1b0275cae1581ea7c06dc41e618ade5327136fde47d722abcc6373a2793fc96f936676a8e0e7f971',
  '4dacc56c5f31dd5891df05923a637500',
  'admin',
  'Admin'
) ON CONFLICT (email) DO NOTHING;
