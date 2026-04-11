const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  try {
    await resend.emails.send({
      from: 'Cascade Apartment 6 <hello@cascade6.online>',
      to: 'hello@cascade6.online',
      replyTo: email,
      subject: `Contact enquiry from ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a3a5c;">New Contact Enquiry</h2>
          <table style="width:100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; width: 100px;">Name:</td>
              <td style="padding: 8px 0;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
            </tr>
            ${phone ? `<tr>
              <td style="padding: 8px 0; font-weight: 600;">Phone:</td>
              <td style="padding: 8px 0;">${escapeHtml(phone)}</td>
            </tr>` : ''}
          </table>
          <hr style="margin: 16px 0; border: none; border-top: 1px solid #e2e8f0;">
          <h3 style="color: #1a3a5c;">Message</h3>
          <p style="white-space: pre-wrap; color: #374151;">${escapeHtml(message)}</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #9ca3af;">Sent from the Cascade Apartment 6 website contact form.</p>
        </div>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
