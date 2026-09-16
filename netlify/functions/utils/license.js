const crypto = require('crypto');
const { getPlugin, getPluginByPrefix } = require('./plugins');

function signingSecret() {
  return process.env.LICENSE_SIGNING_SECRET || process.env.STRIPE_SECRET_KEY;
}

function generateLicense({ pluginId, email, amount, sessionId }) {
  const plugin = getPlugin(pluginId);
  if (!plugin) throw new Error('Unknown plugin');
  const payload = Buffer.from(JSON.stringify({
    p: plugin.code,
    e: (email || '').toLowerCase(),
    a: amount || 0,
    s: sessionId || '',
    t: Math.floor(Date.now() / 1000),
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', signingSecret()).update(payload).digest('hex').slice(0, 16);
  return `${plugin.prefix}.${payload}.${sig}`;
}

function verifyLicense(key, expectedPluginId) {
  if (!key || typeof key !== 'string') return { ok: false, reason: 'missing' };
  const parts = key.trim().split('.');
  if (parts.length !== 3) return { ok: false, reason: 'format' };
  const [prefix, payload, sig] = parts;
  const plugin = getPluginByPrefix(prefix);
  if (!plugin) return { ok: false, reason: 'unknown_plugin' };
  if (expectedPluginId && plugin.id !== expectedPluginId) return { ok: false, reason: 'wrong_plugin' };
  const expected = crypto.createHmac('sha256', signingSecret()).update(payload).digest('hex').slice(0, 16);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature' };
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.p !== plugin.code) return { ok: false, reason: 'product' };
    return { ok: true, plugin: plugin.id, name: plugin.name, email: data.e, amount: data.a, issued: data.t };
  } catch (err) {
    return { ok: false, reason: 'payload' };
  }
}

module.exports = { generateLicense, verifyLicense };
