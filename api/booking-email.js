const { Resend } = require('resend');

const FROM  = 'Cascade Apartment 6 <hello@cascade6.online>';
const ADMIN = 'jonah2004am@gmail.com';

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

function adminEmailHtml(bk) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#0f2744">New Booking — ${esc(bk.ref)}</h2>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;width:40%">Guest</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(bk.name)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Email</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(bk.email)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Phone</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(bk.phone || '—')}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Check-in</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fmtDate(bk.checkin)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Check-out</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${fmtDate(bk.checkout)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Nights</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(bk.nights)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Guests</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(bk.guests)}</td></tr>
<tr><td style="padding:8px 0;font-weight:600">Total</td><td style="padding:8px 0;font-weight:700;color:#0f2744">${fmtMoney(bk.total)}</td></tr>
</table>
${bk.specialRequests ? `<p style="margin-top:16px"><strong>Special requests:</strong> ${esc(bk.specialRequests)}</p>` : ''}
<p style="margin-top:24px;color:#64748b;font-size:0.875rem">Cascade Apartment 6 · Mt Baw Baw Alpine Resort</p>
</body></html>`;
}

function guestEmailHtml(bk) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#0f2744;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
  <h1 style="color:#fff;margin:0;font-size:1.5rem">Booking Confirmed!</h1>
  <p style="color:#c9a84c;margin:8px 0 0;font-size:1.125rem;font-weight:600">Ref: ${esc(bk.ref)}</p>
</div>
<p>Hi ${esc(bk.name)},</p>
<p>Your booking at <strong>Cascade Apartment 6</strong> has been confirmed. We look forward to welcoming you!</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;background:#f8fafc;border-radius:8px;overflow:hidden">
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;width:40%">Check-in</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${fmtDate(bk.checkin)} from 3:00 PM</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">Check-out</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${fmtDate(bk.checkout)} by 11:00 AM</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">Nights</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${esc(bk.nights)}</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600">Guests</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${esc(bk.guests)}</td></tr>
<tr><td style="padding:12px 16px;font-weight:600">Total Paid</td><td style="padding:12px 16px;font-weight:700;color:#0f2744">${fmtMoney(bk.total)}</td></tr>
</table>
<div style="background:#fff8ec;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-top:24px">
  <p style="margin:0;font-weight:600">Important: BYO linen &amp; towels</p>
  <p style="margin:8px 0 0;font-size:0.875rem">Pillows and doonas are supplied for all beds. Please bring your own linen and towels.</p>
</div>
<p style="margin-top:24px">If you have any questions, please email us at <a href="mailto:hello@cascade6.online" style="color:#0f2744">hello@cascade6.online</a></p>
<p style="color:#64748b;font-size:0.875rem;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px">Cascade Apartment 6 · Mt Baw Baw Alpine Resort, VIC 3833 · <a href="https://www.cascade6.online" style="color:#64748b">cascade6.online</a></p>
</body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const bk = req.body;
  if (!bk || !bk.ref) return res.status(400).json({ error: 'Missing booking data' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set — booking email NOT sent for', bk.ref);
    return res.status(500).json({ error: 'Email service not configured', skipped: true });
  }

  const resend = new Resend(apiKey);
  const results = { admin: null, guest: null };

  // Admin notification
  try {
    await resend.emails.send({
      from:    FROM,
      to:      ADMIN,
      replyTo: bk.email || FROM,
      subject: `New booking ${bk.ref} — ${bk.name}`,
      html:    adminEmailHtml(bk),
    });
    results.admin = 'sent';
  } catch (err) {
    console.error('Admin email failed:', err.message);
    results.admin = 'failed';
  }

  // Guest confirmation
  if (bk.email) {
    try {
      await resend.emails.send({
        from:    FROM,
        to:      bk.email,
        replyTo: 'hello@cascade6.online',
        subject: `Booking confirmed — ${bk.ref}`,
        html:    guestEmailHtml(bk),
      });
      results.guest = 'sent';
    } catch (err) {
      console.error('Guest email failed:', err.message);
      results.guest = 'failed';
    }
  }

  return res.status(200).json({ ok: true, results });
};
