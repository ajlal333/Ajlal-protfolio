const DEFAULT_TO_EMAIL = 'ajlalgoraya333@gmail.com';

function clean(value, maxLength = 1200) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br />');
}

function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = parseBody(req);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (clean(body.companyFax)) {
    return res.status(200).json({ ok: true });
  }

  const lead = {
    name: clean(body.name, 140),
    email: clean(body.email, 180),
    company: clean(body.company, 180),
    website: clean(body.website, 220),
    service: clean(body.service, 180),
    callWindow: clean(body.callWindow, 220),
    message: clean(body.message, 2400),
  };

  const requiredFields = ['name', 'email', 'company', 'service', 'callWindow', 'message'];
  const missingFields = requiredFields.filter((field) => !lead[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      fields: missingFields,
    });
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return res.status(503).json({ error: 'Email service is not configured' });
  }

  const toEmail = process.env.BOOKING_TO_EMAIL || DEFAULT_TO_EMAIL;
  const fromEmail = process.env.BOOKING_FROM_EMAIL || 'Ajlal AI <onboarding@resend.dev>';
  const subject = `New AI strategy call request: ${lead.company}`;
  const text = [
    'New AI strategy call request',
    '',
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company}`,
    `Website: ${lead.website || 'Not provided'}`,
    `AI need: ${lead.service}`,
    `Preferred call window: ${lead.callWindow}`,
    '',
    'Workflow details:',
    lead.message,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #181818; line-height: 1.6;">
      <h2>New AI strategy call request</h2>
      <p><strong>Name:</strong> ${escapeHtml(lead.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(lead.company)}</p>
      <p><strong>Website:</strong> ${escapeHtml(lead.website || 'Not provided')}</p>
      <p><strong>AI need:</strong> ${escapeHtml(lead.service)}</p>
      <p><strong>Preferred call window:</strong> ${escapeHtml(lead.callWindow)}</p>
      <h3>Workflow details</h3>
      <p>${escapeHtml(lead.message)}</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      reply_to: lead.email,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return res.status(502).json({
      error: 'Unable to send email',
      details: errorText,
    });
  }

  return res.status(200).json({ ok: true });
}
