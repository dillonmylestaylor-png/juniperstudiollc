// /api/admin -- private numbers for Dillon (the /admin page).
// Auth: "Authorization: Bearer <ADMIN_PASSWORD>" (Netlify environment variable). Without the variable set
// the endpoint is closed.
//   GET  downloads (per plugin/OS: today, 7 days, 30 days, all time; last 14 days; countries),
//        license sales from Stripe, reviews (pending + approved), and review-promo codes
//   POST {action: "approve" | "delete", id}
//   POST {action: "review-codes", note} -> a new pair of one-time review-promo codes (utils/reviewPromo.js)
const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');
const { FILES, statsDay } = require('./utils/downloads');
const { REVIEWABLE, ID_RE, store, listState } = require('./utils/reviews');
const { PLUGINS } = require('./utils/plugins');
const { createReviewCodes, listReviewCodes } = require('./utils/reviewPromo');

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

function authorized(event) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null; // closed until the password is set
  const given = String((event.headers || {}).authorization || '').replace(/^Bearer\s+/i, '');
  return crypto.timingSafeEqual(sha(given), sha(pw));
}

function lastDays(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(statsDay(new Date(Date.now() - i * 86400000)));
  return out; // newest first
}

async function downloadStats() {
  const { blobs } = await getStore('plugin-downloads').list();
  const d7 = new Set(lastDays(7)), d30 = new Set(lastDays(30)), days14 = lastDays(14), today = days14[0];
  const plugins = {};
  for (const [file, info] of Object.entries(FILES)) {
    const p = plugins[info.plugin] || (plugins[info.plugin] = { name: PLUGINS[info.plugin].name, os: {}, daily: Object.fromEntries(days14.map((d) => [d, 0])), countries: {} });
    p.os[info.os] = { file, today: 0, d7: 0, d30: 0, all: 0 };
  }
  for (const { key } of blobs) {
    const [day, file, country] = key.split('/');
    const info = FILES[file];
    if (!info) continue;
    const p = plugins[info.plugin], o = p.os[info.os];
    o.all++;
    if (d30.has(day)) o.d30++;
    if (d7.has(day)) o.d7++;
    if (day === today) o.today++;
    if (day in p.daily) p.daily[day]++;
    p.countries[country] = (p.countries[country] || 0) + 1;
  }
  for (const p of Object.values(plugins)) {
    p.countries = Object.entries(p.countries).sort((a, b) => b[1] - a[1]).slice(0, 10);
    p.daily = days14.map((d) => [d, p.daily[d]]);
  }
  return { today, plugins };
}

async function salesStats() {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const since7 = Math.floor(Date.now() / 1000) - 7 * 86400;
  const out = {};
  for await (const s of stripe.checkout.sessions.list({ status: 'complete', limit: 100 })) {
    const id = s.metadata && s.metadata.plugin;
    if (!id || !PLUGINS[id]) continue;
    const o = out[id] || (out[id] = { name: PLUGINS[id].name, count: 0, d7: 0, gross: 0 });
    o.count++;
    if (s.created >= since7) o.d7++;
    o.gross += (s.amount_total || 0) / 100;
  }
  return out;
}

exports.handler = async (event) => {
  const ok = authorized(event);
  if (ok === null) return json(503, { ok: false, error: 'Set ADMIN_PASSWORD in Netlify to open the admin page.' });
  if (!ok) { await new Promise((r) => setTimeout(r, 800)); return json(401, { ok: false, error: 'Wrong password.' }); }
  connectLambda(event);

  if (event.httpMethod === 'POST') {
    let b = {};
    try { b = JSON.parse(event.body || '{}'); } catch (e) {}
    if (b.action === 'review-codes') {
      try {
        const codes = await createReviewCodes(require('stripe')(process.env.STRIPE_SECRET_KEY), b.note);
        return json(200, { ok: true, codes });
      } catch (err) {
        return json(500, { ok: false, error: err.message });
      }
    }
    if (!ID_RE.test(String(b.id || ''))) return json(400, { ok: false, error: 'Bad review id.' });
    const s = store();
    if (b.action === 'approve') {
      const r = await s.get(`pending/${b.id}`, { type: 'json' });
      if (!r) return json(404, { ok: false, error: 'Already handled.' });
      await s.setJSON(`approved/${b.id}`, { ...r, approved: Date.now() });
      await s.delete(`pending/${b.id}`);
      return json(200, { ok: true });
    }
    if (b.action === 'delete') {
      await s.delete(`pending/${b.id}`);
      await s.delete(`approved/${b.id}`);
      return json(200, { ok: true });
    }
    return json(400, { ok: false, error: 'Unknown action.' });
  }

  const [downloads, sales, pending, approved, promoCodes] = await Promise.all([
    downloadStats().catch((e) => ({ error: e.message })),
    salesStats().catch((e) => ({ error: e.message })),
    listState('pending'),
    listState('approved'),
    listReviewCodes(require('stripe')(process.env.STRIPE_SECRET_KEY)).catch((e) => ({ error: e.message })),
  ]);
  const label = (r) => ({ ...r, pluginName: REVIEWABLE[r.plugin] || r.plugin });
  return json(200, { ok: true, downloads, sales, reviews: { pending: pending.map(label), approved: approved.map(label) }, promoCodes });
};
