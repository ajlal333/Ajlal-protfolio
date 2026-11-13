const bookingRecipient = 'ajlal@logicfolds.com';

function buildFallbackMailto(payload) {
  const subject = `Free automation audit request from ${payload.company || payload.name}`;
  const body = [
    'New free automation audit request',
    '',
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company: ${payload.company || 'Not provided'}`,
    `Service: ${payload.service || 'Free Automation Audit'}`,
    '',
    'Task that takes the most retyping:',
    payload.message,
  ].join('\n');

  return `mailto:${bookingRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

let toastTimer;

/** Small confirmation card in the corner, announced to screen readers. */
function showToast(title, message) {
  let toast = document.getElementById('booking-toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'booking-toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">&#10003;</span>
      <div class="toast-body"><strong></strong><p></p></div>
      <button class="toast-close" type="button" aria-label="Dismiss notification">x</button>`;
    toast.querySelector('.toast-close').addEventListener('click', () => hideToast(toast));
    document.body.append(toast);
  }

  toast.querySelector('strong').textContent = title;
  toast.querySelector('p').textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => {
    toast.dataset.visible = 'true';
  });

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hideToast(toast), 7000);
}

function hideToast(toast) {
  clearTimeout(toastTimer);
  toast.dataset.visible = 'false';
  setTimeout(() => {
    if (toast.dataset.visible === 'false') toast.hidden = true;
  }, 240);
}

export function initializeBooking({ defaultService = '' } = {}) {
  const bookingDialog = document.getElementById('booking-dialog');
  const bookingForm = document.getElementById('booking-form');
  const formStatus = document.getElementById('form-status');

  if (!bookingDialog || !bookingForm) return;

  // Hidden field that tells the owner which page the request came from.
  const serviceField = bookingForm.elements.namedItem('service');
  if (defaultService && serviceField) serviceField.value = defaultService;

  function setFormStatus(message, tone = 'neutral') {
    if (!formStatus) return;
    formStatus.textContent = message;
    formStatus.dataset.tone = tone;
  }

  function openBookingDialog() {
    if (typeof bookingDialog.showModal === 'function') {
      bookingDialog.showModal();
    } else {
      bookingDialog.setAttribute('open', '');
    }
    document.body.classList.add('modal-open');
    setFormStatus('');
    bookingDialog.querySelector('input, select, textarea')?.focus();
  }

  function closeBookingDialog() {
    if (typeof bookingDialog.close === 'function') {
      bookingDialog.close();
    } else {
      bookingDialog.removeAttribute('open');
    }
    document.body.classList.remove('modal-open');
  }

  document.querySelectorAll('[data-open-booking]').forEach((button) => {
    button.addEventListener('click', openBookingDialog);
  });

  document.querySelectorAll('[data-close-booking]').forEach((button) => {
    button.addEventListener('click', closeBookingDialog);
  });

  bookingDialog.addEventListener('click', (event) => {
    if (event.target === bookingDialog) closeBookingDialog();
  });

  bookingDialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
  });

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = bookingForm.querySelector('button[type="submit"]');
    const payload = Object.fromEntries(new FormData(bookingForm).entries());
    const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (payload.companyFax) return;

    submitButton.disabled = true;
    setFormStatus('Sending your audit request...', 'neutral');

    try {
      const response = await fetch('/api/book-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const details = await response.json().catch(() => ({}));

        // A 4xx means the submission itself needs fixing (invalid email, too
        // brief, throttled). Show that inline rather than bouncing the visitor
        // into their mail client. 404 still means the endpoint is missing, so
        // it falls through to the mailto fallback below.
        if (response.status >= 400 && response.status < 500 && response.status !== 404) {
          setFormStatus(details.error || 'Please check the form and try again.', 'warning');
          bookingForm.elements.namedItem(details.fields?.[0] ?? '')?.focus();
          return;
        }

        throw new Error(details.error || 'Booking email service unavailable');
      }

      bookingForm.reset();
      if (defaultService && serviceField) serviceField.value = defaultService;
      setFormStatus('');
      closeBookingDialog();
      showToast(
        'Request sent',
        'Check your inbox for a confirmation. We reply within one business day to set a time for your audit call.'
      );
    } catch (error) {
      window.location.href = buildFallbackMailto(payload);
      setFormStatus(
        isLocalPreview
          ? 'Local preview cannot send email through Netlify Functions. Your email app should open with the request ready to send.'
          : 'Email service is not available yet. Your email app should open with the request ready to send.',
        'warning'
      );
    } finally {
      submitButton.disabled = false;
    }
  });
}
