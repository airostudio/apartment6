const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.error('STRIPE_SECRET_KEY environment variable is not set.');
} else if (secretKey.startsWith('pk_')) {
  console.error('STRIPE_SECRET_KEY is set to a publishable key (pk_...). Set it to the secret key (sk_...) instead.');
}

const stripe = require('stripe')(secretKey);

/** Expand a date range into individual YYYY-MM-DD strings (checkout night excluded) */
function expandDates(checkin, checkout) {
  const dates = [];
  const start = new Date(checkin  + 'T00:00:00');
  const end   = new Date(checkout + 'T00:00:00');
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/** Check Stripe PaymentIntents for date conflicts */
async function isAvailable(checkin, checkout) {
  const newStart = new Date(checkin  + 'T00:00:00');
  const newEnd   = new Date(checkout + 'T00:00:00');

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

  return !intents.some(pi => {
    if (pi.status !== 'succeeded' && pi.status !== 'processing') return false;
    const m = pi.metadata || {};
    if (!m.checkin || !m.checkout) return false;
    const bStart = new Date(m.checkin  + 'T00:00:00');
    const bEnd   = new Date(m.checkout + 'T00:00:00');
    return newStart < bEnd && newEnd > bStart;
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!secretKey) {
    return res.status(500).json({ error: 'Payment service not configured: STRIPE_SECRET_KEY is missing.' });
  }
  if (secretKey.startsWith('pk_')) {
    return res.status(500).json({ error: 'Payment service misconfigured: STRIPE_SECRET_KEY must be a secret key (sk_...), not a publishable key.' });
  }

  const {
    amountCents,
    platformFeeCents,
    currency = 'aud',
    checkin,
    checkout,
    guestName,
  } = req.body;

  if (!amountCents || amountCents < 50) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // ── Availability check (authoritative, server-side) ─────────────────────
  if (checkin && checkout) {
    try {
      const available = await isAvailable(checkin, checkout);
      if (!available) {
        return res.status(409).json({
          error: 'DATES_UNAVAILABLE',
          message: 'These dates are already booked. Please choose different dates.',
        });
      }
    } catch (err) {
      console.error('Availability pre-check error:', err.message);
      // Continue — do not hard-block on a Stripe list failure
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  try {
    const params = {
      amount:   Math.round(amountCents),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        propertyId: 'cascade6',
        ...(checkin   && { checkin }),
        ...(checkout  && { checkout }),
        ...(guestName && { guestName }),
      },
    };

    const connectedAccountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
    if (connectedAccountId) {
      params.application_fee_amount = Math.round(platformFeeCents || amountCents * 0.015);
      params.transfer_data          = { destination: connectedAccountId };
    }

    const paymentIntent = await stripe.paymentIntents.create(params);
    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe PaymentIntent error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
