const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { validRange, findConflict, refreshExternal } = require('./_availability');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amountCents, currency = 'aud', checkin, checkout } = req.body || {};

  if (!amountCents || amountCents < 50) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  if (!validRange(checkin, checkout)) {
    return res.status(400).json({ error: 'Valid check-in and check-out dates are required.' });
  }

  // Refuse to take payment for dates that are already booked or blocked.
  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    await refreshExternal(sb, 2 * 60 * 1000);
    const conflict = await findConflict(sb, checkin, checkout);
    if (conflict) {
      return res.status(409).json({ error: 'Sorry, those dates are no longer available. You have not been charged — please choose different dates.' });
    }
  } catch (err) {
    console.error('Availability check failed:', err.message);
    return res.status(503).json({ error: 'Could not verify availability. You have not been charged — please try again.' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(amountCents),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { checkin, checkout },
    });

    return res.status(200).json({
      clientSecret:   paymentIntent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    });
  } catch (err) {
    console.error('Stripe PaymentIntent error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
