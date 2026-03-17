const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function verify(password, salt, storedHash) {
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (_) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

  const db = sb();
  const { data: user, error } = await db
    .from('admin_users')
    .select('email, salt, hash, role, name')
    .ilike('email', email.trim())
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!verify(password, user.salt, user.hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.status(200).json({
    ok:    true,
    email: user.email,
    role:  user.role,
    name:  user.name || 'Admin',
  });
};
