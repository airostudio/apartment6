const crypto = require('crypto');

// Default credentials (used if env vars not set).
// Password: RachelM1972$  — scrypt(password, salt, 64) hex-encoded
const DEFAULT_SALT = '4dacc56c5f31dd5891df05923a637500';
const DEFAULT_HASH = '457937f67f0ca3d129adc29deb1ab43b3d9988aa41a106ca1b0275cae1581ea7c06dc41e618ade5327136fde47d722abcc6373a2793fc96f936676a8e0e7f971';
const DEFAULT_EMAIL = 'admin@cascadeapartments.com.au';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  // Support multiple admins via env: ADMIN_1_EMAIL, ADMIN_1_HASH, ADMIN_1_SALT, etc.
  // Falls back to hardcoded default admin.
  const accounts = [];

  // Load from env vars
  for (let i = 1; i <= 5; i++) {
    const e = process.env[`ADMIN_${i}_EMAIL`];
    const h = process.env[`ADMIN_${i}_HASH`];
    const s = process.env[`ADMIN_${i}_SALT`];
    const r = process.env[`ADMIN_${i}_ROLE`] || 'admin';
    if (e && h && s) accounts.push({ email: e, hash: h, salt: s, role: r });
  }

  // Always include default admin
  accounts.push({
    email: DEFAULT_EMAIL,
    hash:  DEFAULT_HASH,
    salt:  DEFAULT_SALT,
    role:  'admin',
  });

  const match = accounts.find(a => a.email.toLowerCase() === email.toLowerCase().trim());
  if (!match) {
    // Constant-time dummy check to prevent email enumeration timing attacks
    crypto.scryptSync('dummy', DEFAULT_SALT, 64);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  try {
    const supplied = crypto.scryptSync(password, match.salt, 64);
    const stored   = Buffer.from(match.hash, 'hex');
    const valid    = crypto.timingSafeEqual(supplied, stored);

    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    return res.status(200).json({
      ok:    true,
      email: match.email,
      role:  match.role,
      name:  match.role === 'owner' ? 'Owner' : 'Admin',
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
