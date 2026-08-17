import './opportunity-sprint.css';
import { initializeBooking } from './booking.js';

initializeBooking({ defaultService: 'AI Support Workflow Sprint' });

const updateNavigation = () => {
  document.body.classList.toggle('scrolled', window.scrollY > 24);
};

updateNavigation();
window.addEventListener('scroll', updateNavigation, { passive: true });

document.querySelectorAll('.faq-item').forEach((item) => {
  item.addEventListener('click', () => {
    const isOpen = item.classList.contains('active');

    document.querySelectorAll('.faq-item').forEach((candidate) => {
      candidate.classList.remove('active');
      candidate.setAttribute('aria-expanded', 'false');
      candidate.querySelector('b').textContent = '+';
    });

    if (!isOpen) {
      item.classList.add('active');
      item.setAttribute('aria-expanded', 'true');
      item.querySelector('b').textContent = '-';
    }
  });
});
