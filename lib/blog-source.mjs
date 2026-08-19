/**
 * Where blog posts come from at runtime.
 *
 * Primary source is a Supabase `posts` table, read over PostgREST. Publishing a
 * post is an INSERT, so it costs no git commit and no Netlify deploy — which
 * matters because a production deploy costs 15 of the 300 monthly credits on
 * the free plan.
 *
 * If Supabase is unreachable — unconfigured, paused after a week of inactivity,
 * or simply down — we fall back to the copy of content/blog-posts.json that was
 * bundled at build time. The blog then serves slightly stale content instead of
 * a 500, which is the behaviour the project brief asked for.
 */

const REQUEST_TIMEOUT_MS = 4000;

const SELECT_COLUMNS = [
  'slug',
  'title',
  'excerpt',
  'category',
  'published',
  'read_time',
  'author',
  'standfirst',
  'cta',
  'takeaways',
  'sections',
  'sources',
  'image',
  'image_alt',
  'updated',
].join(',');

/** Map a snake_case database row onto the shape the renderer expects. */
export function normalizePost(row) {
  const list = (value) => (Array.isArray(value) ? value : []);

  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    published: typeof row.published === 'string' ? row.published.slice(0, 10) : row.published,
    readTime: row.read_time ?? row.readTime,
    author: row.author,
    standfirst: row.standfirst,
    cta: row.cta,
    takeaways: list(row.takeaways),
    sections: list(row.sections),
    sources: list(row.sources),
    image: row.image ?? null,
    imageAlt: row.image_alt ?? row.imageAlt ?? '',
    updated: row.updated ? String(row.updated).slice(0, 10) : null,
  };
}

const byNewest = (a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0);

export function supabaseConfig(env = process.env) {
  const url = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  // Reads use the anon key on purpose: row level security already limits it to
  // published, non-future posts, so a leak costs nothing.
  const key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? { url, key } : null;
}

/**
 * Fetch published posts, newest first.
 *
 * @param {object}  options
 * @param {Array}   options.fallbackPosts  bundled posts used when Supabase is unavailable
 * @param {object} [options.env]           defaults to process.env
 * @param {Function} [options.fetchImpl]   injectable for tests
 * @returns {Promise<{posts: Array, source: 'supabase'|'fallback', error?: string}>}
 */
export async function loadPosts({ fallbackPosts = [], env = process.env, fetchImpl = fetch } = {}) {
  const config = supabaseConfig(env);
  const fallback = () => [...fallbackPosts].map(normalizePost).sort(byNewest);

  if (!config) {
    return { posts: fallback(), source: 'fallback', error: 'Supabase is not configured' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const query =
    `${config.url}/rest/v1/posts` +
    `?select=${SELECT_COLUMNS}` +
    `&status=eq.published` +
    `&published=lte.${today}` +
    `&order=published.desc`;

  try {
    const response = await fetchImpl(query, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Supabase responded ${response.status}`);
    }

    const rows = await response.json();

    // An empty table almost always means "not seeded yet" rather than "no posts",
    // so prefer the bundled copy over serving an empty blog.
    if (!Array.isArray(rows) || rows.length === 0) {
      return { posts: fallback(), source: 'fallback', error: 'Supabase returned no rows' };
    }

    return { posts: rows.map(normalizePost).sort(byNewest), source: 'supabase' };
  } catch (error) {
    return { posts: fallback(), source: 'fallback', error: String(error?.message || error) };
  }
}

export async function loadPostBySlug(slug, options = {}) {
  const { posts, source, error } = await loadPosts(options);
  return { post: posts.find((candidate) => candidate.slug === slug) ?? null, posts, source, error };
}

export function resolveSiteUrl(env = process.env) {
  return (env.SITE_URL || env.URL || env.DEPLOY_PRIME_URL || 'https://logicfolds.com').replace(
    /\/+$/,
    ''
  );
}
