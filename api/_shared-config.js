/**
 * _shared-config.js
 *
 * Runtime configuration helper for Stripe Connect.
 *
 * Reading order for STRIPE_CONNECTED_ACCOUNT_ID:
 *   1. process.env  — set by ops team, always wins (permanent)
 *   2. /tmp/stripe-config.json — written by the admin UI save endpoint;
 *      persists across warm Lambda invocations on the same instance.
 *      Lost on cold starts unless the env var has also been set.
 *
 * This lets the admin activate their connected account immediately after
 * Stripe onboarding completes, without waiting for a redeployment.
 * For permanent, zero-downtime activation set the env var (Vercel, Render,
 * Railway, .env, etc.).
 */

const fs  = require('fs');
const TMP = '/tmp/stripe-config.json';

function readTmp() {
  try { return JSON.parse(fs.readFileSync(TMP, 'utf8')); } catch (_) { return {}; }
}

function writeTmp(patch) {
  try {
    const existing = readTmp();
    fs.writeFileSync(TMP, JSON.stringify({ ...existing, ...patch }));
    return true;
  } catch (e) {
    console.warn('_shared-config: /tmp write failed:', e.message);
    return false;
  }
}

module.exports = {
  /** Returns the active connected account ID, or null if not configured. */
  getConnectedAccountId() {
    return process.env.STRIPE_CONNECTED_ACCOUNT_ID || readTmp().connectedAccountId || null;
  },

  /** Saves the connected account ID to /tmp (session-level persistence). */
  saveConnectedAccountId(id) {
    return writeTmp({ connectedAccountId: id || null });
  },

  /**
   * Returns the account ID created during the current onboarding flow,
   * before the admin has completed Stripe's hosted form.
   * Lets the connect-url endpoint reuse an existing incomplete account
   * rather than creating a fresh one on every button click.
   */
  getPendingAccountId() {
    return readTmp().pendingAccountId || null;
  },

  savePendingAccountId(id) {
    return writeTmp({ pendingAccountId: id || null });
  },
};
