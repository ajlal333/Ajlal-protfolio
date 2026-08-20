/**
 * Scheduled publisher for the LogicFolds blog.
 *
 * Runs on a Netlify cron (see netlify.toml) and, on each run, drafts one post
 * with the Anthropic API and inserts it straight into the Supabase `posts`
 * table. Publishing is a database insert, so it costs no git commit and no
 * production deploy — the whole reason the blog moved off a deploy-per-post
 * workflow.
 *
 * The draft is validated here against the same rules as scripts/validate-blog.mjs
 * before it is written, and every cited source URL must resolve, so a weak or
 * malformed post is discarded rather than published. supabase/schema.sql mirrors
 * the same constraints, so Postgres is the final backstop.
 *
 * Required environment variables (set in Netlify, never committed):
 *   SUPABASE_URL                 already set for the read path
 *   SUPABASE_SERVICE_ROLE_KEY    server-only; bypasses RLS to insert
 *   ANTHROPIC_API_KEY            drafting
 * Optional:
 *   PUBLISH_MODEL                defaults to claude-sonnet-5
 */

const MODEL = process.env.PUBLISH_MODEL || 'claude-sonnet-5';
const MAX_POSTS_PER_DAY = 2;
const SOURCE_TIMEOUT_MS = 8000;
const GENERATION_ATTEMPTS = 2;

const POSITIONING = `You are writing one blog post for LogicFolds, a company that sells agentic
workflow orchestration, grounded decision systems, human-in-the-loop review and
production AI backends to business owners and operations leaders. Write
business-first, concise, production-minded and technically credible. Never write
as a personal portfolio or a job search. Avoid inflated marketing language.

Approved topics: workflow orchestration, AI opportunity discovery, human review
and governance, decision controls, integrations, evaluation, production
operations, implementation lessons, measurable workflow improvement, practical
adoption.

Hard editorial rules. Never invent clients, deployments, benchmarks,
testimonials, revenue, savings, quotes or results. Every factual or
time-sensitive claim must trace to a real, authoritative, currently reachable
source. Only cite sources you are confident resolve to a real public page.`;

const today = () => new Date().toISOString().slice(0, 10);

function schemaInstructions(existingTitles) {
  return `Return ONLY a single JSON object, no prose and no code fence, matching:

{
  "slug": "lowercase-kebab-case, unique, derived from the title",
  "title": "<= 70 characters",
  "excerpt": "<= 165 characters, plain sentence",
  "category": "short label such as 'AI operations' or 'Workflow control'",
  "readTime": "e.g. '6 min read'",
  "standfirst": "one or two sentence deck under the title",
  "cta": "one short call to action",
  "takeaways": ["at least 2 short takeaway sentences"],
  "sections": [
    { "heading": "Section heading",
      "paragraphs": ["Non-empty paragraph.", "Another paragraph."],
      "bullets": ["optional bullet list, omit if not useful"] }
  ],
  "sources": [
    { "title": "Source name", "url": "https://absolute-url" }
  ]
}

Requirements: at least 3 sections, each with a heading and at least one non-empty
paragraph; at least 2 takeaways; at least 1 source with an absolute http(s) URL.
Do not set an image. Do not repeat any of these already-published titles:
${existingTitles.map((t) => `- ${t}`).join('\n')}`;
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  return {
    url,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
}

async function fetchExisting({ url, headers }) {
  const response = await fetch(`${url}/rest/v1/posts?select=slug,title,published`, { headers });
  if (!response.ok) throw new Error(`Supabase read failed ${response.status}: ${await response.text()}`);
  return response.json();
}

/** Ask the model for a post as JSON, tolerating an accidental code fence. */
async function draftPost(existingTitles, note) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required.');

  const userMessage = [
    schemaInstructions(existingTitles),
    note ? `\nThe previous attempt was rejected: ${note}. Fix it and try a different angle.` : '',
    '\nChoose a topic that does not overlap the published titles above.',
  ].join('');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2400,
      system: POSITIONING,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic API ${response.status}: ${await response.text()}`);

  const payload = await response.json();
  const text = (payload.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return a JSON object.');

  return JSON.parse(jsonText.slice(start, end + 1));
}

/** Mirror of scripts/validate-blog.mjs for a single post. Returns an error string or null. */
function validationError(post, existingSlugs) {
  const text = ['slug', 'title', 'excerpt', 'category', 'readTime', 'standfirst', 'cta'];
  for (const field of text) {
    if (typeof post[field] !== 'string' || !post[field].trim()) return `missing ${field}`;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) return 'slug is not kebab-case';
  if (existingSlugs.has(post.slug)) return `slug "${post.slug}" already exists`;
  if (post.title.length > 70) return `title is ${post.title.length} chars (max 70)`;
  if (post.excerpt.length > 165) return `excerpt is ${post.excerpt.length} chars (max 165)`;
  if (!Array.isArray(post.takeaways) || post.takeaways.length < 2) return 'needs >= 2 takeaways';
  if (!Array.isArray(post.sections) || post.sections.length < 3) return 'needs >= 3 sections';
  for (const [i, s] of post.sections.entries()) {
    if (!s?.heading || !Array.isArray(s.paragraphs) || s.paragraphs.length === 0) {
      return `section ${i} is incomplete`;
    }
    if (!s.paragraphs.every((p) => typeof p === 'string' && p.trim())) {
      return `section ${i} has an empty paragraph`;
    }
  }
  if (!Array.isArray(post.sources) || post.sources.length === 0) return 'needs >= 1 source';
  for (const [i, src] of post.sources.entries()) {
    if (!src?.title?.trim() || !src?.url?.trim()) return `source ${i} is incomplete`;
    if (!/^https?:\/\//.test(src.url)) return `source ${i} url is not absolute http(s)`;
  }
  return null;
}

/** Confirm each cited URL actually resolves, so we never publish a dead citation. */
async function verifySources(sources) {
  for (const src of sources) {
    let ok = false;
    for (const method of ['HEAD', 'GET']) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
        const res = await fetch(src.url, {
          method,
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; LogicFoldsBot/1.0)' },
        });
        clearTimeout(timer);
        if (res.ok) {
          ok = true;
          break;
        }
      } catch {
        // try the next method
      }
    }
    if (!ok) return `source "${src.title}" (${src.url}) did not resolve`;
  }
  return null;
}

function toRow(post) {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    published: today(),
    read_time: post.readTime,
    author: 'LogicFolds',
    standfirst: post.standfirst,
    cta: post.cta,
    takeaways: post.takeaways,
    sections: post.sections,
    sources: post.sources,
    image: null,
    image_alt: null,
    status: 'published',
  };
}

async function insertPost(config, row) {
  const response = await fetch(`${config.url}/rest/v1/posts`, {
    method: 'POST',
    headers: { ...config.headers, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Supabase insert failed ${response.status}: ${await response.text()}`);
  const [saved] = await response.json();
  return saved;
}

export async function handler() {
  try {
    const config = supabaseConfig();
    const existing = await fetchExisting(config);

    const publishedToday = existing.filter((p) => String(p.published).slice(0, 10) === today()).length;
    if (publishedToday >= MAX_POSTS_PER_DAY) {
      console.log(`Already ${publishedToday} posts today; skipping.`);
      return { statusCode: 200, body: `Skipped: ${publishedToday} posts already published today.` };
    }

    const existingSlugs = new Set(existing.map((p) => p.slug));
    const existingTitles = existing.map((p) => p.title);

    let note = '';
    for (let attempt = 1; attempt <= GENERATION_ATTEMPTS; attempt += 1) {
      let post;
      try {
        post = await draftPost(existingTitles, note);
      } catch (error) {
        note = error.message;
        console.warn(`Attempt ${attempt} draft error: ${error.message}`);
        continue;
      }

      const invalid = validationError(post, existingSlugs);
      if (invalid) {
        note = invalid;
        console.warn(`Attempt ${attempt} rejected: ${invalid}`);
        continue;
      }

      const badSource = await verifySources(post.sources);
      if (badSource) {
        note = badSource;
        console.warn(`Attempt ${attempt} rejected: ${badSource}`);
        continue;
      }

      const saved = await insertPost(config, toRow(post));
      console.log(`Published "${saved.title}" (${saved.slug}) for ${saved.published}.`);
      return { statusCode: 200, body: `Published ${saved.slug}` };
    }

    console.error(`No publishable draft after ${GENERATION_ATTEMPTS} attempts. Last issue: ${note}`);
    return { statusCode: 200, body: `No post published: ${note}` };
  } catch (error) {
    console.error(`publish-blog failed: ${error.message}`);
    return { statusCode: 500, body: error.message };
  }
}
