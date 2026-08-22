const bookingRecipient = 'ajlal@logicfolds.com';

function buildFallbackMailto(payload) {
  const subject = `LogicFolds inquiry from ${payload.company || payload.name}`;
  const body = [
    'New LogicFolds inquiry',
    '',
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company: ${payload.company || 'Not provided'}`,
    `Service: ${payload.service || 'LogicFolds project inquiry'}`,
    '',
    'What they want to improve:',
    payload.message,
  ].join('\n');

  return `mailto:${bookingRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function initializeBooking({ defaultService = '' } = {}) {
  const bookingDialog = document.getElementById('booking-dialog');
  const bookingForm = document.getElementById('booking-form');
  const formStatus = document.getElementById('form-status');

  if (!bookingDialog || !bookingForm) return;

  const serviceSelect = bookingForm.elements.namedItem('service');
  if (defaultService && serviceSelect) serviceSelect.value = defaultService;

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
    setFormStatus('Sending your call request...', 'neutral');

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
      if (defaultService && serviceSelect) serviceSelect.value = defaultService;
      setFormStatus('Request sent. We will reply by email.', 'success');
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
