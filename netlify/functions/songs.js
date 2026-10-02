// /api/songs/* -- password-protected song previews (the /songs page).
//   POST /api/songs/login  {password}  -> sets a 30-day HttpOnly cookie
//   GET  /api/songs/list               -> the song index (needs the cookie)
//   GET  /api/songs/audio/<id>         -> one preview clip, with Range support so the player can seek (needs the cookie)
// Password: SONGS_PASSWORD (falls back to ADMIN_PASSWORD until a separate one is set). Without either, the
// endpoints are closed. The clips live in the private Netlify Blobs store "song-previews" (key "audio/<id>"),
// never as public files. For local testing set SONG_PREVIEW_DIR to a folder of the original clip files.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { connectLambda, getStore } = require('@netlify/blobs');
const INDEX = require('./data/songs.json');

const COOKIE = 'songs_access';
const MAX_AGE = 30 * 86400;
const CHUNK = 3500000; // keep each response well under the 6 MB function limit; players just ask for the next range
const TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4' };

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const json = (statusCode, body, headers) => ({ statusCode, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {}), body: JSON.stringify(body) });
const password = () => process.env.SONGS_PASSWORD || process.env.ADMIN_PASSWORD || '';
const secret = () => process.env.LICENSE_SIGNING_SECRET || password();
const sign = (exp) => crypto.createHmac('sha256', secret()).update('songs|' + exp).digest('hex');

function hasAccess(event) {
  const m = /(?:^|;\s*)songs_access=([^;]+)/.exec((event.headers || {}).cookie || '');
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
  const dir = process.env.SONG_PREVIEW_DIR;
  if (dir) {
    const p = path.join(dir, v.file);
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  }
  const data = await getStore('song-previews').get('audio/' + v.id, { type: 'arrayBuffer' });
  return data ? Buffer.from(data) : null;
}

exports.handler = async (event) => {
  if (!password()) return json(503, { ok: false, error: 'Set SONGS_PASSWORD (or ADMIN_PASSWORD) in Netlify to open this page.' });
  const route = String(event.path || '').replace(/^.*\/api\/songs\/?/, '').replace(/^.*\/\.netlify\/functions\/songs\/?/, '');

  if (route === 'login' && event.httpMethod === 'POST') {
    let given = '';
    try { given = String(JSON.parse(event.body || '{}').password || ''); } catch (e) {}
    if (!crypto.timingSafeEqual(sha(given), sha(password()))) {
      await new Promise((r) => setTimeout(r, 800));
      return json(401, { ok: false, error: 'Wrong password.' });
    }
    const exp = String(Date.now() + MAX_AGE * 1000);
    const cookie = `${COOKIE}=${encodeURIComponent(exp + '.' + sign(exp))}; Path=/api/songs; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
    return json(200, { ok: true }, { 'Set-Cookie': cookie });
  }

  if (!hasAccess(event)) return json(401, { ok: false, error: 'Password needed.' });

  if (route === 'list') {
    return json(200, { ok: true, songs: INDEX.songs.map((s) => ({ title: s.title, versions: s.versions.map((v) => ({ id: v.id, label: v.label, fadeIn: 0.3, fadeOut: 2 })) })) });
  }

  if (route.startsWith('audio/')) {
    const v = findFile(decodeURIComponent(route.slice(6)));
    if (!v) return { statusCode: 404, body: 'Not found' };
    if (!process.env.SONG_PREVIEW_DIR) connectLambda(event);
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
