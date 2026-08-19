import './blog.css';
import { initializeBooking } from './booking.js';
import { initializeNavMenu } from './nav.js';

const articleTitle = document.body.dataset.articleTitle;

initializeBooking({
  defaultService: articleTitle
    ? `Blog inquiry: ${articleTitle}`
    : 'LogicFolds blog inquiry',
});

function updateNavigation() {
  document.body.classList.toggle('scrolled', window.scrollY > 34);
}

updateNavigation();
window.addEventListener('scroll', updateNavigation, { passive: true });

initializeNavMenu();

// The blog index is server-rendered, so the category chips filter cards that are
// already in the DOM rather than building the list.
const filters = document.querySelector('[data-blog-filters]');

if (filters) {
  const cards = [...document.querySelectorAll('[data-blog-list] .blog-list-card')];

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const category = button.textContent.trim();
    filters.querySelectorAll('button').forEach((candidate) => {
      candidate.setAttribute('aria-pressed', String(candidate === button));
    });

    cards.forEach((card) => {
      card.hidden = category !== 'All' && card.dataset.category !== category;
    });
  });
}
