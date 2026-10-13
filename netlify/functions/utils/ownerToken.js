// Short-lived, signed proof of "this buyer owns N of our effect pedals", so the owner price can't be
// claimed by editing a URL. Issued by owner-price.js after it verifies the pasted license keys; checked by
// checkout.js. Signed with the same secret as license keys, but under its own namespace.
const crypto = require('crypto');

const TTL_SECONDS = 60 * 60;

function secret() {
  return process.env.LICENSE_SIGNING_SECRET || process.env.STRIPE_SECRET_KEY;
}

function sign(body) {
  return crypto.createHmac('sha256', secret()).update('owner-v1|' + body).digest('hex').slice(0, 24);
}

function signOwnerToken(pluginId, count) {
  const body = Buffer.from(JSON.stringify({ p: pluginId, n: count, x: Math.floor(Date.now() / 1000) + TTL_SECONDS })).toString('base64url');
  return body + '.' + sign(body);
}

function verifyOwnerToken(token, pluginId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return { ok: false, reason: 'format' };
  const [body, sig] = parts;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature' };
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (data.p !== pluginId) return { ok: false, reason: 'plugin' };
    if (!(data.x > Math.floor(Date.now() / 1000))) return { ok: false, reason: 'expired' };
    return { ok: true, count: Math.max(0, parseInt(data.n, 10) || 0) };
  } catch (err) {
    return { ok: false, reason: 'payload' };
  }
}

module.exports = { signOwnerToken, verifyOwnerToken, TTL_SECONDS };
