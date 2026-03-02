/**
 * /api/check-availability
 * POST { checkin: 'YYYY-MM-DD', checkout: 'YYYY-MM-DD' }
 * Returns { available: boolean }
 *
 * Source of truth: succeeded/processing Stripe PaymentIntents whose
 * metadata contains { checkin, checkout }.  Falls back to
 * { available: true, fallback: true } when Stripe is not configured
 * (dev/demo mode) so the flow is never hard-blocked on localhost.
 */

const secretKey = process.env.STRIPE_SECRET_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { checkin, checkout } =
    req.method === 'GET' ? req.query : (req.body || {});

  if (!checkin || !checkout) {
    return res.status(400).json({ error: 'checkin and checkout are required' });
  }

  const newStart = new Date(checkin  + 'T00:00:00');
  const newEnd   = new Date(checkout + 'T00:00:00');

  if (isNaN(newStart) || isNaN(newEnd) || newEnd <= newStart) {
    return res.status(400).json({ error: 'Invalid date range' });
  }

  // No Stripe key → running in demo mode; skip server check
  if (!secretKey || secretKey.startsWith('pk_')) {
    return res.status(200).json({ available: true, source: 'fallback' });
  }

  try {
    const stripe = require('stripe')(secretKey);

    // Collect all PaymentIntents (paginate to be safe)
    let intents = [];
    let page = await stripe.paymentIntents.list({ limit: 100 });
    intents.push(...page.data);
    while (page.has_more) {
      page = await stripe.paymentIntents.list({
        limit: 100,
        starting_after: page.data[page.data.length - 1].id,
      });
      intents.push(...page.data);
    }

    // Only consider active bookings with date metadata
    const conflict = intents.some(pi => {
      if (pi.status !== 'succeeded' && pi.status !== 'processing') return false;
      const m = pi.metadata || {};
      if (!m.checkin || !m.checkout) return false;
      const bStart = new Date(m.checkin  + 'T00:00:00');
      const bEnd   = new Date(m.checkout + 'T00:00:00');
      // Standard interval overlap: A.start < B.end AND A.end > B.start
      return newStart < bEnd && newEnd > bStart;
    });

    return res.status(200).json({ available: !conflict, source: 'stripe' });
  } catch (err) {
    console.error('check-availability error:', err.message);
    // Fail open so a Stripe outage doesn't break the booking flow;
    // the payment-intent creation step also checks.
    return res.status(200).json({ available: true, source: 'error', error: err.message });
  }
};
