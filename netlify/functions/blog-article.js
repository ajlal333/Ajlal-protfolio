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
import { shell, fallbackPosts } from './blog-shell.mjs';

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

export async function handler(event) {
  const siteUrl = resolveSiteUrl(process.env);

  // netlify.toml routes /blog/posts/* here, so the splat still carries a
  // trailing slash and may be percent-encoded.
  const raw = event.queryStringParameters?.slug ?? '';
  let slug;
  try {
    slug = decodeURIComponent(raw).replace(/\/+$/, '').trim();
  } catch {
    slug = raw.replace(/\/+$/, '').trim();
  }

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
