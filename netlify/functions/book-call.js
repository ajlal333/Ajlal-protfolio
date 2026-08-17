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

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        Allow: 'POST',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (clean(body.companyFax)) {
    return json(200, { ok: true });
  }

  const lead = {
    name: clean(body.name, 140),
    email: clean(body.email, 180),
    company: clean(body.company, 180),
    website: clean(body.website, 220),
    service: clean(body.service, 180) || 'LogicFolds project inquiry',
    callWindow: clean(body.callWindow, 220),
    message: clean(body.message, 2400),
  };

  const requiredFields = ['name', 'email', 'message'];
  const missingFields = requiredFields.filter((field) => !lead[field]);

  if (missingFields.length > 0) {
    return json(400, {
      error: 'Missing required fields',
      fields: missingFields,
    });
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return json(503, { error: 'Email service is not configured' });
  }

  const toEmail = process.env.BOOKING_TO_EMAIL || DEFAULT_TO_EMAIL;
  const fromEmail = process.env.BOOKING_FROM_EMAIL || 'LogicFolds <onboarding@resend.dev>';
  const subject = `New LogicFolds inquiry: ${lead.company || lead.name}`;
  const text = [
    'New LogicFolds inquiry',
    '',
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company || 'Not provided'}`,
    `Service: ${lead.service}`,
    '',
    'What they want to improve:',
    lead.message,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #181818; line-height: 1.6;">
      <h2>New LogicFolds inquiry</h2>
      <p><strong>Name:</strong> ${escapeHtml(lead.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(lead.company || 'Not provided')}</p>
      <p><strong>Service:</strong> ${escapeHtml(lead.service)}</p>
      <h3>What they want to improve</h3>
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
    return json(502, {
      error: 'Unable to send email',
      details: errorText,
    });
  }

  return json(200, { ok: true });
}
