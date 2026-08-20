/**
 * Blog HTML rendering, shared by the build step and the Netlify Functions that
 * serve /blog/ and /blog/posts/<slug>/ at runtime.
 *
 * Everything here is pure: no filesystem, no env, no network. Callers pass in
 * the site URL and the page shell (nav/footer/dialog markup plus the hashed
 * asset tags emitted by Vite). That keeps a runtime-rendered article
 * byte-identical to the one the build used to prerender, so moving posts into a
 * database costs us nothing in SEO or link previews.
 */

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const absolute = (siteUrl, path) =>
  /^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`;

export const formatDate = (date) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${date}T12:00:00Z`)
  );

export const articlePath = (slug) => `/blog/posts/${encodeURIComponent(slug)}/`;

function renderSections(sections) {
  return sections
    .map((section) => {
      const paragraphs = section.paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join('\n            ');

      const bullets = section.bullets?.length
        ? `\n            <ul>\n              ${section.bullets
            .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
            .join('\n              ')}\n            </ul>`
        : '';

      return `<section>\n            <h2>${escapeHtml(
        section.heading
      )}</h2>\n            ${paragraphs}${bullets}\n          </section>`;
    })
    .join('\n          ');
}

function articleHead(post, canonical, siteUrl) {
  const description = post.excerpt;
  const image = absolute(siteUrl, post.image || '/og-cover.png');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description,
    datePublished: post.published,
    dateModified: post.updated || post.published,
    author: { '@type': 'Organization', name: post.author, url: siteUrl },
    publisher: {
      '@type': 'Organization',
      name: 'LogicFolds',
      url: siteUrl,
      logo: { '@type': 'ImageObject', url: absolute(siteUrl, '/favicon.svg') },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    articleSection: post.category,
    image,
  };

  return `<meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="LogicFolds" />
    <meta property="og:title" content="${escapeHtml(post.title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="article:published_time" content="${escapeHtml(post.published)}" />
    <meta property="article:section" content="${escapeHtml(post.category)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(post.title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

function articleBody(post) {
  const cover = post.image
    ? `<figure class="article-cover">
          <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.imageAlt || '')}" />
          <figcaption>Client-safe synthetic workflow view.</figcaption>
        </figure>`
    : '';

  const sources = post.sources?.length
    ? `<section class="article-sources">
          <h2>Sources and further reading</h2>
          <ul>
            ${post.sources
              .map(
                (source) =>
                  `<li><a href="${escapeHtml(
                    source.url
                  )}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a></li>`
              )
              .join('\n            ')}
          </ul>
        </section>`
    : '';

  return `<article class="blog-article-view">
        <a class="article-back" href="/blog/"><span aria-hidden="true">&lt;-</span> All articles</a>
        <header class="article-header">
          <div class="article-title-block">
            <div class="article-meta">
              <span>${escapeHtml(post.category)}</span>
              <time datetime="${escapeHtml(post.published)}">${escapeHtml(
                formatDate(post.published)
              )}</time>
              <span>${escapeHtml(post.readTime)}</span>
            </div>
            <h1>${escapeHtml(post.title)}</h1>
            <p>${escapeHtml(post.standfirst)}</p>
          </div>
          <aside class="article-takeaways" aria-labelledby="takeaways-title">
            <span id="takeaways-title">In brief</span>
            <ul>
              ${post.takeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n              ')}
            </ul>
          </aside>
        </header>
        ${cover}
        <div class="article-layout">
          <aside class="article-rail">
            <span>LogicFolds</span>
            <p>${escapeHtml(post.readTime)}</p>
            <button type="button" data-open-booking>Discuss this workflow</button>
          </aside>
          <div class="article-body">
          ${renderSections(post.sections)}
          </div>
        </div>
        ${sources}
        <section class="article-cta">
          <p class="eyebrow">Next move</p>
          <h2>${escapeHtml(post.cta)}</h2>
          <a class="button primary" href="/opportunity-sprint/">
            See how an Opportunity Sprint works
            <span class="arrow-dot">-&gt;</span>
          </a>
        </section>
      </article>`;
}

function page({ title, head, main, shell, bodyClass = 'blog-page-body', bodyAttrs = '' }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#181818" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>${escapeHtml(title)}</title>
    ${head}
    ${shell.assetsHead}
  </head>
  <body class="${bodyClass}"${bodyAttrs}>
    ${shell.nav}

    <main class="blog-main">
      ${main}
    </main>

    ${shell.footer}

    ${shell.dialog}

    ${shell.assetsScripts}
  </body>
</html>
`;
}

export function renderArticlePage(post, { siteUrl, shell }) {
  const canonical = `${siteUrl}${articlePath(post.slug)}`;
  return page({
    title: `${post.title} | LogicFolds`,
    head: articleHead(post, canonical, siteUrl),
    main: articleBody(post),
    shell,
    bodyAttrs: ` data-article-title="${escapeHtml(post.title)}"`,
  });
}

function indexCard(post, index) {
  const visual =
    post.image && index === 0
      ? `<div class="blog-list-visual"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(
          post.imageAlt || ''
        )}" loading="lazy" /></div>`
      : '';

  return `<a class="blog-list-card${index === 0 ? ' lead' : ''}" href="${escapeHtml(
    articlePath(post.slug)
  )}" data-category="${escapeHtml(post.category)}" aria-label="Read ${escapeHtml(post.title)}">
            ${visual}
            <div class="blog-list-body">
              <div class="blog-card-meta">
                <span>${escapeHtml(post.category)}</span>
                <time datetime="${escapeHtml(post.published)}">${escapeHtml(
                  formatDate(post.published)
                )}</time>
              </div>
              <h3>${escapeHtml(post.title)}</h3>
              <p>${escapeHtml(post.excerpt)}</p>
              <div class="blog-list-footer">
                <span>${escapeHtml(post.readTime)}</span>
                <b>Read -&gt;</b>
              </div>
            </div>
          </a>`;
}

export function renderIndexPage(posts, { siteUrl, shell, notFoundSlug = null }) {
  const canonical = `${siteUrl}/blog/`;
  const description =
    'LogicFolds field notes on agentic workflows, production AI, human review, and business operations.';
  const image = absolute(siteUrl, '/og-cover.png');

  const heading = notFoundSlug
    ? {
        eyebrow: 'Article not found',
        title: 'That field note is not in the library.',
        copy: 'Browse the latest LogicFolds articles below.',
      }
    : {
        eyebrow: 'LogicFolds field notes',
        title: 'Useful thinking for teams putting AI into real operations.',
        copy: 'Workflow design, decision controls, integrations, and the work that turns an AI demo into a dependable system.',
      };

  const categories = ['All', ...new Set(posts.map((post) => post.category))];

  const head = `<meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="LogicFolds" />
    <meta property="og:title" content="LogicFolds Blog | Practical AI for Business Operations" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="LogicFolds Blog | Practical AI for Business Operations" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />`;

  const main = `<section class="blog-index-view" data-blog-index>
        <header class="blog-index-hero">
          <div>
            <p class="eyebrow">${escapeHtml(heading.eyebrow)}</p>
            <h1>${escapeHtml(heading.title)}</h1>
            <p class="blog-hero-copy">${escapeHtml(heading.copy)}</p>
          </div>
          <aside class="blog-publishing-note" aria-label="Publishing focus">
            <span>Published daily</span>
            <strong>Practical over promotional.</strong>
            <p>Short operating ideas, grounded examples, and clear implementation boundaries.</p>
          </aside>
        </header>

        <section class="blog-library" aria-labelledby="blog-library-title">
          <div class="blog-library-head">
            <div>
              <p class="eyebrow">Latest articles</p>
              <h2 id="blog-library-title">The operating layer of AI.</h2>
            </div>
            <div class="blog-filters" data-blog-filters aria-label="Article categories">
              ${categories
                .map(
                  (category, index) =>
                    `<button type="button" aria-pressed="${index === 0}">${escapeHtml(
                      category
                    )}</button>`
                )
                .join('\n              ')}
            </div>
          </div>
          <div class="blog-list" data-blog-list>
          ${posts.map((post, index) => indexCard(post, index)).join('\n          ')}
          </div>
        </section>
      </section>`;

  return page({
    title: 'LogicFolds Blog | Practical AI for Business Operations',
    head,
    main,
    shell,
  });
}

export function renderSitemap(posts, siteUrl) {
  const urls = [
    { loc: `${siteUrl}/`, priority: '1.0' },
    { loc: `${siteUrl}/blog/`, priority: '0.8' },
    { loc: `${siteUrl}/opportunity-sprint/`, priority: '0.8' },
    ...posts.map((post) => ({
      loc: `${siteUrl}${articlePath(post.slug)}`,
      lastmod: post.updated || post.published,
      priority: '0.7',
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) =>
      `  <url>\n    <loc>${escapeHtml(url.loc)}</loc>${
        url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : ''
      }\n    <priority>${url.priority}</priority>\n  </url>`
  )
  .join('\n')}
</urlset>
`;
}
