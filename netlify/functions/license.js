const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { verifyLicense } = require('./utils/license');
const { getPlugin } = require('./utils/plugins');
const { activate } = require('./utils/activations');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  const params = event.queryStringParameters || {};
  const body = event.body ? (() => { try { return JSON.parse(event.body); } catch (e) { return {}; } })() : {};
  const key = params.key || body.key;
  const sessionId = params.session_id || body.session_id;
  const pluginId = params.plugin || body.plugin;
  const machine = params.machine || body.machine;

  if (sessionId) {
    return { statusCode: 404, headers, body: JSON.stringify({ ok: false, reason: 'use_email' }) };
  }

  if (key) {
    const check = verifyLicense(key, pluginId);
    if (!check.ok) return { statusCode: 200, headers, body: JSON.stringify(check) };
    const act = await activate({ key, machine, master: check.master });
    if (!act.ok) return { statusCode: 200, headers, body: JSON.stringify(act) };
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        plugin: check.plugin,
        name: check.name,
        master: check.master,
        remaining: act.remaining,
      }),
    };
  }

  if (pluginId && !getPlugin(pluginId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, reason: 'unknown_plugin' }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ ok: false, reason: 'missing key' }) };
};
