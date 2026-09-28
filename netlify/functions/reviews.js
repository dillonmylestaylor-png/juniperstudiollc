// /api/reviews
//   GET  ?plugin=js2   approved reviews for the plugin's page, with the average rating
//   POST {plugin, rating, name, text, email?, website}   a new review; it waits on /admin until approved
// The email is optional and never shown: it is only used to look for a purchase of that plugin in
// Stripe ("Verified owner" badge) and so Dillon can reply. "website" is a honeypot field.
const crypto = require('crypto');
const { connectLambda } = require('@netlify/blobs');
const { REVIEWABLE, store, listState, publicView } = require('./utils/reviews');
const { statsDay } = require('./utils/downloads');

const json = (statusCode, body, extra) => ({ statusCode, headers: { 'Content-Type': 'application/json', ...(extra || {}) }, body: JSON.stringify(body) });
const MAX_PER_DAY = 5;

async function ownsPlugin(email, plugin) {
  if (!email || !process.env.STRIPE_SECRET_KEY) return false;
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  for (const addr of [...new Set([email, email.toLowerCase()])]) {
    const list = await stripe.checkout.sessions.list({ customer_details: { email: addr }, status: 'complete', limit: 100 });
    if (list.data.some((s) => s.metadata && s.metadata.plugin === plugin)) return true;
  }
  return false;
}

exports.handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod === 'GET') {
    const plugin = (event.queryStringParameters || {}).plugin;
    if (!REVIEWABLE[plugin]) return json(404, { ok: false });
    const reviews = (await listState('approved', plugin)).map(publicView);
    const average = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : null;
    return json(200, { ok: true, count: reviews.length, average, reviews }, { 'Cache-Control': 'public, max-age=60' });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false });
  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (e) {}
  if (b.website) return json(200, { ok: true }); // bot filled the hidden field: pretend it worked

  const plugin = String(b.plugin || '');
  const rating = parseInt(b.rating, 10);
  const name = String(b.name || '').trim().replace(/\s+/g, ' ');
  const text = String(b.text || '').trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  const email = String(b.email || '').trim();
  if (!REVIEWABLE[plugin]) return json(400, { ok: false, error: 'Unknown plugin.' });
  if (!(rating >= 1 && rating <= 5)) return json(400, { ok: false, error: 'Pick a star rating.' });
  if (name.length < 1 || name.length > 40) return json(400, { ok: false, error: 'Add your name (up to 40 characters).' });
  if (text.length < 10 || text.length > 1000) return json(400, { ok: false, error: 'Write between 10 and 1,000 characters.' });
  if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json(400, { ok: false, error: 'That email doesn\'t look right (or leave it blank).' });

  const s = store();
  const h = event.headers || {};
  const ip = h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim();
  const salt = process.env.LICENSE_SIGNING_SECRET || process.env.STRIPE_SECRET_KEY || '';
  const who = crypto.createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 20);
  const limitKey = `ratelimit/${statsDay()}/${who}`;
  const used = (await s.get(limitKey, { type: 'json' })) || { n: 0 };
  if (used.n >= MAX_PER_DAY) return json(429, { ok: false, error: 'Thanks! That\'s plenty of reviews for today.' });
  await s.setJSON(limitKey, { n: used.n + 1 });

  let verified = false;
  try { verified = await ownsPlugin(email, plugin); } catch (err) { console.error('owner check failed:', err.message); }

  const created = Date.now();
  const id = `${plugin}/${created}-${crypto.randomBytes(4).toString('hex').slice(0, 6)}`;
  await s.setJSON(`pending/${id}`, { plugin, rating, name, text, email, verified, created });

  try {
    const { sendReviewNotice } = require('./utils/mail');
    await sendReviewNotice({ pluginName: REVIEWABLE[plugin], rating, name, text, verified });
  } catch (err) { console.error('review notice failed:', err.message); }

  return json(200, { ok: true });
};
