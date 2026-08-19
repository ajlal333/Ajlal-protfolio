/**
 * Serves /blog/ from the database at request time.
 *
 * Shorter TTL than an article: the index is the page that has to notice a new
 * post. Five minutes of CDN cache with a day of stale-while-revalidate means a
 * published article shows up in the listing quickly while readers never wait on
 * a cold render.
 *
 * Legacy /blog/?post=<slug> links are answered with a 301 to the canonical
 * article URL so old shares keep working and consolidate their ranking signals.
 */

import { renderIndexPage, articlePath } from '../../lib/blog-render.mjs';
import { loadPosts, resolveSiteUrl } from '../../lib/blog-source.mjs';
import { shell, fallbackPosts } from '../../lib/blog-shell.generated.mjs';

export async function handler(event) {
  const siteUrl = resolveSiteUrl(process.env);
  const legacySlug = event.queryStringParameters?.post;

  if (legacySlug) {
    return {
      statusCode: 301,
      headers: {
        Location: articlePath(legacySlug),
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=86400',
      },
      body: '',
    };
  }

  const { posts, source, error } = await loadPosts({ fallbackPosts });

  if (error) {
    console.warn(`[blog-index] serving from ${source}: ${error}`);
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control':
        source === 'supabase'
          ? 'public, durable, s-maxage=300, stale-while-revalidate=86400'
          : 'public, s-maxage=60',
      'Netlify-Cache-Tag': 'blog,blog-index',
    },
    body: renderIndexPage(posts, { siteUrl, shell }),
  };
}
