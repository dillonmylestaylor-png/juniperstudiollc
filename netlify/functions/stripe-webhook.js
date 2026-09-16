const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { generateLicense } = require('./utils/license');
const { getPlugin } = require('./utils/plugins');
const { sendLicenseEmail, addToMailingList } = require('./utils/mail');

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
  try {
    const { markUsedProduction50 } = require('./utils/promo');
    const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['discounts', 'discounts.coupon', 'discounts.promotion_code'] });
    const email = full.customer_details && full.customer_details.email;
    const usedCode = (full.discounts || []).some((d) => {
      const coupon = d.coupon || {};
      const promo = d.promotion_code || {};
      return coupon.id === 'PRODUCTION50' || promo.code === 'PRODUCTION50';
    });
    if (email && usedCode) await markUsedProduction50(email, full.id);
  } catch (err) {}

  const pluginId = session.metadata && session.metadata.plugin;
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    return { statusCode: 200, body: JSON.stringify({ received: true, skipped: true }) };
  }

  const full = await stripe.checkout.sessions.retrieve(session.id);
  const email = full.customer_details && full.customer_details.email;
  let license = full.metadata && full.metadata.license_key;

  if (!license) {
    license = generateLicense({
      pluginId: plugin.id,
      email,
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
  }

  if (email) {
    try {
      await sendLicenseEmail({ to: email, pluginName: plugin.name, license });
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: 'email_failed', detail: err.message }) };
    }
    try {
      await addToMailingList(email);
    } catch (err) {}
  }

  return { statusCode: 200, body: JSON.stringify({ received: true, licensed: true, emailed: !!email, plugin: plugin.id }) };
};
