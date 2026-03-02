/**
 * /api/get-booked-dates
 * GET → returns { dates: ['YYYY-MM-DD', ...], ranges: [{checkin, checkout}, ...] }
 *
 * Reads all succeeded/processing Stripe PaymentIntents that have
 * checkin + checkout metadata and expands them into individual date
 * strings so the calendar widget can mark each day as unavailable.
 */

const secretKey = process.env.STRIPE_SECRET_KEY;

function expandDates(checkin, checkout) {
  const dates = [];
  const start = new Date(checkin  + 'T00:00:00');
  const end   = new Date(checkout + 'T00:00:00');
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // No Stripe key → demo mode, return empty
  if (!secretKey || secretKey.startsWith('pk_')) {
    return res.status(200).json({ dates: [], ranges: [], source: 'fallback' });
  }

  try {
    const stripe = require('stripe')(secretKey);

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

    const ranges = [];
    const allDates = new Set();

    intents.forEach(pi => {
      if (pi.status !== 'succeeded' && pi.status !== 'processing') return;
      const m = pi.metadata || {};
      if (!m.checkin || !m.checkout) return;
      ranges.push({ checkin: m.checkin, checkout: m.checkout });
      expandDates(m.checkin, m.checkout).forEach(d => allDates.add(d));
    });

    return res.status(200).json({
      dates: Array.from(allDates).sort(),
      ranges,
      source: 'stripe',
    });
  } catch (err) {
    console.error('get-booked-dates error:', err.message);
    return res.status(200).json({ dates: [], ranges: [], source: 'error' });
  }
};
