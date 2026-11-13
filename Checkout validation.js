/* checkout-validation.js — business rules of the checkout form (logic only; the design lives in Pages/checkout.html).
   The HTML gives each field a name and an error box: <p data-error-for="NAME">.
   Fields: email, fullname, document, mobile, address, city, cc-number, cc-exp, cc-csc, cc-name, doc-num, policies */
(() => {
  'use strict';
  const form = document.querySelector('[data-checkout-form]');
  if (!form) return;
  const status = document.querySelector('[data-checkout-status]');

  /* The message box under the form. state = 'error' | 'success' (the HTML styles each one with data-[state=...] classes).
     The purchase (success) message is shown ONLY after a submit where every field is valid and the cart has products. */
  const setStatus = (message, state) => { if (status) { status.textContent = message; status.dataset.state = state; } };
  const clearStatus = () => { if (status) { status.textContent = ''; delete status.dataset.state; } };
  const CART_KEY = 'tailwear-cart'; // must be the same key that cart.js uses

  /* ---------- BUSINESS RULES: each rule receives the value and returns an error message ('' = valid) ---------- */
  const isDigits = v => /^\d+$/.test(v);
  // Document rule (used twice): required, numbers only, 6 to 10 digits
  const documentRule = label => v => !v ? `${label} is required.` : !isDigits(v) ? `${label} must contain only numbers.` : (v.length < 6 || v.length > 10) ? `${label} must have between 6 and 10 digits.` : '';

  const RULES = {
    // Full name: required, at least 3 characters
    fullname: v => !v ? 'Full name is required.' : v.length < 3 ? 'Full name must have at least 3 characters.' : '',
    // Document: required, numbers only, 6 to 10 digits
    document: documentRule('Document'),
    // Email: required, valid format (name@domain.com)
    email: v => !v ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? 'Enter a valid email, like name@email.com.' : '',
    // Mobile: required, 10 digits, must start with 3
    mobile: v => !v ? 'Mobile is required.' : !isDigits(v) ? 'Mobile must contain only numbers.' : v.length !== 10 ? 'Mobile must have exactly 10 digits.' : v[0] !== '3' ? 'Mobile must start with 3.' : '',
    // Address and city: required (only for "Shipping", see ACTIVE below)
    address: v => v ? '' : 'Address is required.',
    city: v => v ? '' : 'City is required.',
    // Card fields: required (only when the payment method is "Credit card")
    'cc-number': v => {
      const digits = v.replace(/\s/g, '');
      return !digits ? 'Card number is required.' : !isDigits(digits) ? 'Card number must contain only numbers.' : (digits.length < 13 || digits.length > 19) ? 'Card number must have between 13 and 19 digits.' : '';
    },
    'cc-exp': v => {
      const text = v.replace(/\s/g, '');                      // "12 / 28" -> "12/28"
      if (!text) return 'Expiry date is required.';
      const match = text.match(/^(\d{2})\/(\d{2})$/);
      if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return 'Use the format MM / YY with a valid month.';
      const firstDayAfterExpiry = new Date(2000 + Number(match[2]), Number(match[1]), 1); // a card is valid until the end of its month
      return firstDayAfterExpiry <= new Date() ? 'This card is expired.' : '';
    },
    'cc-csc': v => !v ? 'Security code is required.' : !isDigits(v) ? 'Security code must contain only numbers.' : (v.length < 3 || v.length > 4) ? 'Security code must have 3 or 4 digits.' : '',
    'cc-name': v => !v ? 'Name on card is required.' : v.length < 3 ? 'Name on card must have at least 3 characters.' : '',
    'doc-num': documentRule('Cardholder document'),
    // Purchase policies: must be accepted (value is true / false)
    policies: accepted => accepted ? '' : 'You must accept the purchase policies to continue.'
  };
  const NAMES = Object.keys(RULES);

  /* Rules that only apply in some cases. A rule that is not listed here always applies.
     Hidden fields can not be filled, so asking for them would block the customer. */
  const isShipping = () => form.elements.entrega.value === 'envio';
  const isCard = () => form.elements.pago.value === 'tarjeta';
  const ACTIVE = { address: isShipping, city: isShipping, 'cc-number': isCard, 'cc-exp': isCard, 'cc-csc': isCard, 'cc-name': isCard, 'doc-num': isCard };
  const isActive = name => (ACTIVE[name] ? ACTIVE[name]() : true);

  /* Reads a field: text is trimmed and repeated spaces are collapsed; checkboxes return true / false */
  const read = name => {
    const el = form.elements[name];
    return el.type === 'checkbox' ? el.checked : el.value.trim().replace(/\s+/g, ' ');
  };

  /* Validates one field, shows or clears its message and returns true when it is valid */
  function validate(name) {
    const el = form.elements[name];
    const message = isActive(name) ? RULES[name](read(name)) : ''; // inactive rule = always valid
    const box = form.querySelector(`[data-error-for="${name}"]`);
    if (box) box.textContent = message;
    message ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid');
    return !message;
  }

  /* ---------- Typing helpers: keep the text clean while the customer types or pastes ---------- */
  const onlyDigits = el => { el.value = el.value.replace(/\D/g, ''); };
  const FORMATTERS = {
    document: onlyDigits, mobile: onlyDigits, 'cc-csc': onlyDigits, 'doc-num': onlyDigits,
    // 1234567890123456 -> 1234 5678 9012 3456
    'cc-number': el => { el.value = el.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); },
    // 1228 -> 12 / 28
    'cc-exp': el => { const d = el.value.replace(/\D/g, '').slice(0, 4); el.value = d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d; }
  };

  NAMES.forEach(name => {
    const el = form.elements[name];
    const isCheck = el.type === 'checkbox';
    if (FORMATTERS[name]) el.addEventListener('input', () => FORMATTERS[name](el));
    // Validate when leaving the field; after an error, re-check on every keystroke so the message disappears as soon as it is fixed
    el.addEventListener(isCheck ? 'change' : 'blur', () => validate(name));
    if (!isCheck) el.addEventListener('input', () => { if (el.getAttribute('aria-invalid')) validate(name); });
  });

  // Switching Shipping / Pickup or the payment method: clear the errors of the fields that are not needed anymore
  form.querySelectorAll('input[name="entrega"], input[name="pago"]').forEach(radio =>
    radio.addEventListener('change', () => Object.keys(ACTIVE).filter(name => !isActive(name)).forEach(validate)));

  /* Business rule: you can not pay with an empty cart (reads the cart saved by cart.js) */
  const cartIsEmpty = () => {
    try { return !(JSON.parse(localStorage.getItem(CART_KEY)) || []).length; } catch { return true; }
  };

  // If the customer changes ANYTHING after a message appeared, the message is hidden: it could be out of date
  // (for example a success message while the data is being edited). It comes back only after pressing "Pay now" again.
  form.addEventListener('input', clearStatus);
  form.addEventListener('change', clearStatus);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const invalid = NAMES.filter(name => !validate(name)); // validate ALL fields so every error is shown at once
    if (cartIsEmpty()) {
      setStatus('Your cart is empty. Add at least one product before paying.', 'error');
      return;
    }
    if (invalid.length) {
      setStatus('Please fix the highlighted fields.', 'error');
      form.elements[invalid[0]].focus();
      return;
    }
    // TODO: here you would send the order to your backend / payment provider. For now it is a demo.
    setStatus('Thank you! All your data is correct. This is a demo: no payment was processed.', 'success');
  });
})();