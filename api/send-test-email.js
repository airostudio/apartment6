const { Resend } = require('resend');

const FROM  = 'Cascade Apartment 6 <hello@cascade6.online>';
const ADMIN = 'jonah2004am@gmail.com';

const TEST_BOOKING = {
  ref:             'CA6-TEST-001',
  name:            'Test Guest',
  email:           'typhoon.tall69@gmail.com',
  phone:           '+61 400 000 000',
  checkin:         '2026-08-01',
  checkout:        '2026-08-04',
  nights:          3,
  guests:          4,
  accom:           1800,
  cleaning:        60,
  service:         50,
  tax:             191,
  total:           2101,
  specialRequests: 'This is a test booking — no action required.',
  addons:          [],
};

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function adminHtml(bk) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:0.875rem;color:#92400e;">
  <strong>TEST EMAIL</strong> — This is a system test. No real booking has been made.
</div>
<h2 style="color:#0f2744">New Booking — ${esc(bk.ref)}</h2>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;width:40%">Guest</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(bk.name)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Email</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(bk.email)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Phone</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(bk.phone || '—')}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Check-in</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fmtDate(bk.checkin)} from 3:00 PM</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Check-out</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fmtDate(bk.checkout)} by 11:00 AM</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Nights</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${bk.nights}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Guests</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${bk.guests}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Accommodation</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fmtMoney(bk.accom)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Cleaning Fee</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fmtMoney(bk.cleaning)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Service Fee</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fmtMoney(bk.service)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">GST (10%)</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fmtMoney(bk.tax)}</td></tr>
<tr><td style="padding:8px 0;font-weight:600">Total</td><td style="padding:8px 0;font-weight:700;color:#0f2744">${fmtMoney(bk.total)}</td></tr>
</table>
<p style="margin-top:24px;color:#64748b;font-size:0.875rem">Cascade Apartment 6 · Mt Baw Baw Alpine Resort</p>
</body></html>`;
}

function guestHtml(bk) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:0.875rem;color:#92400e;">
  <strong>TEST EMAIL</strong> — This is a system test. No real booking has been made.
</div>
<div style="background:#0f2744;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
  <h1 style="color:#fff;margin:0;font-size:1.5rem">Booking Confirmed!</h1>
  <p style="color:#c9a84c;margin:8px 0 0;font-size:1.125rem;font-weight:600">Ref: ${esc(bk.ref)}</p>
</div>
<p>Hi ${esc(bk.name)},</p>
<p>Your booking at <strong>Cascade Apartment 6</strong> has been confirmed. We look forward to welcoming you!</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;background:#f8fafc;border-radius:8px;overflow:hidden">
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;width:40%">Check-in</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${fmtDate(bk.checkin)} from 3:00 PM</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">Check-out</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${fmtDate(bk.checkout)} by 11:00 AM</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">Nights</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${bk.nights}</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">Guests</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${bk.guests}</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">Accommodation</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${fmtMoney(bk.accom)}</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">Cleaning Fee</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${fmtMoney(bk.cleaning)}</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">Service Fee</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${fmtMoney(bk.service)}</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">GST (10%)</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${fmtMoney(bk.tax)}</td></tr>
<tr><td style="padding:12px 16px;font-weight:600">Total Paid</td><td style="padding:12px 16px;font-weight:700;color:#0f2744">${fmtMoney(bk.total)}</td></tr>
</table>
<div style="background:#fff8ec;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-top:24px">
  <p style="margin:0;font-weight:600">Important: BYO linen &amp; towels</p>
  <p style="margin:8px 0 0;font-size:0.875rem">Pillows, doonas and blankets are supplied for all beds. Please bring your own linen (fitted sheets, pillowcases) and towels for each guest.</p>
</div>
<p style="margin-top:24px">Questions? Email us at <a href="mailto:hello@cascade6.online" style="color:#0f2744">hello@cascade6.online</a></p>
<p style="color:#64748b;font-size:0.875rem;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px">Cascade Apartment 6 · Mt Baw Baw Alpine Resort, VIC 3833 · <a href="https://www.cascade6.online" style="color:#64748b">cascade6.online</a></p>
</body></html>`;
}

function contactTestHtml(to) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:0.875rem;color:#92400e;">
  <strong>TEST EMAIL</strong> — This is a contact form test. No action required.
</div>
<h2 style="color:#0f2744">Contact Form Test</h2>
<p>This email confirms the contact form is correctly routing messages to <strong>${esc(to)}</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;width:30%">Name</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">Test User</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Email</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">test@cascade6.online</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Subject</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">Email routing test</td></tr>
</table>
<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border-left:4px solid #0f2744">
  <p style="margin:0">If you received this email, the contact form is working correctly. Emails from cascade6.online display as <em>hello@cascade6.online</em> and deliver to this inbox.</p>
</div>
<p style="margin-top:24px;color:#64748b;font-size:0.875rem">Sent via cascade6.online · system test</p>
</body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Require admin key if set
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured in environment variables' });
  }

  const resend = new Resend(apiKey);
  const results = [];
  const SECOND_RECIPIENT = 'typhoon.tall69@gmail.com';

  // 1. Admin booking notification → jonah2004am@gmail.com
  try {
    await resend.emails.send({
      from:    FROM,
      to:      ADMIN,
      subject: `[TEST] New booking ${TEST_BOOKING.ref} — ${TEST_BOOKING.name}`,
      html:    adminHtml(TEST_BOOKING),
    });
    results.push({ to: ADMIN, type: 'booking-admin', status: 'sent' });
  } catch (err) {
    results.push({ to: ADMIN, type: 'booking-admin', status: 'failed', error: err.message });
  }

  // 2. Guest booking confirmation → typhoon.tall69@gmail.com
  try {
    await resend.emails.send({
      from:    FROM,
      to:      SECOND_RECIPIENT,
      subject: `[TEST] Booking confirmed — ${TEST_BOOKING.ref}`,
      html:    guestHtml(TEST_BOOKING),
    });
    results.push({ to: SECOND_RECIPIENT, type: 'booking-guest', status: 'sent' });
  } catch (err) {
    results.push({ to: SECOND_RECIPIENT, type: 'booking-guest', status: 'failed', error: err.message });
  }

  // 3. Contact form test → jonah2004am@gmail.com
  try {
    await resend.emails.send({
      from:    FROM,
      to:      ADMIN,
      subject: '[TEST] Contact form — email routing check',
      html:    contactTestHtml(ADMIN),
    });
    results.push({ to: ADMIN, type: 'contact-form', status: 'sent' });
  } catch (err) {
    results.push({ to: ADMIN, type: 'contact-form', status: 'failed', error: err.message });
  }

  // 4. Contact form test → typhoon.tall69@gmail.com
  try {
    await resend.emails.send({
      from:    FROM,
      to:      SECOND_RECIPIENT,
      subject: '[TEST] Contact form — email routing check',
      html:    contactTestHtml(SECOND_RECIPIENT),
    });
    results.push({ to: SECOND_RECIPIENT, type: 'contact-form', status: 'sent' });
  } catch (err) {
    results.push({ to: SECOND_RECIPIENT, type: 'contact-form', status: 'failed', error: err.message });
  }

  const allSent = results.every(r => r.status === 'sent');
  return res.status(200).json({ ok: allSent, results });
};
