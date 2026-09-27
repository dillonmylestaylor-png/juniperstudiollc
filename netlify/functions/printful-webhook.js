// Printful -> site webhook: when a shirt ships, email the customer their tracking link from Info@.
// Printful's v1 webhooks are unsigned, so the payload is only used to learn WHICH order shipped: the order
// itself is re-read from the Printful API with our token, and only orders created by our Stripe checkout
// (external_id = a Stripe Checkout session id) are emailed. Each shipment is emailed once (Netlify Blobs).
const { connectLambda, getStore } = require('@netlify/blobs');
const { sendShippingEmail } = require('./utils/mail');

const API = 'https://api.printful.com';
const STORE_ID = process.env.PRINTFUL_STORE_ID || '18816469';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  connectLambda(event);
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }
  if (body.type !== 'package_shipped') return { statusCode: 200, body: 'ignored' };

  const orderId = body.data && body.data.order && body.data.order.id;
  const shipmentId = body.data && body.data.shipment && body.data.shipment.id;
  if (!orderId) return { statusCode: 400, body: 'No order id' };

  const res = await fetch(API + '/orders/' + encodeURIComponent(orderId), {
    headers: { Authorization: 'Bearer ' + process.env.PRINTFUL_API_TOKEN, 'X-PF-Store-Id': STORE_ID },
  });
  if (!res.ok) return { statusCode: 404, body: 'Unknown order' };
  const order = (await res.json()).result || {};
  if (!/^cs_(live|test)_/.test(String(order.external_id || ''))) return { statusCode: 200, body: 'not a site order' };

  const shipments = order.shipments || [];
  const shipment = shipments.find((s) => String(s.id) === String(shipmentId)) || shipments[shipments.length - 1];
  const to = order.recipient && order.recipient.email;
  if (!shipment || !to) return { statusCode: 200, body: 'nothing to send' };

  const store = getStore('shipping-emails');
  const key = String(order.id) + '-' + String(shipment.id);
  if (await store.get(key)) return { statusCode: 200, body: 'already sent' };

  const item = (order.items || [])[0] || {};
  await sendShippingEmail({
    to,
    name: order.recipient.name,
    itemName: item.name ? item.name.replace(/\s+(XS|S|M|L|XL|2XL|3XL)$/, '') : '',
    trackingUrl: shipment.tracking_url,
    carrier: shipment.carrier,
    trackingNumber: shipment.tracking_number,
  });
  await store.setJSON(key, { sent: Date.now() });
  return { statusCode: 200, body: 'sent' };
};
