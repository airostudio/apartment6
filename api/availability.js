const { createClient } = require('@supabase/supabase-js');
const { validRange, findConflict, refreshExternal } = require('./_availability');

// Public: GET /api/availability?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD
// Returns { available: boolean }. Reveals nothing about who booked.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { checkin, checkout } = req.query;
  if (!validRange(checkin, checkout)) return res.status(400).json({ error: 'Valid checkin and checkout dates required.' });

  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    await refreshExternal(sb);
    return res.status(200).json({ available: !(await findConflict(sb, checkin, checkout)) });
  } catch (err) {
    console.error('Availability check failed:', err.message);
    return res.status(503).json({ error: 'Could not verify availability.' });
  }
};
