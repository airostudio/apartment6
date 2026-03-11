const { createClient } = require('@supabase/supabase-js');

function client() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function toJS(row) {
  return {
    id:          row.id,
    bookingRef:  row.booking_ref  || '',
    bookingId:   row.booking_id   || '',
    guestName:   row.guest_name   || '',
    guestEmail:  row.guest_email  || '',
    amount:      Number(row.amount || 0),
    status:      row.status       || 'succeeded',
    stripeId:    row.stripe_id    || '',
    method:      row.method       || 'card',
    timestamp:   row.timestamp    || new Date().toISOString(),
    errorMsg:    row.error_msg    || '',
  };
}

function toDB(obj) {
  return {
    id:          obj.id,
    booking_ref: obj.bookingRef  || '',
    booking_id:  obj.bookingId   || '',
    guest_name:  obj.guestName   || '',
    guest_email: obj.guestEmail  || '',
    amount:      Number(obj.amount || 0),
    status:      obj.status      || 'succeeded',
    stripe_id:   obj.stripeId    || '',
    method:      obj.method      || 'card',
    timestamp:   obj.timestamp   || new Date().toISOString(),
    error_msg:   obj.errorMsg    || '',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = client();

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('payments')
      .select('*')
      .order('timestamp', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data || []).map(toJS));
  }

  if (req.method === 'POST') {
    const { data, error } = await sb
      .from('payments')
      .insert(toDB(req.body))
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(toJS(data));
  }

  // DELETE with no id = clear all (admin action)
  if (req.method === 'DELETE') {
    const { error } = await sb.from('payments').delete().neq('id', '');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
