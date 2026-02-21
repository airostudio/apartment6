'use strict';

const express       = require('express');
const session       = require('express-session');
const cookieParser  = require('cookie-parser');
const bcrypt        = require('bcrypt');
const path          = require('path');
const fs            = require('fs');
const Database      = require('better-sqlite3');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT           = process.env.PORT || 3000;
const ROOT_DIR       = __dirname;
const DB_PATH        = path.join(ROOT_DIR, 'db', 'admin.db');
const ADMIN_EMAIL    = 'info@cascade6.com.au';
const BCRYPT_ROUNDS  = 12;
const SESSION_SECRET = process.env.SESSION_SECRET || 'cascade6-secret-change-in-production';

// ---------------------------------------------------------------------------
// Database initialisation
// ---------------------------------------------------------------------------
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Ensure the admin user row exists (no password hash yet on first run)
const ensureAdmin = db.prepare(`
  INSERT OR IGNORE INTO users (email) VALUES (?)
`);
ensureAdmin.run(ADMIN_EMAIL);

// Prepared statements
const stmtGetUser       = db.prepare('SELECT * FROM users WHERE email = ?');
const stmtSetPassword   = db.prepare(`
  UPDATE users
  SET    password_hash = ?,
         updated_at    = datetime('now')
  WHERE  email = ?
`);

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   8 * 60 * 60 * 1000   // 8 hours
  }
}));

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  // Check if a password has ever been set; if not, send to setup flow
  const user = stmtGetUser.get(ADMIN_EMAIL);
  if (!user || !user.password_hash) {
    return res.redirect('/admin/login.html?setup=true');
  }

  return res.redirect('/admin/login.html');
}

// Routes that must never be blocked by auth
const AUTH_WHITELIST = [
  '/admin/login.html',
  '/api/auth/login',
  '/api/auth/setup',
  '/api/auth/check',
  '/api/auth/logout'
];

function isWhitelisted(reqPath) {
  // Allow all /api/ routes through (they handle their own responses)
  if (reqPath.startsWith('/api/')) return true;
  return AUTH_WHITELIST.includes(reqPath);
}

// ---------------------------------------------------------------------------
// API routes  (must come BEFORE the static-file / admin guard middleware)
// ---------------------------------------------------------------------------

// GET /api/auth/check
app.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ authenticated: true, email: req.session.userEmail || ADMIN_EMAIL });
  }
  return res.json({ authenticated: false, email: null });
});

// POST /api/auth/setup  – first-time password creation
app.post('/api/auth/setup', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'That email address is not authorised.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const user = stmtGetUser.get(ADMIN_EMAIL);
    if (user && user.password_hash) {
      return res.status(409).json({ error: 'Password is already set. Please log in normally.' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    stmtSetPassword.run(hash, ADMIN_EMAIL);

    // Log them in immediately after setup
    const freshUser = stmtGetUser.get(ADMIN_EMAIL);
    req.session.userId    = freshUser.id;
    req.session.userEmail = freshUser.email;

    return res.json({ success: true, redirect: '/admin/index.html' });
  } catch (err) {
    console.error('Setup error:', err);
    return res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = stmtGetUser.get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        error:     'No password set yet.',
        setupRequired: true
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId    = user.id;
    req.session.userEmail = user.email;

    return res.json({ success: true, redirect: '/admin/index.html' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, redirect: '/admin/login.html' });
  });
});

// ---------------------------------------------------------------------------
// Admin route guard  – protect everything under /admin/* except login.html
// ---------------------------------------------------------------------------
app.use('/admin', (req, res, next) => {
  // Normalise path for comparison (strip query string)
  const reqPath = '/admin' + req.path;

  // login.html is always public
  if (req.path === '/login.html') {
    return next();
  }

  // Delegate to requireAuth for everything else
  return requireAuth(req, res, next);
});

// ---------------------------------------------------------------------------
// Static file serving  – serve from the root directory
// ---------------------------------------------------------------------------
app.use(express.static(ROOT_DIR, {
  // Don't list directories
  index: 'index.html'
}));

// Fallback: if nothing matched, send 404
app.use((req, res) => {
  res.status(404).send('Not found');
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Cascade Apartment 6 server running on http://localhost:${PORT}`);

  const user = stmtGetUser.get(ADMIN_EMAIL);
  if (!user || !user.password_hash) {
    console.log(`  First-time setup required. Visit http://localhost:${PORT}/admin/login.html?setup=true`);
  } else {
    console.log(`  Admin login: http://localhost:${PORT}/admin/login.html`);
  }
});
