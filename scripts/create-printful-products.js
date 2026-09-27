// Creates (or updates) the four shirts as products in the Printful API store, every size, with the
// print files served from the live site. Run AFTER the site is pushed (Printful downloads the files):
//   node scripts/create-printful-products.js
// Reads PRINTFUL_API_TOKEN from .env and never prints it. Idempotent: products are matched by external_id.
const fs = require('fs');
const path = require('path');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  const k = t.slice(0, i).trim(); if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
const { MERCH, SIZES, PRICE_CENTS, variantId, printFileUrl } = require('../netlify/functions/utils/merch');
const H = { Authorization: 'Bearer ' + process.env.PRINTFUL_API_TOKEN, 'X-PF-Store-Id': '18816469', 'Content-Type': 'application/json' };
const api = async (method, p, body) => {
  const r = await fetch('https://api.printful.com' + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
};

(async () => {
  for (const item of Object.values(MERCH)) {
    const file = printFileUrl(item);
    const head = await fetch(file, { method: 'HEAD' });
    if (!head.ok) { console.log(item.id, 'SKIPPED: print file not live yet at', file); continue; }
    const variants = SIZES.map((size) => ({
      external_id: item.id + '-' + size,
      variant_id: variantId(item, size),
      retail_price: (PRICE_CENTS[size] / 100).toFixed(2),
      files: [{ type: 'front', url: file }],
    }));
    const existing = await api('GET', '/store/products/@' + item.id);
    if (existing.status === 200) {
      const r = await api('PUT', '/store/products/@' + item.id, { sync_product: { name: item.name }, sync_variants: variants });
      console.log(item.id, 'updated', r.status, r.status === 200 ? '' : JSON.stringify(r.j.error || r.j).slice(0, 200));
    } else {
      const r = await api('POST', '/store/products', { sync_product: { external_id: item.id, name: item.name }, sync_variants: variants });
      console.log(item.id, 'created', r.status, r.status === 200 ? r.j.result.id : JSON.stringify(r.j.error || r.j).slice(0, 200));
    }
  }
  // Shipping notifications: Printful tells the site when a package ships; the site emails the tracking link.
  const hook = await api('POST', '/webhooks', { url: 'https://juniperstudiollc.com/.netlify/functions/printful-webhook', types: ['package_shipped'] });
  console.log('webhook', hook.status, JSON.stringify(hook.j.result || hook.j.error || hook.j).slice(0, 200));
})().catch((e) => { console.error(e.message); process.exit(1); });
