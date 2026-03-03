/**
 * GET /api/stripe-connect-status
 *
 * Returns the Stripe account status for the configured STRIPE_SECRET_KEY.
 *
 * Response shape:
 *   { configured: false }                        — STRIPE_SECRET_KEY missing
 *   { configured: true, working: false, error }  — key set but API call failed
 *   { configured: true, working: true, … }       — account details
 */

const secretKey = process.env.STRIPE_SECRET_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!secretKey || secretKey.startsWith('pk_')) {
    return res.status(200).json({ configured: false });
  }

  try {
    const stripe  = require('stripe')(secretKey);
    const account = await stripe.accounts.retrieve();   // retrieves the platform account

    return res.status(200).json({
      configured:  true,
      working:     true,
      accountId:   account.id,
      email:       account.email,
      displayName: account.settings?.dashboard?.display_name || account.business_profile?.name || null,
      country:     account.country,
      mode:        secretKey.startsWith('sk_live_') ? 'live' : 'test',
      chargesEnabled: account.charges_enabled,
    });
  } catch (err) {
    console.error('stripe-connect-status error:', err.message);
    return res.status(200).json({
      configured: true,
      working:    false,
      error:      err.message,
    });
  }
};
