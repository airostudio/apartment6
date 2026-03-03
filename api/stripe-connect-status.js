/**
 * GET /api/stripe-connect-status
 *
 * Returns the live status of the property owner's connected Stripe Express
 * account. Reads STRIPE_CONNECTED_ACCOUNT_ID from environment variables.
 *
 * Response shape:
 *   { configured: false }                    — STRIPE_SECRET_KEY missing
 *   { configured: true, connected: false }   — no connected account set yet
 *   { configured: true, connected: true, … } — full account details
 */

const secretKey = process.env.STRIPE_SECRET_KEY;
const cfg       = require('./_shared-config');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Read at request time so /tmp session config is picked up immediately
  // after the admin saves via stripe-connect-save, without needing redeploy.
  const connectedAccountId = cfg.getConnectedAccountId();

  // ── Platform not configured ──────────────────────────────────────────────
  if (!secretKey || secretKey.startsWith('pk_')) {
    return res.status(200).json({
      configured: false,
      reason: 'STRIPE_SECRET_KEY environment variable is not set.',
    });
  }

  // ── Platform configured but no connected account yet ─────────────────────
  if (!connectedAccountId) {
    return res.status(200).json({
      configured: true,
      connected:  false,
      reason:     'No connected account saved yet. Complete Stripe onboarding to connect.',
    });
  }

  // ── Fetch live account details from Stripe ───────────────────────────────
  try {
    const stripe  = require('stripe')(secretKey);
    const account = await stripe.accounts.retrieve(connectedAccountId);

    // Attempt to fetch the owner's available and pending balances
    let balance = null;
    try {
      const bal = await stripe.balance.retrieve({ stripeAccount: connectedAccountId });
      balance = {
        available: bal.available.reduce((s, b) => s + (b.currency === 'aud' ? b.amount : 0), 0),
        pending:   bal.pending.reduce((s, b)   => s + (b.currency === 'aud' ? b.amount : 0), 0),
      };
    } catch (_) { /* balance is optional — don't fail the whole request */ }

    return res.status(200).json({
      configured:       true,
      connected:        true,
      accountId:        account.id,
      displayName:      account.settings?.dashboard?.display_name || null,
      email:            account.email || null,
      country:          account.country,
      currency:         account.default_currency?.toUpperCase() || 'AUD',
      businessType:     account.business_type,
      chargesEnabled:   account.charges_enabled,
      payoutsEnabled:   account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      created:          account.created,
      payoutSchedule:   account.settings?.payouts?.schedule || null,
      balance,
    });
  } catch (err) {
    console.error('stripe-connect-status error:', err.message);
    return res.status(200).json({
      configured: true,
      connected:  false,
      error:      err.message,
    });
  }
};
