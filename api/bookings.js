const { createClient } = require('@supabase/supabase-js');

function client() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// DB row (snake_case) → JS object (camelCase)
function toJS(row) {
  return {
    id:              row.id,
    ref:             row.ref || '',
    guestName:       row.guest_name || '',
    name:            row.guest_name || '',
    email:           row.email || '',
    phone:           row.phone || '',
    checkin:         row.checkin  || '',
    checkout:        row.checkout || '',
    nights:          Number(row.nights  || 0),
    guests:          Number(row.guests  || 2),
    total:           Number(row.total   || 0),
    accom:           Number(row.accom   || 0),
    addons:          row.addons || [],
    extraGuestTotal: Number(row.extra_guest_total || 0),
    cleaning:        Number(row.cleaning || 0),
    service:         Number(row.service  || 0),
    tax:             Number(row.tax      || 0),
    specialRequests: row.special_requests || '',
    status:          row.status          || 'confirmed',
    paymentStatus:   row.payment_status  || 'paid',
    stripeId:        row.stripe_id       || '',
    bookedAt:        row.booked_at       || new Date().toISOString(),
    notes:           row.notes           || '',
  };
}

// JS object (camelCase) → DB row (snake_case)
function toDB(obj) {
  const row = {
    id:                obj.id,
    ref:               obj.ref               || '',
    guest_name:        obj.guestName || obj.name || '',
    email:             obj.email             || '',
    phone:             obj.phone             || '',
    nights:            Number(obj.nights     || 0),
    guests:            Number(obj.guests     || 2),
    total:             Number(obj.total      || 0),
    accom:             Number(obj.accom      || 0),
    addons:            obj.addons            || [],
    extra_guest_total: Number(obj.extraGuestTotal || 0),
    cleaning:          Number(obj.cleaning   || 0),
    service:           Number(obj.service    || 0),
    tax:               Number(obj.tax        || 0),
    special_requests:  obj.specialRequests   || '',
    status:            obj.status            || 'confirmed',
    payment_status:    obj.paymentStatus     || 'paid',
    stripe_id:         obj.stripeId          || '',
    booked_at:         obj.bookedAt          || new Date().toISOString(),
    notes:             obj.notes             || '',
  };
  // Only include date fields if present (avoid storing empty strings as dates)
  if (obj.checkin)  row.checkin  = obj.checkin;
  if (obj.checkout) row.checkout = obj.checkout;
  return row;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = client();

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('bookings')
      .select('*')
      .order('booked_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data || []).map(toJS));
  }

  if (req.method === 'POST') {
    const obj = req.body || {};
    // Server-side overlap check: half-open interval [checkin, checkout)
    if (obj.checkin && obj.checkout) {
      const { data: existing, error: fetchErr } = await sb
        .from('bookings')
        .select('id, checkin, checkout, status')
        .neq('status', 'cancelled');
      if (!fetchErr && existing) {
        const ci = new Date(obj.checkin + 'T00:00:00');
        const co = new Date(obj.checkout + 'T00:00:00');
        for (const b of existing) {
          const bs = new Date((b.checkin || '') + 'T00:00:00');
          const be = new Date((b.checkout || '') + 'T00:00:00');
          if (ci < be && co > bs) {
            return res.status(409).json({ error: 'Those dates are already booked.' });
          }
        }
      }
    }
    const { data, error } = await sb
      .from('bookings')
      .insert(toDB(obj))
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(toJS(data));
  }

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { data, error } = await sb
      .from('bookings')
      .update(toDB(req.body))
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(toJS(data));
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await sb.from('bookings').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
