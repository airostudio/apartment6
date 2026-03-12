const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM  = 'Cascade Apartment 6 <hello@cascade6.com.au>';
const ADMIN = 'hello@cascade6.com.au';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const bk = req.body || {};
  const errors = [];

  // ── Admin notification ─────────────────────────────────────────────────────
  try {
    await resend.emails.send({
      from:    FROM,
      to:      ADMIN,
      subject: `New Booking ${bk.ref || ''} — ${bk.guestName || 'Guest'} (${fmtDate(bk.checkin)} – ${fmtDate(bk.checkout)})`,
      html: `
<div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1f2937">
  <div style="background:#1a3a5c;padding:24px 32px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:#fff;font-size:22px">New Booking Confirmed</h1>
    <p style="margin:4px 0 0;color:#93c5fd;font-size:14px">Cascade Apartment 6 · ${bk.ref || ''}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 32px;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 16px;font-size:16px;color:#1a3a5c">Guest Details</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#6b7280;width:140px">Name</td><td style="padding:6px 0;font-weight:600">${esc(bk.guestName || bk.name || '')}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0"><a href="mailto:${esc(bk.email)}" style="color:#2563eb">${esc(bk.email || '')}</a></td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Phone</td><td style="padding:6px 0">${esc(bk.phone || '—')}</td></tr>
    </table>
    <h2 style="margin:20px 0 16px;font-size:16px;color:#1a3a5c">Stay Details</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#6b7280;width:140px">Check-in</td><td style="padding:6px 0;font-weight:600">${fmtDate(bk.checkin)} (from 3:00 PM)</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Check-out</td><td style="padding:6px 0;font-weight:600">${fmtDate(bk.checkout)} (by 11:00 AM)</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Nights</td><td style="padding:6px 0">${bk.nights || ''}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Guests</td><td style="padding:6px 0">${bk.guests || ''}</td></tr>
      ${bk.specialRequests ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Requests</td><td style="padding:6px 0">${esc(bk.specialRequests)}</td></tr>` : ''}
    </table>
    <h2 style="margin:20px 0 16px;font-size:16px;color:#1a3a5c">Payment Summary</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 0;color:#6b7280">Accommodation</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.accom)}</td></tr>
      ${bk.extraGuestTotal > 0 ? `<tr><td style="padding:4px 0;color:#6b7280">Extra guests</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.extraGuestTotal)}</td></tr>` : ''}
      ${(bk.addons || []).map(a => `<tr><td style="padding:4px 0;color:#6b7280">${esc(a.label || a.name || '')}</td><td style="padding:4px 0;text-align:right">${fmtMoney(a.amount || a.price || 0)}</td></tr>`).join('')}
      ${bk.cleaning > 0 ? `<tr><td style="padding:4px 0;color:#6b7280">Cleaning fee</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.cleaning)}</td></tr>` : ''}
      ${bk.service > 0 ? `<tr><td style="padding:4px 0;color:#6b7280">Service fee</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.service)}</td></tr>` : ''}
      ${bk.tax > 0 ? `<tr><td style="padding:4px 0;color:#6b7280">GST</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.tax)}</td></tr>` : ''}
      <tr style="border-top:2px solid #e5e7eb">
        <td style="padding:8px 0;font-weight:700;font-size:15px">Total Paid</td>
        <td style="padding:8px 0;font-weight:700;font-size:15px;text-align:right;color:#1a3a5c">${fmtMoney(bk.total)}</td>
      </tr>
    </table>
    ${bk.stripeId ? `<p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Stripe Payment ID: ${esc(bk.stripeId)}</p>` : ''}
  </div>
</div>`,
    });
  } catch (err) {
    console.error('Admin email failed:', err);
    errors.push('admin: ' + err.message);
  }

  // ── Guest confirmation ─────────────────────────────────────────────────────
  const guestEmail = bk.email || '';
  if (guestEmail) {
    try {
      await resend.emails.send({
        from:    FROM,
        to:      guestEmail,
        subject: `Booking Confirmed — ${bk.ref || ''} · Cascade Apartment 6`,
        html: `
<div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1f2937">
  <div style="background:#1a3a5c;padding:24px 32px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;color:#fff;font-size:22px">You're all booked!</h1>
    <p style="margin:4px 0 0;color:#93c5fd;font-size:14px">Cascade Apartment 6 · Mt Baw Baw, Victoria</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 32px;border-radius:0 0 8px 8px">
    <p style="margin:0 0 20px;font-size:15px">Hi ${esc(bk.guestName || bk.name || 'there')}, your booking is confirmed. We look forward to hosting you!</p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px 20px;margin:0 0 20px">
      <p style="margin:0;font-size:13px;color:#0369a1;font-weight:600">BOOKING REFERENCE</p>
      <p style="margin:4px 0 0;font-size:26px;font-weight:700;letter-spacing:2px;color:#1a3a5c">${esc(bk.ref || '')}</p>
    </div>
    <h2 style="margin:0 0 12px;font-size:16px;color:#1a3a5c">Your Stay</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border-radius:6px 0 0 0">
          <div style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Check-in</div>
          <div style="font-weight:700;font-size:15px;margin-top:2px">${fmtDate(bk.checkin)}</div>
          <div style="color:#6b7280;font-size:12px">From 3:00 PM</div>
        </td>
        <td style="padding:8px 12px;background:#f0fdf4;border-radius:0 6px 6px 0;border-left:2px solid #bbf7d0">
          <div style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Check-out</div>
          <div style="font-weight:700;font-size:15px;margin-top:2px">${fmtDate(bk.checkout)}</div>
          <div style="color:#6b7280;font-size:12px">By 11:00 AM</div>
        </td>
      </tr>
    </table>
    <p style="margin:10px 0 20px;font-size:13px;color:#6b7280">${bk.nights || ''} night${bk.nights !== 1 ? 's' : ''} · ${bk.guests || ''} guest${bk.guests !== 1 ? 's' : ''}</p>
    <h2 style="margin:0 0 12px;font-size:16px;color:#1a3a5c">Price Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 0;color:#6b7280">Accommodation</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.accom)}</td></tr>
      ${bk.extraGuestTotal > 0 ? `<tr><td style="padding:4px 0;color:#6b7280">Extra guests</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.extraGuestTotal)}</td></tr>` : ''}
      ${(bk.addons || []).map(a => `<tr><td style="padding:4px 0;color:#6b7280">${esc(a.label || a.name || '')}</td><td style="padding:4px 0;text-align:right">${fmtMoney(a.amount || a.price || 0)}</td></tr>`).join('')}
      ${bk.cleaning > 0 ? `<tr><td style="padding:4px 0;color:#6b7280">Cleaning fee</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.cleaning)}</td></tr>` : ''}
      ${bk.service > 0 ? `<tr><td style="padding:4px 0;color:#6b7280">Service fee</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.service)}</td></tr>` : ''}
      ${bk.tax > 0 ? `<tr><td style="padding:4px 0;color:#6b7280">GST</td><td style="padding:4px 0;text-align:right">${fmtMoney(bk.tax)}</td></tr>` : ''}
      <tr style="border-top:2px solid #e5e7eb">
        <td style="padding:8px 0;font-weight:700;font-size:15px">Total Paid</td>
        <td style="padding:8px 0;font-weight:700;font-size:15px;text-align:right;color:#1a3a5c">${fmtMoney(bk.total)}</td>
      </tr>
    </table>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin:20px 0">
      <p style="margin:0;font-size:13px;color:#92400e;font-weight:600">Property Access</p>
      <p style="margin:6px 0 0;font-size:13px;color:#78350f">Access details will be provided before your arrival. If you have any questions, contact us at <a href="mailto:hello@cascade6.com.au" style="color:#b45309">hello@cascade6.com.au</a></p>
    </div>
    ${bk.specialRequests ? `<p style="font-size:13px;color:#6b7280"><strong>Your special requests:</strong><br>${esc(bk.specialRequests)}</p>` : ''}
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">Cascade Apartment 6 · Mt Baw Baw Alpine Resort, Victoria · <a href="mailto:hello@cascade6.com.au" style="color:#9ca3af">hello@cascade6.com.au</a></p>
  </div>
</div>`,
      });
    } catch (err) {
      console.error('Guest email failed:', err);
      errors.push('guest: ' + err.message);
    }
  }

  if (errors.length === 2 || (errors.length === 1 && !guestEmail)) {
    return res.status(500).json({ error: errors.join('; ') });
  }
  return res.status(200).json({ ok: true, errors: errors.length ? errors : undefined });
};

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
