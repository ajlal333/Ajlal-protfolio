/**
 * Compact-viewport navigation menu.
 *
 * The nav links are hidden by CSS below 1080px (980px on the offer page). Without
 * this, a phone or tablet visitor has no way to reach Services, Work, Blog,
 * Support Sprint or Credentials. This turns the hidden link list into a
 * disclosure panel driven by the pill's own toggle button.
 *
 * Works for both nav layouts by matching on data attributes rather than classes.
 */
export function initializeNavMenu() {
  const root = document.querySelector('[data-nav-menu-root]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.getElementById('nav-menu');

  if (!root || !toggle || !menu) return;

  function setOpen(open) {
    root.dataset.navOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  setOpen(false);

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(root.dataset.navOpen !== 'true');
  });

  // Following a link should dismiss the panel, including same-page anchors.
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (root.dataset.navOpen === 'true' && !root.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.dataset.navOpen === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  // Reset when the layout grows back past the breakpoint.
  const wide = window.matchMedia('(min-width: 1081px)');
  wide.addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}
