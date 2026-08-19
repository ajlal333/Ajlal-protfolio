const DEFAULT_TO_EMAIL = 'ajlalgoraya333@gmail.com';

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MIN_MESSAGE_LENGTH = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@,]+\.[a-z]{2,}$/i;

/**
 * Best-effort throttle. Netlify Functions are stateless, so this Map only lives
 * for the life of one warm instance and will not stop a distributed flood. It is
 * here to make casual form spam expensive rather than free. Move it to a shared
 * store (Netlify Blobs, Upstash) if abuse ever becomes a real problem.
 */
const recentSubmissions = new Map();

function isRateLimited(key) {
  if (!key) return false;

  const now = Date.now();

  for (const [ip, stamps] of recentSubmissions) {
    const fresh = stamps.filter((stamp) => now - stamp < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) recentSubmissions.delete(ip);
    else recentSubmissions.set(ip, fresh);
  }

  const stamps = recentSubmissions.get(key) ?? [];
  if (stamps.length >= RATE_LIMIT_MAX) return true;

  recentSubmissions.set(key, [...stamps, now]);
  return false;
}

function clientIp(event) {
  const headers = event.headers || {};
  return (
    headers['x-nf-client-connection-ip'] ||
    (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    ''
  );
}

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

  if (event.body && Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return json(413, { error: 'Request body is too large' });
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }

  // Honeypot. Answer 200 so a bot cannot tell it was filtered.
  if (clean(body.companyFax)) {
    return json(200, { ok: true });
  }

  if (isRateLimited(clientIp(event))) {
    return json(429, {
      error: 'Too many requests. Please email us directly or try again shortly.',
    });
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

  if (!EMAIL_PATTERN.test(lead.email)) {
    return json(400, { error: 'Please provide a valid email address', fields: ['email'] });
  }

  if (lead.message.length < MIN_MESSAGE_LENGTH) {
    return json(400, {
      error: 'Please describe what you would like to improve in a little more detail',
      fields: ['message'],
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
