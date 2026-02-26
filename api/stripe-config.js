module.exports = function handler(req, res) {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return res.status(500).json({ error: 'Stripe publishable key not configured (set STRIPE_PUBLISHABLE_KEY in environment variables)' });
  }
  return res.status(200).json({ publishableKey });
};
