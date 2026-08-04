const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amountCents, currency = 'aud' } = req.body;

  if (!amountCents || amountCents < 50) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(amountCents),
      currency,
      automatic_payment_methods: { enabled: true },
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
