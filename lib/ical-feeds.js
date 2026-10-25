const { createClient } = require('@supabase/supabase-js');
const { normaliseFeedUrl, assertPublicHost, syncFeed } = require('./ical');

const PLATFORMS = { airbnb: 'Airbnb', booking: 'Booking.com', vrbo: 'VRBO', google: 'Google Calendar', other: 'External calendar' };

function requireAdmin(req, res) {
  const key = process.env.ADMIN_KEY;
  if (key && req.headers['x-admin-key'] !== key) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// Feed URLs usually embed a secret token, so the list never returns them in full.
function hint(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 1 ? '/…' + u.pathname.slice(-8) : '');
  } catch (_) { return ''; }
}

function toJS(r) {
  return {
    id: r.id, platform: r.platform, name: r.name, urlHint: hint(r.url), enabled: r.enabled,
    lastSynced: r.last_synced, lastChecked: r.last_checked, lastStatus: r.last_status,
    lastError: r.last_error, lastCount: r.last_count,
  };
}

// Admin: manage external calendar feeds.
//   GET            list feeds
//   POST           add { platform, url, name? } and run a first sync
//   PUT ?id=       sync now (one feed), or ?id=all
//   DELETE ?id=    remove a feed and the dates it imported
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  if (req.method === 'GET') {
    const { data, error } = await sb.from('ical_feeds').select('*').order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data || []).map(toJS));
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const platform = PLATFORMS[b.platform] ? b.platform : 'other';
    let url;
    try {
      url = normaliseFeedUrl(b.url);
      await assertPublicHost(url);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const id = 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const row = { id, platform, name: (b.name || '').trim() || PLATFORMS[platform], url, enabled: true };
    const { data, error } = await sb.from('ical_feeds').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    const result = await syncFeed(sb, data);
    const { data: fresh } = await sb.from('ical_feeds').select('*').eq('id', id).single();
    return res.status(201).json({ feed: toJS(fresh || data), result });
  }

  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    let q = sb.from('ical_feeds').select('*').eq('enabled', true);
    if (id !== 'all') q = q.eq('id', id);
    const { data: feeds, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    if (!feeds || !feeds.length) return res.status(404).json({ error: 'Feed not found' });
    const results = [];
    for (const f of feeds) results.push(Object.assign({ id: f.id, name: f.name }, await syncFeed(sb, f)));
    return res.status(200).json({ results });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    const del1 = await sb.from('blocked_dates').delete().like('id', 'ICAL-' + id + '-%');
    if (del1.error) return res.status(500).json({ error: del1.error.message });
    const del2 = await sb.from('ical_feeds').delete().eq('id', id);
    if (del2.error) return res.status(500).json({ error: del2.error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
