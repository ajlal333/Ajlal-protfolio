/**
 * Product analytics, loaded only when configured.
 *
 * Reads VITE_POSTHOG_PROJECT_TOKEN at build time. With no token set — local dev,
 * or before it is configured in Netlify — this is a no-op and no third-party
 * script loads, so the token never lives in the repo. PostHog's library is
 * served from PostHog's own CDN rather than bundled, so it costs nothing against
 * the site's Netlify bandwidth budget and never adds weight to main.js.
 */

const TOKEN = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export function initAnalytics() {
  if (!TOKEN) return;

  // Honour Do Not Track before anything third-party loads.
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  const assetHost = HOST.replace('.i.posthog.com', '-assets.i.posthog.com');
  const script = document.createElement('script');
  script.src = `${assetHost}/static/array.js`;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.addEventListener('load', () => {
    window.posthog?.init(TOKEN, {
      api_host: HOST,
      // Privacy-conscious: no person profiles for anonymous visitors, and
      // respect the browser Do Not Track signal at the library level too.
      person_profiles: 'identified_only',
      respect_dnt: true,
      capture_pageview: true,
    });
  });
  document.head.appendChild(script);
}
