const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const FROM = 'Cascade Apartment 6 <hello@cascade6.online>';

const BUSINESS = {
  name:     'Cascade Apartment 6 Pty Ltd',
  abn:      '12 345 678 901',
  address:  'Level 5, 123 George Street',
  city:     'Sydney',
  state:    'NSW',
  postcode: '2000',
  phone:    '+61 2 9876 5400',
  email:    'hello@cascade6.online',
};

function client() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function requireAdmin(req, res) {
  const key = process.env.ADMIN_KEY;
  if (key && req.headers['x-admin-key'] !== key) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function toJS(row) {
  return {
    id:              row.id,
    ref:             row.ref || '',
    name:            row.guest_name || '',
    email:           row.email || '',
    phone:           row.phone || '',
    checkin:         row.checkin  || '',
    checkout:        row.checkout || '',
    nights:          Number(row.nights || 0),
    guests:          Number(row.guests || 2),
    total:           Number(row.total  || 0),
    accom:           Number(row.accom  || 0),
    addons:          row.addons || [],
    extraGuestTotal: Number(row.extra_guest_total || 0),
    cleaning:        Number(row.cleaning || 0),
    service:         Number(row.service  || 0),
    tax:             Number(row.tax      || 0),
    status:          row.status         || 'confirmed',
    paymentStatus:   row.payment_status || 'paid',
    bookedAt:        row.booked_at      || new Date().toISOString(),
  };
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function addonLines(addons) {
  if (!Array.isArray(addons)) return [];
  return addons.map(function (a) {
    if (a && typeof a === 'object') {
      return { label: a.name || a.label || 'Add-on', amount: Number(a.price || a.amount || 0) };
    }
    return { label: String(a), amount: 0 };
  }).filter(function (a) { return a.amount > 0; });
}

function invoiceNumber(bk) {
  return 'INV-' + (bk.ref || bk.id || '').toString().replace(/[^A-Za-z0-9-]/g, '');
}

function lineRow(label, amount) {
  return '<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">' + esc(label) + '</td>' +
    '<td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">' + fmtMoney(amount) + '</td></tr>';
}

function invoiceHtml(bk) {
  const num = invoiceNumber(bk);
  const subtotal = Math.max(0, Number(bk.total || 0) - Number(bk.tax || 0));
  const rows = [];
  rows.push(lineRow('Accommodation — ' + fmtDate(bk.checkin) + ' to ' + fmtDate(bk.checkout) + ' (' + bk.nights + ' night' + (bk.nights === 1 ? '' : 's') + ')', bk.accom));
  addonLines(bk.addons).forEach(function (a) { rows.push(lineRow(a.label, a.amount)); });
  if (bk.extraGuestTotal) rows.push(lineRow('Extra guest fee', bk.extraGuestTotal));
  if (bk.cleaning) rows.push(lineRow('Cleaning fee', bk.cleaning));
  if (bk.service) rows.push(lineRow('Service fee', bk.service));

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;max-width:640px;margin:0 auto;padding:20px">
<div style="background:#0f2744;padding:24px;border-radius:12px 12px 0 0;">
  <h1 style="color:#fff;margin:0;font-size:1.375rem;">Tax Invoice</h1>
  <p style="color:#c9a84c;margin:6px 0 0;font-size:1rem;font-weight:600;">${esc(num)}</p>
</div>
<div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="vertical-align:top;width:50%;">
        <p style="margin:0 0 4px;font-weight:700;color:#0f2744;">${esc(BUSINESS.name)}</p>
        <p style="margin:0;font-size:0.875rem;color:#475569;line-height:1.5;">
          ABN ${esc(BUSINESS.abn)}<br>
          ${esc(BUSINESS.address)}<br>
          ${esc(BUSINESS.city)} ${esc(BUSINESS.state)} ${esc(BUSINESS.postcode)}<br>
          ${esc(BUSINESS.phone)}
        </p>
      </td>
      <td style="vertical-align:top;width:50%;text-align:right;">
        <p style="margin:0 0 4px;font-size:0.875rem;color:#475569;">Invoice date: ${fmtDate(new Date().toISOString().slice(0, 10))}</p>
        <p style="margin:0 0 4px;font-size:0.875rem;color:#475569;">Booking ref: ${esc(bk.ref || bk.id)}</p>
        <p style="margin:0;font-size:0.875rem;color:#475569;">Status: ${esc(bk.paymentStatus)}</p>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 4px;font-weight:600;color:#0f2744;">Billed to</p>
  <p style="margin:0 0 24px;font-size:0.875rem;color:#475569;line-height:1.5;">
    ${esc(bk.name)}<br>
    ${esc(bk.email)}${bk.phone ? '<br>' + esc(bk.phone) : ''}
  </p>

  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left;padding:8px 0;border-bottom:2px solid #0f2744;font-size:0.8125rem;color:#0f2744;">Description</th>
        <th style="text-align:right;padding:8px 0;border-bottom:2px solid #0f2744;font-size:0.8125rem;color:#0f2744;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join('')}
    </tbody>
    <tfoot>
      <tr><td style="padding:10px 0 4px;text-align:right;">Subtotal</td><td style="padding:10px 0 4px;text-align:right;">${fmtMoney(subtotal)}</td></tr>
      <tr><td style="padding:4px 0;text-align:right;">GST (10%)</td><td style="padding:4px 0;text-align:right;">${fmtMoney(bk.tax)}</td></tr>
      <tr><td style="padding:10px 0;text-align:right;font-weight:700;font-size:1.05rem;border-top:2px solid #0f2744;">Total (incl. GST)</td><td style="padding:10px 0;text-align:right;font-weight:700;font-size:1.05rem;color:#0f2744;border-top:2px solid #0f2744;">${fmtMoney(bk.total)}</td></tr>
    </tfoot>
  </table>

  <p style="margin-top:24px;font-size:0.8125rem;color:#94a3b8;">This is a tax invoice for GST purposes. Prices are in Australian Dollars (AUD) and include GST where applicable.</p>
</div>
<p style="margin-top:20px;color:#64748b;font-size:0.8125rem;text-align:center;">${esc(BUSINESS.name)} · ${esc(BUSINESS.email)}</p>
</body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const id = req.method === 'GET' ? req.query.id : req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'Booking id required' });

  const sb = client();
  const { data, error } = await sb.from('bookings').select('*').eq('id', id).single();
  if (error || !data) return res.status(404).json({ error: 'Booking not found' });

  const bk = toJS(data);

  // Preview only — return the rendered invoice without sending anything.
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, invoiceNumber: invoiceNumber(bk), html: invoiceHtml(bk), sentTo: bk.email });
  }

  if (!bk.email) return res.status(400).json({ error: 'Booking has no email address' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' });

  const resend = new Resend(apiKey);
  const num = invoiceNumber(bk);

  try {
    await resend.emails.send({
      from:    FROM,
      to:      bk.email,
      replyTo: BUSINESS.email,
      subject: `Tax Invoice ${num} — ${BUSINESS.name}`,
      html:    invoiceHtml(bk),
    });
  } catch (err) {
    console.error('Tax invoice email failed:', err.message);
    return res.status(502).json({ error: 'Failed to send invoice email' });
  }

  return res.status(200).json({ ok: true, invoiceNumber: num, sentTo: bk.email });
};
