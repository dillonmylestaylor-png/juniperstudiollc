// /api/catalog/* -- password-protected song previews (the /catalog page).
//   POST /api/catalog/login  {password}  -> sets a 30-day HttpOnly cookie
//   GET  /api/catalog/list               -> the song index (needs the cookie)
//   GET  /api/catalog/audio/<id>         -> one preview clip, with Range support so the player can seek (needs the cookie)
// Password: CATALOG_PASSWORD (falls back to ADMIN_PASSWORD until a separate one is set). Without either, the
// endpoints are closed. The clips live in the private Netlify Blobs store "catalog-previews" (key "audio/<id>"),
// never as public files. For local testing set CATALOG_PREVIEW_DIR to a folder of the original clip files.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { connectLambda, getStore } = require('@netlify/blobs');
const INDEX = require('./data/catalog.json');

const COOKIE = 'catalog_access';
const MAX_AGE = 30 * 86400;
const CHUNK = 3500000; // keep each response well under the 6 MB function limit; players just ask for the next range
const TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4' };

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const json = (statusCode, body, headers) => ({ statusCode, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {}), body: JSON.stringify(body) });
const password = () => process.env.CATALOG_PASSWORD || process.env.ADMIN_PASSWORD || '';
const secret = () => process.env.LICENSE_SIGNING_SECRET || password();
const sign = (exp) => crypto.createHmac('sha256', secret()).update('catalog|' + exp).digest('hex');

function hasAccess(event) {
  const m = /(?:^|;\s*)catalog_access=([^;]+)/.exec((event.headers || {}).cookie || '');
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = sign(exp);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}

function findFile(id) {
  for (const s of INDEX.songs) for (const v of s.versions) if (v.id === id) return v;
  return null;
}

async function readClip(v) {
  const dir = process.env.CATALOG_PREVIEW_DIR;
  if (dir) {
    const p = path.join(dir, v.file);
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  }
  const data = await getStore('catalog-previews').get('audio/' + v.id, { type: 'arrayBuffer' });
  return data ? Buffer.from(data) : null;
}

exports.handler = async (event) => {
  if (!password()) return json(503, { ok: false, error: 'Set CATALOG_PASSWORD (or ADMIN_PASSWORD) in Netlify to open this page.' });
  const route = String(event.path || '').replace(/^.*\/api\/catalog\/?/, '').replace(/^.*\/\.netlify\/functions\/catalog\/?/, '');

  if (route === 'login' && event.httpMethod === 'POST') {
    let given = '';
    try { given = String(JSON.parse(event.body || '{}').password || ''); } catch (e) {}
    if (!crypto.timingSafeEqual(sha(given), sha(password()))) {
      await new Promise((r) => setTimeout(r, 800));
      return json(401, { ok: false, error: 'Wrong password.' });
    }
    const exp = String(Date.now() + MAX_AGE * 1000);
    const cookie = `${COOKIE}=${encodeURIComponent(exp + '.' + sign(exp))}; Path=/api/catalog; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
    return json(200, { ok: true }, { 'Set-Cookie': cookie });
  }

  if (!hasAccess(event)) return json(401, { ok: false, error: 'Password needed.' });

  if (route === 'inquire' && event.httpMethod === 'POST') {
    let b = {};
    try { b = JSON.parse(event.body || '{}'); } catch (e) {}
    if (b.website) return json(200, { ok: true }); // honeypot: pretend it worked
    const clean = (v, n) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
    const name = clean(b.name, 100), artist = clean(b.artist, 100), email = clean(b.email, 200), phone = clean(b.phone, 40);
    const message = String(b.message || '').trim().slice(0, 2000);
    const known = new Set(INDEX.songs.map((s) => s.title));
    const songs = (Array.isArray(b.songs) ? b.songs : []).map((s) => clean(s, 120)).filter((s) => known.has(s)).slice(0, 40);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { ok: false, error: 'Please add your name and a valid email.' });
    if (!songs.length) return json(400, { ok: false, error: 'Pick at least one song.' });
    try {
      await require('./utils/mail').sendSongInquiry({ name, artist, email, phone, songs, message });
    } catch (e) {
      console.error('song inquiry failed:', e.message);
      return json(502, { ok: false, error: 'Could not send right now. Please email Info@JuniperStudioLLC.com.' });
    }
    return json(200, { ok: true });
  }

  if (route === 'list') {
    return json(200, { ok: true, songs: INDEX.songs.map((s) => ({ title: s.title, versions: s.versions.map((v) => ({ id: v.id, label: v.label, fadeIn: 0.3, fadeOut: 2 })) })) });
  }

  if (route.startsWith('audio/')) {
    const v = findFile(decodeURIComponent(route.slice(6)));
    if (!v) return { statusCode: 404, body: 'Not found' };
    if (!process.env.CATALOG_PREVIEW_DIR) connectLambda(event);
    const buf = await readClip(v);
    if (!buf) return { statusCode: 404, body: 'Not found' };
    const type = TYPES[v.ext] || 'application/octet-stream';
    const size = buf.length;
    const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' };
    const rm = /bytes=(\d*)-(\d*)/.exec((event.headers || {}).range || '');
    if (!rm && size <= CHUNK) return { statusCode: 200, headers: Object.assign({ 'Content-Length': String(size) }, base), body: buf.toString('base64'), isBase64Encoded: true };
    let start = rm && rm[1] !== '' ? parseInt(rm[1], 10) : 0;
    let end = rm && rm[2] !== '' ? parseInt(rm[2], 10) : size - 1;
    if (rm && rm[1] === '' && rm[2] !== '') { start = Math.max(0, size - parseInt(rm[2], 10)); end = size - 1; }
    end = Math.min(end, size - 1, start + CHUNK - 1);
    if (start > end || start >= size) return { statusCode: 416, headers: { 'Content-Range': `bytes */${size}` }, body: '' };
    return { statusCode: 206, headers: Object.assign({ 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) }, base), body: buf.subarray(start, end + 1).toString('base64'), isBase64Encoded: true };
  }

  return { statusCode: 404, body: 'Not found' };
};
