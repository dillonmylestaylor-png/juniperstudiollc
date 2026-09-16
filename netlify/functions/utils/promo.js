const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const COUPON = 'PRODUCTION50';

function emailKey(email) {
  return crypto.createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');
}

async function store() {
  return getStore('promo-redemptions');
}

async function hasUsedProduction50(email) {
  if (!email) return false;
  const s = await store();
  const row = await s.get(emailKey(email), { type: 'json' });
  return !!(row && row.coupon === COUPON);
}

async function markUsedProduction50(email, sessionId) {
  if (!email) return;
  const s = await store();
  await s.setJSON(emailKey(email), {
    coupon: COUPON,
    email: String(email).trim().toLowerCase(),
    sessionId: sessionId || '',
    used: Date.now(),
  });
}

async function findCustomerId(stripe, email) {
  const list = await stripe.customers.list({ email, limit: 1 });
  return list.data[0] ? list.data[0].id : null;
}

module.exports = { COUPON, hasUsedProduction50, markUsedProduction50, findCustomerId };
