const { createClient } = require('@supabase/supabase-js');
const { validRange, findConflict, refreshExternal } = require('../../lib/availability');

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

const CONFLICT_MSG = 'Sorry, those dates are no longer available.';

// A guest who paid for dates that were taken in the meantime must not keep
// being charged. Refund the PaymentIntent, but only when it is a genuine
// succeeded payment made for exactly these dates and not yet tied to a booking.
async function refundIfPaid(sb, obj) {
  const piId = obj.stripeId;
  if (!piId || !/^pi_/.test(piId) || !process.env.STRIPE_SECRET_KEY) return false;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { data: used } = await sb.from('bookings').select('id').eq('stripe_id', piId).limit(1);
    if (used && used.length) return false;
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (pi.status !== 'succeeded') return false;
    if (pi.metadata.checkin !== obj.checkin || pi.metadata.checkout !== obj.checkout) return false;
    await stripe.refunds.create({ payment_intent: piId, reason: 'duplicate', metadata: { cause: 'dates_no_longer_available' } });
    return true;
  } catch (err) {
    console.error('Auto-refund failed for', piId, err.message);
    return false;
  }
}

async function conflictResponse(sb, obj, res) {
  const refunded = await refundIfPaid(sb, obj);
  return res.status(409).json({
    error: refunded ? CONFLICT_MSG + ' Your payment has been refunded.' : CONFLICT_MSG,
    refunded,
  });
}

module.exports = async function handler(req, res) {
  // /api/availability is rewritten here (vercel.json) to stay within the function limit.
  if (req.query && req.query.action === 'availability') return require('../../lib/availability-endpoint')(req, res);
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
    const active = obj.status !== 'cancelled';
    if (active && !validRange(obj.checkin, obj.checkout)) {
      return res.status(400).json({ error: 'Valid check-in and check-out dates are required.' });
    }

    // A retried save of an already-recorded payment is not a conflict with itself.
    if (obj.stripeId) {
      const { data: dup } = await sb.from('bookings').select('*').eq('stripe_id', obj.stripeId).limit(1);
      if (dup && dup.length) return res.status(200).json(toJS(dup[0]));
    }

    if (active) {
      try {
        await refreshExternal(sb, 2 * 60 * 1000);
        if (await findConflict(sb, obj.checkin, obj.checkout)) return conflictResponse(sb, obj, res);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
    const { data, error } = await sb
      .from('bookings')
      .insert(toDB(obj))
      .select()
      .single();
    // 23P01 = exclusion_violation: the database-level guard caught a race.
    if (error && error.code === '23P01') return conflictResponse(sb, obj, res);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(toJS(data));
  }

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });

    // Merge onto the stored booking so partial updates (e.g. just a status
    // change) don't blank every other field.
    const { data: existing, error: getErr } = await sb.from('bookings').select('*').eq('id', id).single();
    if (getErr || !existing) return res.status(404).json({ error: 'Booking not found' });
    const merged = Object.assign(toJS(existing), req.body || {}, { id });

    if (merged.status !== 'cancelled') {
      if (!validRange(merged.checkin, merged.checkout)) {
        return res.status(400).json({ error: 'Valid check-in and check-out dates are required.' });
      }
      try {
        if (await findConflict(sb, merged.checkin, merged.checkout, id)) {
          return res.status(409).json({ error: CONFLICT_MSG });
        }
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
    const { data, error } = await sb
      .from('bookings')
      .update(toDB(merged))
      .eq('id', id)
      .select()
      .single();
    if (error && error.code === '23P01') return res.status(409).json({ error: CONFLICT_MSG });
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
