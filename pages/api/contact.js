const { Resend } = require('resend');

const FROM  = 'Cascade Apartment 6 <hello@cascade6.online>';
const TO    = 'jonah2004am@gmail.com';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, message, subject } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email and message are required' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set — contact form email NOT sent');
    return res.status(500).json({ error: 'Email service not configured', skipped: true });
  }

  const resend = new Resend(apiKey);
  const subj   = subject ? `Contact: ${subject}` : `Contact enquiry from ${name}`;

  try {
    await resend.emails.send({
      from:    FROM,
      to:      TO,
      replyTo: email,
      subject: subj,
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#0f2744">New Contact Enquiry</h2>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;width:30%">Name</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(name)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Email</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">Phone</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0">${esc(phone)}</td></tr>` : ''}
</table>
<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border-left:4px solid #0f2744">
  <p style="margin:0;white-space:pre-wrap">${esc(message)}</p>
</div>
<p style="margin-top:24px;color:#64748b;font-size:0.875rem">Sent via cascade6.online contact form</p>
</body></html>`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact email failed:', err.message);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};
