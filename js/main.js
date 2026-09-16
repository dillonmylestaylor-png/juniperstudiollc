/* Juniper Studio LLC - Main JS */

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
});
