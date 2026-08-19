/**
 * Serves /sitemap.xml from the database so newly published articles are
 * discoverable without a deploy.
 */

import { renderSitemap } from '../../lib/blog-render.mjs';
import { loadPosts, resolveSiteUrl } from '../../lib/blog-source.mjs';
import { fallbackPosts } from '../../lib/blog-shell.generated.mjs';

export async function handler() {
  const siteUrl = resolveSiteUrl(process.env);
  const { posts, source, error } = await loadPosts({ fallbackPosts });

  if (error) {
    console.warn(`[blog-sitemap] serving from ${source}: ${error}`);
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control':
        source === 'supabase'
          ? 'public, durable, s-maxage=3600, stale-while-revalidate=86400'
          : 'public, s-maxage=60',
      'Netlify-Cache-Tag': 'blog,blog-sitemap',
    },
    body: renderSitemap(posts, siteUrl),
  };
}
