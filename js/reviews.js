// Plugin reviews: <section data-reviews="js2"> ... </section> on a plugin page.
// Shows approved reviews from /api/reviews and sends new ones there (they wait for approval).
(function () {
  var box = document.querySelector('[data-reviews]');
  if (!box) return;
  var plugin = box.getAttribute('data-reviews');
  var list = box.querySelector('.reviews-list');
  var summary = box.querySelector('.reviews-summary');
  var form = box.querySelector('.review-form');
  var status = box.querySelector('.review-status');

  function stars(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= Math.round(n) ? '★' : '☆';
    return s;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  fetch('/api/reviews?plugin=' + encodeURIComponent(plugin))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) return;
      if (!d.count) { summary.textContent = 'No reviews yet. Tried it? Be the first.'; return; }
      summary.textContent = '';
      summary.appendChild(el('span', 'review-stars', stars(d.average)));
      summary.appendChild(document.createTextNode(' ' + d.average.toFixed(1) + ' out of 5 · ' + d.count + (d.count === 1 ? ' review' : ' reviews')));
      d.reviews.forEach(function (r) {
        var card = el('div', 'card review');
        var head = el('p', 'review-head');
        head.appendChild(el('span', 'review-stars', stars(r.rating)));
        head.appendChild(el('strong', null, ' ' + r.name));
        if (r.verified) head.appendChild(el('span', 'review-badge', 'Verified owner'));
        card.appendChild(head);
        r.text.split(/\n\n+/).forEach(function (para) { card.appendChild(el('p', 'review-text', para)); });
        card.appendChild(el('p', 'review-date', new Date(r.created).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })));
        list.appendChild(card);
      });
    })
    .catch(function () { summary.textContent = ''; });

  var picked = 0;
  var starBtns = form.querySelectorAll('.star-pick button');
  function paint(n) { starBtns.forEach(function (b, i) { b.textContent = i < n ? '★' : '☆'; b.setAttribute('aria-pressed', i < picked ? 'true' : 'false'); }); }
  starBtns.forEach(function (b, i) {
    b.addEventListener('click', function () { picked = i + 1; paint(picked); });
    b.addEventListener('mouseenter', function () { paint(i + 1); });
  });
  form.querySelector('.star-pick').addEventListener('mouseleave', function () { paint(picked); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!picked) { status.textContent = 'Pick a star rating first.'; return; }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true; status.textContent = 'Sending…';
    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plugin: plugin, rating: picked,
        name: form.elements.name.value, email: form.elements.email.value,
        text: form.elements.text.value, website: form.elements.website.value
      })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.ok) {
        form.reset(); picked = 0; paint(0);
        status.textContent = 'Thanks! Your review will show up here once it’s approved.';
      } else {
        status.textContent = d.error || 'Something went wrong. Try again?';
      }
      btn.disabled = false;
    }).catch(function () { status.textContent = 'Couldn’t send that. Try again?'; btn.disabled = false; });
  });
})();
