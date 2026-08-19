/**
 * Serves /blog/posts/<slug>/ from the database at request time.
 *
 * Rendering reuses lib/blog-render.mjs, the same module the build step uses, so
 * the HTML is identical to the prerendered pages this replaces: full article
 * body, Open Graph and Twitter tags, canonical, BlogPosting JSON-LD. Crawlers
 * and link-preview bots still get everything without running JavaScript.
 *
 * Caching does the heavy lifting. A brand new article URL has no cache entry,
 * so it renders immediately on first request and is then served from the CDN
 * for an hour, with a week of stale-while-revalidate behind it. That keeps
 * function compute near zero without needing a purge step on publish.
 */

import { renderArticlePage, renderIndexPage } from '../../lib/blog-render.mjs';
import { loadPostBySlug, resolveSiteUrl } from '../../lib/blog-source.mjs';
import { shell, fallbackPosts } from '../../lib/blog-shell.generated.mjs';

const CDN_CACHE = 'public, durable, s-maxage=3600, stale-while-revalidate=604800';
const BROWSER_CACHE = 'public, max-age=0, must-revalidate';

function html(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': BROWSER_CACHE,
      ...extraHeaders,
    },
    body,
  };
}

/**
 * Work out which article was asked for.
 *
 * netlify.toml rewrites /blog/posts/* to this function as ?slug=:splat. That is
 * the normal route and is preferred here; it works, including alongside tracking
 * parameters such as ?utm_source=.
 *
 * The path fallback exists as cheap insurance rather than a fix for a known bug.
 * An empty slug renders the not-found page, so anything that drops the query
 * parameter takes every article down at once — a failure worth being unable to
 * have. Articles were briefly 404ing while the Supabase environment variables
 * propagated to the function runtime, which is what prompted this; the splat
 * interpolation was wrongly blamed at the time and was never actually at fault.
 */
function resolveSlug(event) {
  const candidates = [];

  const fromQuery = event.queryStringParameters?.slug;
  if (fromQuery) candidates.push(fromQuery);

  for (const value of [event.rawUrl, event.path, event.headers?.['x-nf-original-path']]) {
    if (!value) continue;
    let pathname = value;
    if (value.includes('://')) {
      try {
        pathname = new URL(value).pathname;
      } catch {
        continue;
      }
    }
    const match = /\/blog\/posts\/(.+?)\/*$/.exec(pathname);
    if (match) candidates.push(match[1]);
  }

  for (const raw of candidates) {
    let slug;
    try {
      slug = decodeURIComponent(raw);
    } catch {
      slug = raw;
    }
    slug = slug.replace(/\/+$/, '').trim();
    if (slug) return slug;
  }

  return '';
}

export async function handler(event) {
  const siteUrl = resolveSiteUrl(process.env);
  const slug = resolveSlug(event);

  const { post, posts, source, error } = await loadPostBySlug(slug, { fallbackPosts });

  if (error) {
    console.warn(`[blog-article] serving from ${source}: ${error}`);
  }

  if (!post) {
    // Reuse the index as the not-found page so visitors land somewhere useful.
    return html(404, renderIndexPage(posts, { siteUrl, shell, notFoundSlug: slug }), {
      'Netlify-CDN-Cache-Control': 'public, s-maxage=60',
      'Netlify-Cache-Tag': 'blog,blog-index',
    });
  }

  return html(200, renderArticlePage(post, { siteUrl, shell }), {
    // Fall back to a short TTL when the database was unreachable, so a stale
    // response cannot get pinned into the CDN for a week.
    'Netlify-CDN-Cache-Control': source === 'supabase' ? CDN_CACHE : 'public, s-maxage=60',
    'Netlify-Cache-Tag': `blog,blog-post-${post.slug}`,
  });
}
