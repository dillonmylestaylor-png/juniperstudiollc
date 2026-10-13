// POST { plugin: 'namwich', keys: ['JS2.xxx.yyy', ...] }
// Verifies pasted license keys and works out how many of our EFFECT pedals the buyer owns (IR Deconvolver and
// master/admin keys don't count; each pedal counts once however many keys are pasted). Returns the minimum
// price that earns, plus a short-lived signed token the checkout link carries. Nothing is stored.
const { PLUGINS } = require('./utils/plugins');
const { verifyLicense } = require('./utils/license');
const { signOwnerToken } = require('./utils/ownerToken');

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const MAX_KEYS = 12;
const MAX_KEY_LENGTH = 1000;

const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false });
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}

  const info = PLUGINS[String(body.plugin || '')];
  if (!info || !info.ownerPrices) return reply(400, { ok: false, reason: 'no_owner_price' });

  const keys = (Array.isArray(body.keys) ? body.keys : String(body.keys || '').split(/\s+/))
    .map((k) => String(k || '').trim())
    .filter(Boolean)
    .slice(0, MAX_KEYS);
  if (!keys.length) return reply(200, { ok: true, count: 0, owned: [], rejected: [], token: null });

  const owned = new Map();
  const rejected = [];
  keys.forEach((key, i) => {
    if (key.length > MAX_KEY_LENGTH) { rejected.push({ index: i, reason: 'invalid' }); return; }
    const v = verifyLicense(key);
    if (!v.ok) { rejected.push({ index: i, reason: 'invalid' }); return; }
    if (v.master) { rejected.push({ index: i, reason: 'invalid' }); return; }
    const p = PLUGINS[v.plugin];
    if (!p || !p.effect) { rejected.push({ index: i, reason: 'not_an_effect', name: v.name }); return; }
    owned.set(p.id, p.name);
  });

  const tiers = Object.keys(info.ownerPrices).length;
  const count = Math.min(owned.size, tiers);
  const token = count > 0 ? signOwnerToken(info.id, count) : null;
  return reply(200, { ok: true, count, owned: [...owned.values()], rejected, token });
};
