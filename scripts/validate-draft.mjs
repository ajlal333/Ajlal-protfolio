/**
 * Validate one drafted blog post and emit the SQL to publish it.
 *
 * This is the env-free half of the daily publishing job. A scheduled Claude
 * Code cloud routine drafts a post as JSON and runs this script; the script
 * needs no database credentials and touches no network except to confirm each
 * cited source URL resolves. It validates the draft against the same rules as
 * scripts/validate-blog.mjs and, on success, prints a single INSERT statement
 * on stdout for the routine to run through the authenticated Supabase MCP
 * connector. Nothing here can reach the database itself, so no service-role key
 * ever lives in the routine's shell.
 *
 *   node scripts/validate-draft.mjs draft.json
 *   node scripts/validate-draft.mjs draft.json --existing existing.json
 *
 * existing.json, when given, is a JSON array of the already-published posts
 * (objects with at least a "slug"); it lets the script reject a duplicate slug
 * before the insert rather than relying on the database unique constraint.
 *
 * On success: prints the INSERT SQL to stdout and exits 0.
 * On any problem: prints the reason to stderr and exits 1 (no SQL on stdout).
 */

import { readFile } from 'node:fs/promises';

const SOURCE_TIMEOUT_MS = 8000;
const today = () => new Date().toISOString().slice(0, 10);

function fail(message) {
  throw new Error(message);
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

/** Build a parameter-free INSERT with all values safely single-quote escaped. */
function buildInsertSql(post) {
  const row = {
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

  const json = JSON.stringify([row]).replace(/'/g, "''");

  return `insert into public.posts
  (slug,title,excerpt,category,published,read_time,author,standfirst,cta,takeaways,sections,sources,image,image_alt,status)
select slug,title,excerpt,category,published,read_time,author,standfirst,cta,takeaways,sections,sources,image,image_alt,status
from jsonb_to_recordset('${json}'::jsonb) as x(
  slug text, title text, excerpt text, category text, published date, read_time text,
  author text, standfirst text, cta text, takeaways jsonb, sections jsonb, sources jsonb,
  image text, image_alt text, status text
)
returning slug, title, published, status;`;
}

async function main() {
  const args = process.argv.slice(2);
  const draftPath = args.find((a) => !a.startsWith('--'));
  if (!draftPath) fail('usage: validate-draft.mjs <draft.json> [--existing existing.json]');

  const existingIndex = args.indexOf('--existing');
  const existingPath = existingIndex !== -1 ? args[existingIndex + 1] : null;

  let post;
  try {
    post = JSON.parse(await readFile(draftPath, 'utf8'));
  } catch (error) {
    fail(`could not read draft at ${draftPath}: ${error.message}`);
  }

  const existingSlugs = new Set();
  if (existingPath) {
    try {
      const rows = JSON.parse(await readFile(existingPath, 'utf8'));
      for (const row of Array.isArray(rows) ? rows : []) {
        if (row?.slug) existingSlugs.add(row.slug);
      }
    } catch (error) {
      fail(`could not read existing posts at ${existingPath}: ${error.message}`);
    }
  }

  const invalid = validationError(post, existingSlugs);
  if (invalid) fail(`draft rejected: ${invalid}`);

  const badSource = await verifySources(post.sources);
  if (badSource) fail(`draft rejected: ${badSource}`);

  // Only the SQL goes to stdout, so the routine can capture it cleanly.
  process.stderr.write(`Draft OK: "${post.title}" (${post.slug}). Run the SQL below via Supabase.\n`);
  process.stdout.write(`${buildInsertSql(post)}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`validate-draft: ${error.message}\n`);
  process.exitCode = 1;
}
