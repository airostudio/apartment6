module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_PUBLISHABLE_KEY || '';
  if (!key) return res.status(500).json({ error: 'Stripe not configured' });

  return res.status(200).json({
    publishableKey: key,
    testMode: key.startsWith('pk_test_'),
  });
};
