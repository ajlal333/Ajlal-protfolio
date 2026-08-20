/**
 * Publish one LogicFolds blog post into Supabase.
 *
 * This is the deterministic half of the daily publishing job. A drafting agent
 * (a scheduled Claude Code cloud routine) writes a post as JSON and hands it to
 * this script; the script validates it against the same rules as
 * scripts/validate-blog.mjs, confirms every cited source URL resolves, enforces
 * the two-posts-per-day cap, and only then inserts it. A malformed or
 * unsupported draft is rejected with a non-zero exit code instead of published,
 * so quality control never depends on the agent getting it perfect.
 *
 * Publishing is a database insert — no git commit, no Netlify deploy.
 *
 *   node scripts/publish-one.mjs --list           # print published slugs/titles as JSON
 *   node scripts/publish-one.mjs path/to/draft.json
 *
 * Required environment variables:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   server-only; bypasses RLS to insert. Never commit it.
 */

import { readFile } from 'node:fs/promises';

const MAX_POSTS_PER_DAY = 2;
const SOURCE_TIMEOUT_MS = 8000;

const today = () => new Date().toISOString().slice(0, 10);

function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in the environment.');
  }
  return {
    url,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
}

/**
 * Abort the run. Throws rather than calling process.exit() mid-flight: exiting
 * while a fetch handle is still open aborts the process on Windows (a libuv
 * UV_HANDLE_CLOSING assertion) and loses the exit code. The top-level catch
 * turns this into a clean non-zero exit once the event loop unwinds.
 */
function fail(message) {
  throw new Error(message);
}

async function fetchExisting({ url, headers }) {
  const response = await fetch(`${url}/rest/v1/posts?select=slug,title,published`, { headers });
  if (!response.ok) fail(`Supabase read failed ${response.status}: ${await response.text()}`);
  return response.json();
}

/** Single-post mirror of scripts/validate-blog.mjs. Returns an error string or null. */
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

/** Confirm each cited URL actually resolves, so a dead citation is never published. */
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

async function list() {
  const posts = await fetchExisting(config());
  posts.sort((a, b) => (a.published < b.published ? 1 : -1));
  console.log(JSON.stringify(posts, null, 2));
}

async function publish(path) {
  const cfg = config();

  let post;
  try {
    post = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    fail(`could not read draft at ${path}: ${error.message}`);
  }

  const existing = await fetchExisting(cfg);
  const publishedToday = existing.filter((p) => String(p.published).slice(0, 10) === today()).length;
  if (publishedToday >= MAX_POSTS_PER_DAY) {
    fail(`already ${publishedToday} posts today; the limit is ${MAX_POSTS_PER_DAY}.`);
  }

  const invalid = validationError(post, new Set(existing.map((p) => p.slug)));
  if (invalid) fail(`draft rejected: ${invalid}`);

  const badSource = await verifySources(post.sources);
  if (badSource) fail(`draft rejected: ${badSource}`);

  const response = await fetch(`${cfg.url}/rest/v1/posts`, {
    method: 'POST',
    headers: { ...cfg.headers, Prefer: 'return=representation' },
    body: JSON.stringify(toRow(post)),
  });
  if (!response.ok) fail(`Supabase insert failed ${response.status}: ${await response.text()}`);

  const [saved] = await response.json();
  console.log(`Published "${saved.title}" (${saved.slug}) for ${saved.published}.`);
}

try {
  const arg = process.argv[2];
  if (!arg) fail('usage: publish-one.mjs --list | <draft.json>');
  await (arg === '--list' ? list() : publish(arg));
} catch (error) {
  console.error(`publish-one: ${error.message}`);
  process.exitCode = 1;
}
