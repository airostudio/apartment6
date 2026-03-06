module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  });
};
