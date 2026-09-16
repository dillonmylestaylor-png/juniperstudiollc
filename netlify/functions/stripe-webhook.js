const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { generateLicense } = require('./utils/license');
const { getPlugin } = require('./utils/plugins');

function rawBody(event) {
  if (event.isBase64Encoded) return Buffer.from(event.body || '', 'base64').toString('utf8');
  return event.body || '';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!process.env.STRIPE_WEBHOOK_SECRET || !sig) {
    return { statusCode: 400, body: 'Missing webhook secret or signature' };
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody(event), sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: `Webhook signature failed: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const session = stripeEvent.data.object;
  const pluginId = session.metadata && session.metadata.plugin;
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    return { statusCode: 200, body: JSON.stringify({ received: true, skipped: true }) };
  }

  if (session.metadata && session.metadata.license_key) {
    return { statusCode: 200, body: JSON.stringify({ received: true, existing: true }) };
  }

  const full = await stripe.checkout.sessions.retrieve(session.id);
  const license = generateLicense({
    pluginId: plugin.id,
    email: full.customer_details && full.customer_details.email,
    amount: full.amount_total,
    sessionId: full.id,
  });

  await stripe.checkout.sessions.update(full.id, {
    metadata: Object.assign({}, full.metadata || {}, { plugin: plugin.id, license_key: license }),
  });

  if (full.customer) {
    const meta = {};
    meta[plugin.id + '_license'] = license;
    meta.plugin = plugin.id;
    await stripe.customers.update(full.customer, { metadata: meta });
  }

  return { statusCode: 200, body: JSON.stringify({ received: true, licensed: true, plugin: plugin.id }) };
};
