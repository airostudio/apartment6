/**
 * POST /api/stripe-connect-url
 *
 * Creates a Stripe Express connected account for the property owner and
 * returns the Stripe-hosted Account Link URL so they can complete
 * onboarding (identity, bank account, tax details) securely on Stripe.
 *
 * Body: { returnBaseUrl?: string }
 *   returnBaseUrl – optional base URL for Stripe's return/refresh redirects.
 *   If omitted it is inferred from the request's Origin / Host header.
 *
 * Response 200: { url: string, accountId: string }
 * Response 500: { error: string }
 */

const secretKey = process.env.STRIPE_SECRET_KEY;
const cfg       = require('./_shared-config');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!secretKey || secretKey.startsWith('pk_')) {
    return res.status(500).json({
      error: 'STRIPE_SECRET_KEY is not configured on the server. Add it to your environment variables first.',
    });
  }

  try {
    const stripe = require('stripe')(secretKey);

    // Reuse any in-progress (incomplete) Express account rather than creating
    // a new one on every button click.  pendingAccountId is cleared when the
    // admin completes onboarding and stripe-connect-save is called.
    let accountId = cfg.getPendingAccountId();

    if (!accountId) {
      // Create a new Stripe Express account for the property owner.
      // Express accounts give the owner their own Stripe-managed dashboard
      // while allowing the platform to charge application fees on each payment.
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
      });
      accountId = account.id;
      cfg.savePendingAccountId(accountId);
    }

    // Treat accountId as a local var below — keep original variable name
    const account = { id: accountId };

    // Build absolute base URL for Stripe's redirect URLs
    const body   = req.body || {};
    const origin = body.returnBaseUrl ||
                   req.headers.origin ||
                   `https://${req.headers.host}`;
    const base   = origin.replace(/\/$/, '');

    // Account Link — Stripe-hosted onboarding form
    const accountLink = await stripe.accountLinks.create({
      account:     account.id,
      // If the link expires before the owner completes it, Stripe sends
      // them here; the page can call this endpoint again to get a fresh link.
      refresh_url: `${base}/admin/stripe-connect?refresh=1`,
      // After successful onboarding Stripe redirects here with the account id
      // embedded in the URL so the admin page can display it.
      return_url:  `${base}/admin/stripe-connect?setup=complete&account=${encodeURIComponent(account.id)}`,
      type:        'account_onboarding',
    });

    return res.status(200).json({ url: accountLink.url, accountId: account.id });
  } catch (err) {
    console.error('stripe-connect-url error:', err.message);
    // Detect the specific "not signed up for Connect" error so the frontend
    // can show targeted instructions rather than a raw Stripe error string.
    const isConnectNotEnabled = /signed up for Connect/i.test(err.message);
    return res.status(500).json({
      error:   isConnectNotEnabled ? 'CONNECT_NOT_ENABLED' : err.message,
      message: err.message,
    });
  }
};
