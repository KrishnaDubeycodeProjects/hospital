/**
 * Aarogya Flow - WhatsApp WebView Common Client SDK
 * Handles token authentication, backend API base URL resolution,
 * automatic ngrok header injection, and WhatsApp bot redirection.
 */
(function (window) {
  const urlParams = new URLSearchParams(window.location.search);
  const rawPhone = urlParams.get('phone') || '+918850934544';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const token = urlParams.get('token') || '';
  const lang = (urlParams.get('lang') || 'en').toLowerCase();

  // Determine API base: same origin if proxied or served together, fallback to port 8088
  let apiBase = '';
  if (window.location.port === '5173') {
    apiBase = ''; // proxied via vite to 8088
  } else if (!window.location.origin.includes(':8088') && window.location.protocol.startsWith('file')) {
    apiBase = 'http://localhost:8088';
  }

  let botPhoneNumber = '919120123877';

  // Fetch bot config
  fetch(apiBase + '/api/wa/config', {
    headers: { 'ngrok-skip-browser-warning': 'true' }
  })
    .then(r => r.json())
    .then(c => {
      if (c.botPhoneNumber) botPhoneNumber = c.botPhoneNumber.replace(/\D/g, '');
    })
    .catch(() => {});

  async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : (apiBase + endpoint);
    const headers = Object.assign({
      'ngrok-skip-browser-warning': 'true',
    }, options.headers || {});

    if (token && !headers['Authorization']) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    return fetch(url, Object.assign({}, options, { headers }));
  }

  function returnToBot(actionText) {
    if (actionText) {
      const msg = encodeURIComponent(actionText);
      window.location.href = 'https://wa.me/' + botPhoneNumber + '?text=' + msg;
    } else {
      window.location.href = 'https://wa.me/' + botPhoneNumber;
    }
  }

  function getForwardParams(extra = {}) {
    const p = new URLSearchParams();
    if (rawPhone) p.append('phone', rawPhone);
    if (token) p.append('token', token);
    if (lang) p.append('lang', lang);
    for (const k in extra) {
      if (extra[k] !== undefined && extra[k] !== null) {
        p.append(k, extra[k]);
      }
    }
    return p.toString();
  }

  window.WaCommon = {
    rawPhone,
    cleanPhone,
    token,
    lang,
    apiBase,
    getBotPhone: () => botPhoneNumber,
    apiFetch,
    returnToBot,
    getForwardParams
  };
})(window);
