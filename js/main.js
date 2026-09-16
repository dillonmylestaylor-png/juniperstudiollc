/* Juniper Studio LLC - Main JS */

(function loadAnalytics() {
  const id = window.JUNIPER_GA_ID || 'G-XXXXXXXXXX';
  if (!id || id.indexOf('XXXX') !== -1) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id, { anonymize_ip: true });
})();

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  // Highlight active page
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === current) a.classList.add('active');
  });

  if (!document.querySelector('.sticky-call')) {
    const call = document.createElement('a');
    call.href = 'tel:+16156649985';
    call.className = 'sticky-call';
    call.textContent = 'Call / Text';
    document.body.appendChild(call);
  }

  const COUPON = 'JUNIPER10';
  function hasListSignup() {
    return localStorage.getItem('juniper_list') === '1';
  }

  document.querySelectorAll('a[href*="/checkout"]').forEach(a => {
    a.addEventListener('click', () => {
      if (!hasListSignup()) return;
      try {
        const url = new URL(a.href, window.location.origin);
        if (url.searchParams.get('plugin')) return;
        url.searchParams.set('coupon', COUPON);
        a.href = url.pathname + url.search;
      } catch (e) {}
    });
  });

  const recPay = document.getElementById('recPayBtn');
  if (recPay) {
    recPay.addEventListener('click', () => {
      if (!hasListSignup()) return;
      const href = recPay.getAttribute('href') || recPay.href;
      if (href && href.indexOf('coupon=') === -1) {
        recPay.href = href + (href.indexOf('?') === -1 ? '?' : '&') + 'coupon=' + COUPON;
      }
    }, true);
  }

  if (!hasListSignup() && !sessionStorage.getItem('juniper_list_seen')) {
    setTimeout(() => {
      if (document.querySelector('.list-modal')) return;
      const modal = document.createElement('div');
      modal.className = 'list-modal open';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-label', 'Email list');
      modal.innerHTML = '<div class="list-modal-card">' +
        '<button type="button" class="list-modal-close" aria-label="Close">&times;</button>' +
        '<h3>10% off your next session</h3>' +
        '<p>Join the list for studio news, plugin drops, and a code for 10% off recording, mixing, or mastering.</p>' +
        '<form id="listForm">' +
        '<input type="email" name="email" placeholder="you@email.com" required autocomplete="email">' +
        '<button type="submit" class="btn btn-primary">Get 10% off</button>' +
        '</form>' +
        '<p class="list-modal-note">Code: JUNIPER10 · applied at checkout</p>' +
        '</div>';
      document.body.appendChild(modal);

      function closeModal() {
        modal.classList.remove('open');
        sessionStorage.setItem('juniper_list_seen', '1');
      }

      modal.querySelector('.list-modal-close').addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

      modal.querySelector('#listForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = this.email.value.trim();
        const btn = this.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Sending...';
        fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ 'form-name': 'email-list', email: email }).toString()
        })
          .then(() => {
            localStorage.setItem('juniper_list', '1');
            modal.querySelector('.list-modal-card').innerHTML =
              '<h3>You\'re in.</h3>' +
              '<p>Use code <strong>JUNIPER10</strong> at checkout for 10% off. It will apply automatically when you pay from this browser.</p>' +
              '<button type="button" class="btn btn-primary list-done">Got it</button>';
            modal.querySelector('.list-done').addEventListener('click', closeModal);
          })
          .catch(() => {
            btn.disabled = false;
            btn.textContent = 'Get 10% off';
            alert('Couldn\'t sign up — email Info@JuniperStudioLLC.com and we\'ll send the code.');
          });
      });
    }, 8000);
  }
});
