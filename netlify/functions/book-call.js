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

/** Send one message through Resend. Resolves to true on a 2xx, false otherwise. */
async function sendEmail(apiKey, message, label) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.warn(`[book-call] ${label} failed: ${response.status} ${await response.text()}`);
    }
    return response.ok;
  } catch (error) {
    console.warn(`[book-call] ${label} failed: ${error.message}`);
    return false;
  }
}

const TOO_MANY_REQUESTS = {
  error: 'Too many requests. Please email us directly or try again shortly.',
};

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

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { error: 'Invalid JSON body' });
  }

  // Honeypot. Answer 200 so a bot cannot tell it was filtered.
  if (clean(body.companyFax)) {
    return json(200, { ok: true });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.BOOKING_TO_EMAIL || DEFAULT_TO_EMAIL;
  const fromEmail = process.env.BOOKING_FROM_EMAIL || 'LogicFolds <onboarding@resend.dev>';

  // Validation runs before the throttle so a visitor fixing a typo does not
  // burn through their attempts; only submissions that would send are counted.

  // Blog email signup: email only, notifies the owner, no confirmation message.
  if (body.kind === 'signup') {
    const email = clean(body.email, 180);
    if (!EMAIL_PATTERN.test(email)) {
      return json(400, { error: 'Please provide a valid email address', fields: ['email'] });
    }

    if (isRateLimited(clientIp(event))) return json(429, TOO_MANY_REQUESTS);
    if (!resendApiKey) return json(503, { error: 'Email service is not configured' });

    const sent = await sendEmail(
      resendApiKey,
      {
        from: fromEmail,
        to: toEmail,
        reply_to: email,
        subject: `New blog email signup: ${email}`,
        text: `New blog email signup\n\nEmail: ${email}\nFrom: ${clean(body.source, 200) || 'blog'}`,
      },
      'signup notification'
    );

    if (!sent) return json(502, { error: 'Unable to save your signup right now' });
    return json(200, { ok: true });
  }

  const lead = {
    name: clean(body.name, 140),
    email: clean(body.email, 180),
    company: clean(body.company, 180),
    service: clean(body.service, 180) || 'Free Automation Audit',
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
      error: 'Please describe the task in a little more detail',
      fields: ['message'],
    });
  }

  if (isRateLimited(clientIp(event))) return json(429, TOO_MANY_REQUESTS);

  if (!resendApiKey) {
    return json(503, { error: 'Email service is not configured' });
  }

  const subject = `New automation audit request: ${lead.company || lead.name}`;
  const text = [
    'New free automation audit request',
    '',
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company || 'Not provided'}`,
    `Service: ${lead.service}`,
    '',
    'Task that takes the most retyping:',
    lead.message,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #181818; line-height: 1.6;">
      <h2>New free automation audit request</h2>
      <p><strong>Name:</strong> ${escapeHtml(lead.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(lead.company || 'Not provided')}</p>
      <p><strong>Service:</strong> ${escapeHtml(lead.service)}</p>
      <h3>Task that takes the most retyping</h3>
      <p>${escapeHtml(lead.message)}</p>
    </div>
  `;

  const notified = await sendEmail(
    resendApiKey,
    { from: fromEmail, to: toEmail, reply_to: lead.email, subject, text, html },
    'owner notification'
  );

  // Resend's error body stays in the function log; the visitor only needs to
  // know it failed so the front end can open the mailto fallback.
  if (!notified) {
    return json(502, { error: 'Unable to send email' });
  }

  // Best-effort confirmation to the lead. The owner notification above already
  // succeeded, so a failure here must not fail the request — but a silent inbox
  // after someone asks for a call is exactly what loses the booking, so we try.
  // It deliberately echoes nothing the visitor typed: the recipient address is
  // unverified, so quoting the name or message would let anyone use this form
  // to send their own text from our domain.
  const confirmText = [
    'Hi,',
    '',
    'Thanks for reaching out to LogicFolds. We have your request for a free',
    'automation audit and will reply within one business day to set a time for',
    'your 30-minute call.',
    '',
    'Need to add anything? Just reply to this email.',
    '',
    '— LogicFolds',
  ].join('\n');

  const confirmHtml = `
    <div style="font-family: Arial, sans-serif; color: #181818; line-height: 1.6;">
      <p>Hi,</p>
      <p>Thanks for reaching out to LogicFolds. We have your request for a free automation audit and will reply within one business day to set a time for your 30-minute call.</p>
      <p>Need to add anything? Just reply to this email.</p>
      <p>— LogicFolds</p>
    </div>
  `;

  await sendEmail(
    resendApiKey,
    {
      from: fromEmail,
      to: lead.email,
      reply_to: toEmail,
      subject: 'Your free automation audit request',
      text: confirmText,
      html: confirmHtml,
    },
    'lead confirmation'
  );

  return json(200, { ok: true });
}
