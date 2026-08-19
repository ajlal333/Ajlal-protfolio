/**
 * Push content/blog-posts.json into the Supabase `posts` table.
 *
 * Use it once to seed the table, and afterwards whenever you want the JSON
 * fallback and the database to agree. Rows are upserted on `slug`, so re-running
 * is safe and never duplicates.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-posts.mjs
 *   node scripts/sync-posts.mjs --dry-run     # show what would change
 *   node scripts/sync-posts.mjs --pull        # write the DB back into the JSON
 *
 * --pull is how you refresh the offline fallback after publishing a batch, so
 * the bundled snapshot does not drift too far from the live table.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CONTENT_PATH = resolve('content/blog-posts.json');
const dryRun = process.argv.includes('--dry-run');
const pull = process.argv.includes('--pull');

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !key) {
  console.error(
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Both are in the Supabase dashboard under Project Settings -> API.\n' +
      'The service role key bypasses row level security. Never commit it or ship it to the browser.'
  );
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

const toRow = (post) => ({
  slug: post.slug,
  title: post.title,
  excerpt: post.excerpt,
  category: post.category,
  published: post.published,
  read_time: post.readTime,
  author: post.author,
  standfirst: post.standfirst,
  cta: post.cta,
  takeaways: post.takeaways ?? [],
  sections: post.sections ?? [],
  sources: post.sources ?? [],
  image: post.image ?? null,
  image_alt: post.imageAlt ?? null,
  updated: post.updated ?? null,
  status: 'published',
});

const toPost = (row) => {
  const post = {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    published: String(row.published).slice(0, 10),
    readTime: row.read_time,
    author: row.author,
    standfirst: row.standfirst,
    cta: row.cta,
    takeaways: row.takeaways ?? [],
    sections: row.sections ?? [],
    sources: row.sources ?? [],
  };
  if (row.image) {
    post.image = row.image;
    post.imageAlt = row.image_alt ?? '';
  }
  if (row.updated) post.updated = String(row.updated).slice(0, 10);
  return post;
};

async function pullFromSupabase() {
  const response = await fetch(
    `${url}/rest/v1/posts?select=*&status=eq.published&order=published.desc`,
    { headers }
  );
  if (!response.ok) throw new Error(`Supabase responded ${response.status}: ${await response.text()}`);

  const rows = await response.json();
  const posts = rows.map(toPost);

  if (dryRun) {
    console.log(`Would write ${posts.length} posts into content/blog-posts.json`);
    return;
  }

  await writeFile(CONTENT_PATH, `${JSON.stringify({ posts }, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${posts.length} posts into content/blog-posts.json.`);
  console.log('Run `npm run validate:blog` before committing the refreshed fallback.');
}

async function pushToSupabase() {
  const { posts } = JSON.parse(await readFile(CONTENT_PATH, 'utf8'));
  const rows = posts.map(toRow);

  if (dryRun) {
    console.log(`Would upsert ${rows.length} posts:`);
    rows.forEach((row) => console.log(`  ${row.published}  ${row.slug}`));
    return;
  }

  const response = await fetch(`${url}/rest/v1/posts?on_conflict=slug`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    throw new Error(`Supabase responded ${response.status}: ${await response.text()}`);
  }

  const saved = await response.json();
  console.log(`Upserted ${saved.length} posts into Supabase.`);
  saved
    .sort((a, b) => (a.published < b.published ? 1 : -1))
    .forEach((row) => console.log(`  ${String(row.published).slice(0, 10)}  ${row.slug}`));
}

await (pull ? pullFromSupabase() : pushToSupabase());
