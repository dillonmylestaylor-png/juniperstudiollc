// "You made a sale" notices for Dillon: an email to Info@ and, if NTFY_TOPIC is set, a push
// notification through ntfy.sh (free phone app; subscribe to the same topic name). Sent once per
// sale: `key` is remembered in Blobs so a retried webhook can't notify twice. Never throws.
const { getStore } = require('@netlify/blobs');

function money(value, currency) {
  const n = Number(value) || 0;
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'USD').toUpperCase() }).format(n); }
  catch (e) { return '$' + n.toFixed(2); }
}

async function notifySale({ key, title, lines, link }) {
  try {
    if (key) {
      const s = getStore('sale-notices');
      if (await s.get(key)) return { skipped: 'duplicate' };
      await s.setJSON(key, { t: Date.now(), title });
    }
  } catch (err) { console.error('sale notice dedupe failed:', err.message); }

  const text = lines.filter(Boolean).join('\n') + (link ? `\n\n${link}` : '');
  const out = {};
  try {
    const { sendSaleNotice } = require('./mail');
    await sendSaleNotice({ subject: title, text });
    out.email = true;
  } catch (err) { console.error('sale email failed:', err.message); out.email = false; }

  const topic = process.env.NTFY_TOPIC;
  if (topic) {
    try {
      const headers = { Title: title.replace(/[^\x20-\x7E]/g, ''), Tags: 'moneybag', Priority: 'high' };
      if (link) headers.Click = link;
      const r = await fetch('https://ntfy.sh/' + encodeURIComponent(topic), { method: 'POST', headers, body: lines.filter(Boolean).join('\n') });
      out.push = r.ok;
    } catch (err) { console.error('sale push failed:', err.message); out.push = false; }
  }
  return out;
}

module.exports = { notifySale, money };
