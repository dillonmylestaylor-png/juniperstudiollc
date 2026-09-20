const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { verifyLicense } = require('./utils/license');
const { getPlugin } = require('./utils/plugins');
const { connectLambda } = require('@netlify/blobs');
const { activate, deactivate } = require('./utils/activations');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  // Classic (Lambda-style) functions must hand Netlify Blobs their request context before any store is
  // opened, or every activation with a machine id throws MissingBlobsEnvironmentError.
  connectLambda(event);
  const params = event.queryStringParameters || {};
  const body = event.body ? (() => { try { return JSON.parse(event.body); } catch (e) { return {}; } })() : {};
  const key = params.key || body.key;
  const sessionId = params.session_id || body.session_id;
  const pluginId = params.plugin || body.plugin;
  const machine = params.machine || body.machine;
  const action = String(params.action || body.action || 'activate').toLowerCase();

  if (sessionId) {
    return { statusCode: 404, headers, body: JSON.stringify({ ok: false, reason: 'use_email' }) };
  }

  if (key) {
    const check = verifyLicense(key, pluginId);
    if (!check.ok) return { statusCode: 200, headers, body: JSON.stringify(check) };
    // A valid, correctly signed key must never be rejected because activation bookkeeping failed: if the
    // storage layer errors, log it and let the customer in (the 10-machine cap is a soft limit).
    let act;
    try {
      act = action === 'deactivate'
        ? await deactivate({ key, machine, master: check.master })
        : await activate({ key, machine, master: check.master });
    } catch (err) {
      console.error('activation store error', err && err.message);
      act = action === 'deactivate' ? { ok: true, remaining: null, deactivated: false } : { ok: true, remaining: null };
    }
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
        deactivated: !!act.deactivated,
      }),
    };
  }

  if (pluginId && !getPlugin(pluginId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, reason: 'unknown_plugin' }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ ok: false, reason: 'missing key' }) };
};
