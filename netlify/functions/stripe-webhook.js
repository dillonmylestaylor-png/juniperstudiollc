const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { generateLicense } = require('./utils/license');
const { getPlugin } = require('./utils/plugins');
const { sendLicenseEmail, addToMailingList } = require('./utils/mail');

function rawBody(event) {
  if (event.isBase64Encoded) return Buffer.from(event.body || '', 'base64').toString('utf8');
  return event.body || '';
}

exports.handler = async (event) => {
  // Classic (Lambda-style) function: give Netlify Blobs its request context before any store is opened.
  require('@netlify/blobs').connectLambda(event);
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

  // Shirt orders: send the paid order to Printful (print-on-demand). external_id = the Stripe session, so a
  // retried webhook can never create a second order.
  if (session.metadata && session.metadata.merch) {
    const { getMerch, variantId, printFileUrl } = require('./utils/merch');
    const { createOrder } = require('./utils/printful');
    const item = getMerch(session.metadata.merch);
    const size = session.metadata.size;
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id);
      const ship = (full.collected_information && full.collected_information.shipping_details) || full.shipping_details || {};
      const addr = ship.address || {};
      const recipient = {
        name: ship.name || (full.customer_details && full.customer_details.name) || '',
        address1: addr.line1 || '', address2: addr.line2 || '', city: addr.city || '',
        state_code: addr.state || '', country_code: addr.country || 'US', zip: addr.postal_code || '',
        email: (full.customer_details && full.customer_details.email) || '',
      };
      const result = await createOrder({
        externalId: session.id,
        recipient,
        items: [{ variant_id: variantId(item, size), quantity: 1, name: item.name + ' ' + size, files: [{ type: 'front', url: printFileUrl(item) }] }],
      });
      return { statusCode: 200, body: JSON.stringify({ received: true, merch: item.id, printful: result && (result.id || result.duplicate) }) };
    } catch (err) {
      // 500 makes Stripe retry the webhook later (e.g. if Printful was briefly unreachable).
      return { statusCode: 500, body: JSON.stringify({ error: 'printful_failed', detail: err.message }) };
    }
  }

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
      await sendLicenseEmail({ to: email, pluginName: plugin.name, license, noun: plugin.noun || 'plugin' });
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: 'email_failed', detail: err.message }) };
    }
    try {
      await addToMailingList(email);
    } catch (err) {}
  }

  return { statusCode: 200, body: JSON.stringify({ received: true, licensed: true, emailed: !!email, plugin: plugin.id }) };
};
