module.exports = function handler(req, res) {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || '';
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    publishableKey: key,
    testMode: key.startsWith('pk_test_'),
  });
};
