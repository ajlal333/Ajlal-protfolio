import './blog.css';
import { initializeBooking } from './booking.js';
import { initializeNavMenu } from './nav.js';
import { initAnalytics } from './analytics.js';

initAnalytics();

const articleTitle = document.body.dataset.articleTitle;

initializeBooking({
  defaultService: articleTitle
    ? `Free Automation Audit (from blog: ${articleTitle})`
    : 'Free Automation Audit',
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

// Email signup: posts to the same endpoint as the booking form, which emails
// the owner. No account or third-party list is involved.
document.querySelectorAll('[data-blog-signup]').forEach((form) => {
  const status = form.querySelector('[data-signup-status]');
  const button = form.querySelector('button[type="submit"]');

  function setStatus(message, tone) {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    if (payload.companyFax) return;

    const emailField = form.elements.namedItem('email');
    if (emailField && !emailField.checkValidity()) {
      setStatus('Please enter a valid email address.', 'warning');
      emailField.focus();
      return;
    }

    button.disabled = true;
    setStatus('Adding you to the list...', 'neutral');

    try {
      const response = await fetch('/api/book-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'signup',
          email: payload.email,
          service: 'Blog email signup',
          source: window.location.pathname,
          companyFax: payload.companyFax,
        }),
      });
      const details = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(details.error || 'Something went wrong. Please try again.', 'warning');
        return;
      }

      form.reset();
      setStatus('Thanks. You are on the list.', 'success');
    } catch {
      setStatus('We could not reach the server. Please try again in a moment.', 'warning');
    } finally {
      button.disabled = false;
    }
  });
});
