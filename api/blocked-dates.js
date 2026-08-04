const { createClient } = require('@supabase/supabase-js');

function client() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function toJS(row) {
  return {
    id:     row.id,
    from:   row.from_date || '',
    to:     row.to_date   || '',
    reason: row.reason    || '',
  };
}

function requireAdmin(req, res) {
  const key = process.env.ADMIN_KEY;
  if (key && req.headers['x-admin-key'] !== key) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = client();

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('blocked_dates')
      .select('*')
      .order('from_date', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data || []).map(toJS));
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const obj = req.body;
    const { data, error } = await sb
      .from('blocked_dates')
      .insert({
        id:        obj.id     || ('BLK-' + Date.now()),
        from_date: obj.from,
        to_date:   obj.to,
        reason:    obj.reason || '',
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(toJS(data));
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('blocked_dates').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
