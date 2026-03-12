const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM    = 'Cascade Apartment 6 <hello@cascade6.com.au>';
const ADMIN   = 'mtbawbawcascade6@gmail.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const bk = req.body || {};
  const {
    ref, guestName, email, phone, checkin, checkout,
    nights, guests, total, accom, cleaning, service, tax,
    addons, specialRequests, stripeId,
  } = bk;

  if (!ref || !email) {
    return res.status(400).json({ error: 'ref and email are required' });
  }

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const fmtMoney = (n) => `$${Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const addonsHtml = Array.isArray(addons) && addons.length
    ? addons.map(a => `<tr><td style="padding:6px 0;color:#64748b;">${esc(a.label || a.name || 'Add-on')}</td><td style="padding:6px 0;text-align:right;">${fmtMoney(a.price)}</td></tr>`).join('')
    : '';

  // ── Admin notification ──────────────────────────────────────────────────────
  const adminHtml = `
    <div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1a2b40;">
      <div style="background:#0f2744;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:1.25rem;">New Booking Confirmed</h1>
        <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:0.875rem;">Ref #${esc(ref)}</p>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px 0;font-weight:600;width:140px;">Guest</td><td style="padding:8px 0;">${esc(guestName)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Email</td><td style="padding:8px 0;"><a href="mailto:${esc(email)}" style="color:#0f2744;">${esc(email)}</a></td></tr>
          ${phone ? `<tr><td style="padding:8px 0;font-weight:600;">Phone</td><td style="padding:8px 0;">${esc(phone)}</td></tr>` : ''}
          <tr><td style="padding:8px 0;font-weight:600;">Check-in</td><td style="padding:8px 0;">${fmtDate(checkin)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Check-out</td><td style="padding:8px 0;">${fmtDate(checkout)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Nights</td><td style="padding:8px 0;">${esc(nights)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Guests</td><td style="padding:8px 0;">${esc(guests)}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#64748b;">Accommodation (${esc(nights)} night${nights===1?'':'s'})</td><td style="padding:6px 0;text-align:right;">${fmtMoney(accom)}</td></tr>
          ${addonsHtml}
          <tr><td style="padding:6px 0;color:#64748b;">Cleaning fee</td><td style="padding:6px 0;text-align:right;">${fmtMoney(cleaning)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Service fee</td><td style="padding:6px 0;text-align:right;">${fmtMoney(service)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">GST</td><td style="padding:6px 0;text-align:right;">${fmtMoney(tax)}</td></tr>
          <tr style="font-weight:700;font-size:1rem;border-top:2px solid #0f2744;">
            <td style="padding:10px 0;">Total paid</td>
            <td style="padding:10px 0;text-align:right;color:#0f2744;">${fmtMoney(total)}</td>
          </tr>
        </table>
        ${specialRequests ? `<div style="margin-top:16px;padding:12px 16px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;"><strong>Special requests:</strong><br><span style="color:#64748b;">${esc(specialRequests)}</span></div>` : ''}
        <p style="margin-top:20px;font-size:0.75rem;color:#94a3b8;">Stripe ID: ${esc(stripeId || '—')}</p>
      </div>
    </div>`;

  // ── Guest confirmation ──────────────────────────────────────────────────────
  const guestHtml = `
    <div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1a2b40;">
      <div style="background:#0f2744;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:1.4rem;">Booking Confirmed!</h1>
        <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:0.9rem;">Thank you, ${esc(guestName)}. We can't wait to welcome you.</p>
      </div>
      <div style="background:#f8fafc;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
        <div style="background:#fff;border-radius:10px;border:1px solid #e2e8f0;padding:20px 24px;margin-bottom:20px;">
          <p style="margin:0 0 4px;font-size:0.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Booking Reference</p>
          <p style="margin:0;font-size:1.5rem;font-weight:700;color:#0f2744;letter-spacing:0.05em;">#${esc(ref)}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
              <span style="font-size:0.75rem;color:#94a3b8;display:block;">Check-in</span>
              <strong>${fmtDate(checkin)}</strong><br>
              <span style="font-size:0.85rem;color:#64748b;">from 3:00 PM</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
              <span style="font-size:0.75rem;color:#94a3b8;display:block;">Check-out</span>
              <strong>${fmtDate(checkout)}</strong><br>
              <span style="font-size:0.85rem;color:#64748b;">by 11:00 AM</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <span style="font-size:0.75rem;color:#94a3b8;display:block;">Guests</span>
              <strong>${esc(nights)} night${nights===1?'':'s'} · ${esc(guests)} guest${guests===1?'':'s'}</strong>
            </td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:5px 0;color:#64748b;font-size:0.875rem;">Accommodation</td><td style="padding:5px 0;text-align:right;font-size:0.875rem;">${fmtMoney(accom)}</td></tr>
          ${addonsHtml}
          <tr><td style="padding:5px 0;color:#64748b;font-size:0.875rem;">Cleaning fee</td><td style="padding:5px 0;text-align:right;font-size:0.875rem;">${fmtMoney(cleaning)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;font-size:0.875rem;">Service fee</td><td style="padding:5px 0;text-align:right;font-size:0.875rem;">${fmtMoney(service)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;font-size:0.875rem;">GST</td><td style="padding:5px 0;text-align:right;font-size:0.875rem;">${fmtMoney(tax)}</td></tr>
          <tr style="font-weight:700;border-top:2px solid #0f2744;">
            <td style="padding:10px 0;">Total paid</td>
            <td style="padding:10px 0;text-align:right;color:#0f2744;">${fmtMoney(total)}</td>
          </tr>
        </table>
        <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:0.875rem;">
          <strong>Property access &amp; directions:</strong><br>
          <span style="color:#64748b;">We'll be in touch closer to your check-in with access codes and directions to Cascade Apartment 6 at Mt Baw Baw Alpine Resort.</span>
        </div>
        <p style="font-size:0.875rem;color:#64748b;margin:0;">Questions? Reply to this email or contact us at <a href="mailto:hello@cascade6.com.au" style="color:#0f2744;">hello@cascade6.com.au</a></p>
      </div>
    </div>`;

  const errors = [];

  // Send admin notification
  try {
    await resend.emails.send({
      from:    FROM,
      to:      ADMIN,
      replyTo: email,
      subject: `New booking #${ref} — ${guestName} (${checkin} → ${checkout})`,
      html:    adminHtml,
    });
  } catch (err) {
    console.error('Admin email error:', err);
    errors.push('admin: ' + (err.message || err));
  }

  // Send guest confirmation
  try {
    await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: `Booking confirmed #${ref} — Cascade Apartment 6`,
      html:    guestHtml,
    });
  } catch (err) {
    console.error('Guest email error:', err);
    errors.push('guest: ' + (err.message || err));
  }

  if (errors.length === 2) {
    return res.status(500).json({ error: 'Both emails failed', details: errors });
  }
  return res.status(200).json({ ok: true, errors: errors.length ? errors : undefined });
};
