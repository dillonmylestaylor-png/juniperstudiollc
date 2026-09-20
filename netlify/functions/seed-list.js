// TEMPORARY one-off: marks existing list members as already added (no form submission, no notification email).
// Guarded by a random token (only its SHA-256 is stored here). Deleted right after use.
const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  connectLambda(event);
  const tok = (event.headers && (event.headers['x-seed-token'] || event.headers['X-Seed-Token'])) || '';
  if (crypto.createHash('sha256').update(tok).digest('hex') !== 'f99f5445dfc5470bf662e1c6df106890df004cbd32cecd374cfe4c7234eb2e0c') return { statusCode: 403, body: 'no' };
  const body = JSON.parse(event.body || '{}');
  const store = getStore('mailing-list');
  let n = 0;
  for (const raw of body.emails || []) {
    const e = String(raw).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) continue;
    await store.setJSON(crypto.createHash('sha256').update(e).digest('hex'), { source: 'imported', added: Date.now() });
    n++;
  }
  return { statusCode: 200, body: JSON.stringify({ seeded: n }) };
};
