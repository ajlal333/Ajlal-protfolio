import './blog.css';
import blogContent from '../content/blog-posts.json';
import { initializeBooking } from './booking.js';

const posts = blogContent.posts;
const params = new URLSearchParams(window.location.search);
const requestedSlug = params.get('post');
const selectedPost = posts.find((post) => post.slug === requestedSlug);

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function createMeta(post) {
  const meta = createElement('div', 'blog-card-meta');
  const category = createElement('span', '', post.category);
  const date = createElement('time', '', formatDate(post.published));
  date.dateTime = post.published;
  meta.append(category, date);
  return meta;
}

function createBlogCard(post, index) {
  const card = createElement('a', `blog-list-card${index === 0 ? ' lead' : ''}`);
  card.href = `/blog/?post=${encodeURIComponent(post.slug)}`;
  card.setAttribute('aria-label', `Read ${post.title}`);

  if (post.image && index === 0) {
    const visual = createElement('div', 'blog-list-visual');
    const image = document.createElement('img');
    image.src = post.image;
    image.alt = post.imageAlt || '';
    image.loading = 'lazy';
    visual.append(image);
    card.append(visual);
  }

  const body = createElement('div', 'blog-list-body');
  body.append(createMeta(post));
  body.append(createElement('h3', '', post.title));
  body.append(createElement('p', '', post.excerpt));

  const footer = createElement('div', 'blog-list-footer');
  footer.append(
    createElement('span', '', post.readTime),
    createElement('b', '', 'Read ->')
  );
  body.append(footer);
  card.append(body);

  return card;
}

const blogList = document.querySelector('[data-blog-list]');
const filterList = document.querySelector('[data-blog-filters]');

function renderBlogList(category = 'All') {
  if (!blogList) return;
  blogList.replaceChildren();

  const visiblePosts = category === 'All'
    ? posts
    : posts.filter((post) => post.category === category);

  visiblePosts.forEach((post, index) => blogList.append(createBlogCard(post, index)));
}

function initializeFilters() {
  if (!filterList) return;

  const categories = ['All', ...new Set(posts.map((post) => post.category))];
  categories.forEach((category, index) => {
    const button = createElement('button', '', category);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === 0));
    button.addEventListener('click', () => {
      filterList.querySelectorAll('button').forEach((candidate) => {
        candidate.setAttribute('aria-pressed', String(candidate === button));
      });
      renderBlogList(category);
    });
    filterList.append(button);
  });
}

function setArticleMetadata(post) {
  document.title = `${post.title} | LogicFolds`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = post.excerpt;

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = `${window.location.origin}/blog/?post=${encodeURIComponent(post.slug)}`;

  const structuredData = document.createElement('script');
  structuredData.type = 'application/ld+json';
  structuredData.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: 'LogicFolds' },
    mainEntityOfPage: canonical.href,
    image: post.image ? `${window.location.origin}${post.image}` : undefined,
  });
  document.head.append(structuredData);
}

function renderArticle(post) {
  const indexView = document.querySelector('[data-blog-index]');
  const articleView = document.querySelector('[data-blog-article]');
  indexView.hidden = true;
  articleView.hidden = false;

  const meta = document.querySelector('[data-article-meta]');
  const date = document.createElement('time');
  date.dateTime = post.published;
  date.textContent = formatDate(post.published);
  meta.replaceChildren(
    createElement('span', '', post.category),
    date,
    createElement('span', '', post.readTime)
  );

  document.querySelector('[data-article-title]').textContent = post.title;
  document.querySelector('[data-article-standfirst]').textContent = post.standfirst;
  document.querySelector('[data-article-reading-time]').textContent = post.readTime;
  document.querySelector('[data-article-cta]').textContent = post.cta;

  const takeaways = document.querySelector('[data-article-takeaways]');
  post.takeaways.forEach((takeaway) => {
    takeaways.append(createElement('li', '', takeaway));
  });

  const cover = document.querySelector('[data-article-cover]');
  if (post.image) {
    const image = cover.querySelector('img');
    image.src = post.image;
    image.alt = post.imageAlt || '';
    cover.hidden = false;
  }

  const body = document.querySelector('[data-article-body]');
  post.sections.forEach((section) => {
    const sectionElement = document.createElement('section');
    sectionElement.append(createElement('h2', '', section.heading));
    section.paragraphs.forEach((paragraph) => {
      sectionElement.append(createElement('p', '', paragraph));
    });

    if (section.bullets?.length) {
      const list = document.createElement('ul');
      section.bullets.forEach((bullet) => list.append(createElement('li', '', bullet)));
      sectionElement.append(list);
    }
    body.append(sectionElement);
  });

  if (post.sources?.length) {
    const sources = document.querySelector('[data-article-sources]');
    const list = sources.querySelector('ul');
    post.sources.forEach((source) => {
      const item = document.createElement('li');
      const link = createElement('a', '', source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      item.append(link);
      list.append(item);
    });
    sources.hidden = false;
  }

  setArticleMetadata(post);
}

if (requestedSlug && selectedPost) {
  renderArticle(selectedPost);
} else {
  renderBlogList();
  initializeFilters();
}

if (requestedSlug && !selectedPost) {
  const hero = document.querySelector('.blog-index-hero > div');
  hero.querySelector('.eyebrow').textContent = 'Article not found';
  hero.querySelector('h1').textContent = 'That field note is not in the library.';
  hero.querySelector('.blog-hero-copy').textContent = 'Browse the latest LogicFolds articles below.';
}

initializeBooking({
  defaultService: selectedPost
    ? `Blog inquiry: ${selectedPost.title}`
    : 'LogicFolds blog inquiry',
});

function updateNavigation() {
  document.body.classList.toggle('scrolled', window.scrollY > 34);
}

updateNavigation();
window.addEventListener('scroll', updateNavigation, { passive: true });
