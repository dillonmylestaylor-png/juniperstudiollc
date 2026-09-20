/* Juniper Studio LLC - Main JS */

(function loadAnalytics() {
  const id = window.JUNIPER_GA_ID || 'G-QTT9R5C42B';
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
  if (!sessionStorage.getItem('juniper_sale_hide') && !document.querySelector('.sale-banner')) {
    const banner = document.createElement('div');
    banner.className = 'sale-banner';
    banner.innerHTML = '50% off production — code <strong>PRODUCTION50</strong> (one use per email) · <a href="services.html">See rates</a>' +
      '<button type="button" class="sale-banner-close" aria-label="Dismiss">&times;</button>';
    document.body.prepend(banner);
    document.body.classList.add('has-sale-banner');
    banner.querySelector('.sale-banner-close').addEventListener('click', () => {
      banner.remove();
      document.body.classList.remove('has-sale-banner');
      sessionStorage.setItem('juniper_sale_hide', '1');
    });
  }

  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  const reviews = document.getElementById('reviews');
  const reviewsToggle = document.getElementById('reviewsToggle');
  if (reviews && reviewsToggle) {
    reviewsToggle.addEventListener('click', () => {
      reviews.classList.toggle('collapsed');
      const open = !reviews.classList.contains('collapsed');
      reviewsToggle.textContent = open ? 'Show fewer reviews' : 'Show more reviews';
      reviewsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
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
    a.addEventListener('click', (e) => {
      try {
        const url = new URL(a.getAttribute('href'), window.location.origin);
        if (url.searchParams.get('plugin')) return;
        if (url.searchParams.get('coupon') === 'PRODUCTION50' && !url.searchParams.get('email')) {
          e.preventDefault();
          const saved = localStorage.getItem('juniper_checkout_email') || '';
          const email = saved || window.prompt('Email for this checkout (saved on this device):');
          if (!email) return;
          localStorage.setItem('juniper_checkout_email', email.trim());
          url.searchParams.set('email', email.trim());
          window.location.href = url.pathname + url.search;
          return;
        }
        if (hasListSignup() && url.searchParams.get('coupon') !== 'PRODUCTION50') {
          url.searchParams.set('coupon', COUPON);
          a.href = url.pathname + url.search;
        }
      } catch (err) {}
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
        '<p>Join the list for studio news and plugin drops. Enter a real email and we\'ll give you 10% off recording, mixing, or mastering.</p>' +
        '<form id="listForm">' +
        '<input type="email" name="email" placeholder="you@email.com" required autocomplete="email">' +
        '<button type="submit" class="btn btn-primary">Get 10% off</button>' +
        '</form>' +
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
          body: new URLSearchParams({ 'form-name': 'email-list', email: email, source: 'discount-popup' }).toString()
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


/* --- Thanks-for-downloading modal with optional email capture -----------------
   Fires AFTER a download link is clicked; the download itself is never blocked or
   gated. Reuses the .list-modal styling and the same `email-list` Netlify form as
   the 10%-off popup, tagged source=download so the two are tellable apart. */
(function () {
  var links = document.querySelectorAll('a[href*="downloads/"]');
  if (!links.length) return;

  function show() {
    if (document.querySelector('.list-modal')) return; // never stack on the 10%-off popup
    var subscribed = false;
    try { subscribed = localStorage.getItem('juniper_list') === '1'; } catch (e) {}

    var modal = document.createElement('div');
    modal.className = 'list-modal open';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Thanks for downloading');
    modal.innerHTML = '<div class="list-modal-card">' +
      '<button type="button" class="list-modal-close" aria-label="Close">&times;</button>' +
      '<h3>Thanks for downloading!</h3>' +
      (subscribed
        ? '<p>Your download is on its way. Run the installer, then open JS-505 in your DAW &mdash; it\'s free to use for 30 days.</p>' +
          '<button type="button" class="btn btn-primary list-done">Got it</button>'
        : '<p>Your download is on its way. Want an email when there\'s an update or a fix? Totally optional.</p>' +
          '<form id="dlForm">' +
          '<input type="email" name="email" placeholder="you@email.com" autocomplete="email" required>' +
          '<button type="submit" class="btn btn-primary">Keep me posted</button>' +
          '</form>' +
          '<button type="button" class="btn btn-outline list-done" style="margin-top:0.6rem;">No thanks</button>'
      ) +
      '</div>';
    document.body.appendChild(modal);

    function close() {
      modal.classList.remove('open');
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    }
    modal.querySelector('.list-modal-close').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    var no = modal.querySelector('.list-done');
    if (no) no.addEventListener('click', close);

    var form = modal.querySelector('#dlForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = this.email.value.trim();
      var btn = this.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Sending...';
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 'form-name': 'email-list', email: email, source: 'download' }).toString()
      })
        .then(function () {
          try { localStorage.setItem('juniper_list', '1'); } catch (e) {}
          modal.querySelector('.list-modal-card').innerHTML =
            '<h3>You\'re on the list.</h3>' +
            '<p>We\'ll email you when there\'s an update. Enjoy the plugin.</p>' +
            '<button type="button" class="btn btn-primary list-done">Got it</button>';
          modal.querySelector('.list-done').addEventListener('click', close);
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'Keep me posted';
          alert('Couldn\'t sign up just now — email Info@JuniperStudioLLC.com and we\'ll add you.');
        });
    });
  }

  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', function () { setTimeout(show, 900); });
  }
})();
