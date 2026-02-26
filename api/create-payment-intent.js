const secretKey = process.env.STRIPE_SECRET_KEY;

// Guard: catch misconfigured key before Stripe SDK throws an opaque error
if (!secretKey) {
  console.error('STRIPE_SECRET_KEY environment variable is not set.');
} else if (secretKey.startsWith('pk_')) {
  console.error('STRIPE_SECRET_KEY is set to a publishable key (pk_...). Set it to the secret key (sk_...) instead.');
}

const stripe = require('stripe')(secretKey);

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

  const { amountCents, platformFeeCents, currency = 'aud' } = req.body;

  if (!amountCents || amountCents < 50) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const params = {
      amount:   Math.round(amountCents),
      currency,
      automatic_payment_methods: { enabled: true },
    };

    // Stripe Connect: transfer to the property's connected account,
    // retaining the platform fee. STRIPE_CONNECTED_ACCOUNT_ID is set
    // in the Vercel environment variables.
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
