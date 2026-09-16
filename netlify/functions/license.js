const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { verifyLicense } = require('./utils/license');
const { getPlugin } = require('./utils/plugins');

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

  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return { statusCode: 402, headers, body: JSON.stringify({ ok: false, reason: 'unpaid' }) };
      }
      const license = session.metadata && session.metadata.license_key;
      if (!license) {
        return { statusCode: 202, headers, body: JSON.stringify({ ok: false, reason: 'pending' }) };
      }
      const check = verifyLicense(license, pluginId);
      return { statusCode: 200, headers, body: JSON.stringify(Object.assign({ license }, check)) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, reason: err.message }) };
    }
  }

  if (key) {
    return { statusCode: 200, headers, body: JSON.stringify(verifyLicense(key, pluginId)) };
  }

  if (pluginId && !getPlugin(pluginId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, reason: 'unknown_plugin' }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ ok: false, reason: 'missing key or session_id' }) };
};
