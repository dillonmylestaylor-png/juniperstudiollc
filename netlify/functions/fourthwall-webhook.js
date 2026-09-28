// /fourthwall-webhook -- Fourthwall calls this for each paid shop order (ORDER_PLACED). We verify the
// X-Fourthwall-Hmac-SHA256 signature with FOURTHWALL_WEBHOOK_SECRET (the key shown under Settings ->
// For developers in the Fourthwall dashboard) and send Dillon a sale notice. Nothing else is stored.
const crypto = require('crypto');
const { connectLambda } = require('@netlify/blobs');
const { notifySale, money } = require('./utils/notify');

function rawBody(event) {
  return event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '', 'utf8');
}

function validSignature(body, header, secret) {
  if (!header || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64');
  const a = Buffer.from(String(header)), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const body = rawBody(event);
  const h = event.headers || {};
  if (!validSignature(body, h['x-fourthwall-hmac-sha256'], process.env.FOURTHWALL_WEBHOOK_SECRET)) {
    return { statusCode: 401, body: 'Bad signature' };
  }
  let evt;
  try { evt = JSON.parse(body.toString('utf8')); } catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }
  if (evt.type !== 'ORDER_PLACED') return { statusCode: 200, body: 'ignored' };

  connectLambda(event);
  const o = evt.data || {};
  const a = o.amounts || {};
  const cur = (a.total && a.total.currency) || 'USD';
  let profit = 0;
  const items = (o.offers || []).map((offer) => {
    const v = offer.variant || {};
    const qty = v.quantity || 1;
    const attrs = v.attributes || {};
    const detail = [attrs.size && attrs.size.name, attrs.color && attrs.color.name].filter(Boolean).join(', ');
    const unitPrice = (v.unitPrice && v.unitPrice.value) || 0;
    const unitCost = (v.unitCost && v.unitCost.value) || 0;
    profit += (unitPrice - unitCost) * qty;
    return `${qty} x ${offer.name || 'Item'}${detail ? ` (${detail})` : ''}`;
  });
  const buyer = [(o.shipping && o.shipping.address && o.shipping.address.name) || o.username, o.email && `(${o.email})`].filter(Boolean).join(' ') || 'Someone';
  const total = money(a.total && a.total.value, cur);
  const shipTo = o.shipping && o.shipping.address ? [o.shipping.address.city, o.shipping.address.state, o.shipping.address.country].filter(Boolean).join(', ') : '';

  await notifySale({
    key: 'fourthwall/' + (evt.id || o.id || o.friendlyId),
    title: `${evt.testMode ? 'TEST ' : ''}Shirt order: ${total}`,
    lines: [
      `${buyer} ordered:`,
      ...items.map((i) => '  ' + i),
      `Total ${total}${a.shipping && a.shipping.value ? ` (incl. ${money(a.shipping.value, cur)} shipping)` : ''}.`,
      profit > 0 ? `You make about ${money(profit, cur)} after shirt costs (before Fourthwall's card fee).` : '',
      shipTo ? `Shipping to ${shipTo}.` : '',
      o.message ? `Note from them: ${o.message}` : '',
      o.friendlyId ? `Order ${o.friendlyId}` : '',
    ],
    link: 'https://admin.fourthwall.com/store/juniper-studio-llc/orders',
  });
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
