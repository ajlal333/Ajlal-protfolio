import './styles.css';
import blogContent from '../content/blog-posts.json';
import { initializeBooking } from './booking.js';
import { initializeNavMenu } from './nav.js';
import { initAnalytics } from './analytics.js';

initAnalytics();

const solutionCopy = {
  automation: {
    color: '#2c6fff',
    title: 'Agentic workflows for business operations',
    copy: 'Coordinate agents, business rules, integrations, and human review in one dependable flow.',
  },
  extraction: {
    color: '#ffb454',
    title: 'Grounded decision intelligence',
    copy: 'Turn documents and business context into traceable, bounded decisions.',
  },
  platform: {
    color: '#34c9a5',
    title: 'AI platforms and integrations',
    copy: 'Connect workflows to APIs, MCP tools, dashboards, auth, and deployment.',
  },
};

let activeSolution = 'automation';

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setSolution(solution) {
  activeSolution = solution;
  const data = solutionCopy[solution];
  document.querySelectorAll('[data-solution]').forEach((element) => {
    element.classList.toggle('active', element.dataset.solution === solution);
  });
  setText('solution-title', data.title);
  setText('solution-copy', data.copy);
}

initializeBooking();

const homeBlogGrid = document.querySelector('[data-home-blog]');

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function formatBlogDate(date) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function createHomeBlogCard(post, index) {
  const card = createElement('a', `home-blog-card${index === 0 ? ' featured' : ''}`);
  card.href = `/blog/posts/${encodeURIComponent(post.slug)}/`;
  card.setAttribute('aria-label', `Read ${post.title}`);

  if (index === 0 && post.image) {
    const visual = createElement('div', 'home-blog-visual');
    const image = document.createElement('img');
    image.src = post.image;
    image.alt = post.imageAlt || '';
    image.loading = 'lazy';
    visual.append(image);
    card.append(visual);
  } else {
    const signal = createElement('div', 'home-blog-signal');
    signal.setAttribute('aria-hidden', 'true');
    signal.append(
      createElement('span', '', String(index + 1).padStart(2, '0')),
      createElement('i'),
      createElement('i'),
      createElement('i')
    );
    card.append(signal);
  }

  const body = createElement('div', 'home-blog-body');
  const meta = createElement('div', 'home-blog-meta');
  meta.append(
    createElement('span', '', post.category),
    createElement('time', '', formatBlogDate(post.published))
  );

  const title = createElement('h3', '', post.title);
  const excerpt = createElement('p', '', post.excerpt);
  const footer = createElement('div', 'home-blog-footer');
  footer.append(
    createElement('span', '', post.readTime),
    createElement('b', '', '->')
  );
  body.append(meta, title, excerpt, footer);
  card.append(body);

  return card;
}

function renderHomeBlog(posts) {
  if (!homeBlogGrid) return;
  homeBlogGrid.replaceChildren();
  posts
    .slice(0, 3)
    .forEach((post, index) => homeBlogGrid.append(createHomeBlogCard(post, index)));
}

// Render the bundled snapshot first so the strip is present in the initial HTML
// and never shifts layout, then quietly refresh from Supabase. Posts published
// since the last deploy appear without one, and if Supabase is unset, paused or
// slow, the bundled copy simply stays.
renderHomeBlog(blogContent.posts);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function refreshHomeBlog() {
  if (!homeBlogGrid || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const today = new Date().toISOString().slice(0, 10);
  const query =
    `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/posts` +
    '?select=slug,title,excerpt,category,published,read_time,image,image_alt' +
    `&status=eq.published&published=lte.${today}&order=published.desc&limit=3`;

  try {
    const response = await fetch(query, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return;

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return;

    renderHomeBlog(
      rows.map((row) => ({
        ...row,
        readTime: row.read_time,
        imageAlt: row.image_alt || '',
      }))
    );
  } catch {
    // Keep the bundled posts. A stale strip beats an empty one.
  }
}

refreshHomeBlog();

document.querySelectorAll('[data-solution]').forEach((element) => {
  element.addEventListener('click', () => setSolution(element.dataset.solution));
  element.addEventListener('pointerenter', () => setSolution(element.dataset.solution));
});

const projectTabs = [...document.querySelectorAll('[data-project-tab]')];
const projectPanels = [...document.querySelectorAll('[data-project-panel]')];

function setActiveProject(projectId, focusTab = false) {
  projectTabs.forEach((tab) => {
    const isActive = tab.dataset.projectTab === projectId;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    if (isActive && focusTab) tab.focus();
  });

  projectPanels.forEach((panel) => {
    const isActive = panel.dataset.projectPanel === projectId;
    panel.hidden = !isActive;
    panel.classList.toggle('active', isActive);
  });
}

projectTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => setActiveProject(tab.dataset.projectTab));
  tab.addEventListener('keydown', (event) => {
    const navigationKeys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!navigationKeys.includes(event.key)) return;

    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % projectTabs.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + projectTabs.length) % projectTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = projectTabs.length - 1;
    }

    setActiveProject(projectTabs[nextIndex].dataset.projectTab, true);
  });
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const supportsFinePointer = window.matchMedia('(pointer: fine)').matches;

if (!prefersReducedMotion && supportsFinePointer) {
  document.querySelectorAll('.project-visual').forEach((visual) => {
    visual.addEventListener('pointermove', (event) => {
      const bounds = visual.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      visual.style.setProperty('--visual-x', `${x * 100}%`);
      visual.style.setProperty('--visual-y', `${y * 100}%`);
      visual.style.setProperty('--visual-rotate-x', `${(0.5 - y) * 2.2}deg`);
      visual.style.setProperty('--visual-rotate-y', `${(x - 0.5) * 2.2}deg`);
    });

    visual.addEventListener('pointerleave', () => {
      visual.style.setProperty('--visual-rotate-x', '0deg');
      visual.style.setProperty('--visual-rotate-y', '0deg');
    });
  });
}

document.querySelectorAll('.faq-item').forEach((item) => {
  item.setAttribute('aria-expanded', String(item.classList.contains('active')));
  item.addEventListener('click', () => {
    document.querySelectorAll('.faq-item').forEach((other) => {
      if (other !== item) {
        other.classList.remove('active');
        other.setAttribute('aria-expanded', 'false');
      }
    });
    item.classList.toggle('active');
    item.setAttribute('aria-expanded', String(item.classList.contains('active')));
  });
});

const sectionLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const linkedSections = sectionLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!visibleEntry) return;

      sectionLinks.forEach((link) => {
        link.classList.toggle('current', link.getAttribute('href') === `#${visibleEntry.target.id}`);
      });
    },
    { rootMargin: '-24% 0px -58% 0px', threshold: [0.01, 0.2, 0.45] }
  );
  linkedSections.forEach((section) => sectionObserver.observe(section));
}

window.addEventListener('scroll', () => {
  document.body.classList.toggle('scrolled', window.scrollY > 34);
});

document.body.classList.toggle('scrolled', window.scrollY > 34);

setSolution(activeSolution);
initializeNavMenu();

// The tesseract backdrop is decorative, so load three.js after the page is
// interactive instead of letting ~490 KB sit in the critical path.
const canvas = document.querySelector('#webgl');

if (canvas) {
  import('./tesseract.js')
    .then(({ startTesseract }) =>
      startTesseract(canvas, () => solutionCopy[activeSolution].color)
    )
    .catch(() => canvas.remove());
}
