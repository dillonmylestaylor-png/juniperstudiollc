// Uploads the preview clips to the private Netlify Blobs store "catalog-previews" (key "audio/<id>").
// Run AFTER the site has been deployed with the /catalog page. Needs NETLIFY_AUTH_TOKEN and the site id
// (NETLIFY_SITE_ID) in .env or the environment.
// Usage: node scripts/upload-catalog-previews.js [clip-dir]
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.indexOf('=') === -1) continue;
    const k = t.slice(0, t.indexOf('=')).trim();
    let v = t.slice(t.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}
const { getStore } = require('@netlify/blobs');
const dir = process.argv[2] || '/Volumes/Mac/Claude SSD/Song Previews/previews_orig';
const index = require('../netlify/functions/data/catalog.json');
(async () => {
  const store = getStore({ name: 'catalog-previews', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
  let n = 0;
  for (const s of index.songs) for (const v of s.versions) {
    await store.set('audio/' + v.id, fs.readFileSync(path.join(dir, v.file)));
    n++;
    if (n % 10 === 0) console.log(n + ' uploaded');
  }
  console.log('Done: ' + n + ' clips');
})().catch((e) => { console.error(e); process.exit(1); });
