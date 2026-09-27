// Minimal Printful API client (API store "Juniper Studio LLC"). Token lives in PRINTFUL_API_TOKEN.
const API = 'https://api.printful.com';
const STORE_ID = process.env.PRINTFUL_STORE_ID || '18816469'; // the "Juniper Studio LLC" API store (token is account-level)

async function createOrder({ externalId, recipient, items }) {
  // Orders stay drafts (confirm in the Printful dashboard) unless PRINTFUL_AUTO_CONFIRM=1, in which case
  // Printful charges the account's billing method and starts fulfilment right away.
  const confirm = process.env.PRINTFUL_AUTO_CONFIRM === '1';
  const res = await fetch(API + '/orders' + (confirm ? '?confirm=true' : ''), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.PRINTFUL_API_TOKEN, 'X-PF-Store-Id': STORE_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify({ external_id: externalId, shipping: 'STANDARD', recipient, items }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A retried Stripe webhook: the order for this session already exists, which is success.
    const msg = (json.error && json.error.message) || json.result || '';
    if (/external.?id/i.test(String(msg)) && /exist|already|unique/i.test(String(msg))) return { duplicate: true };
    throw new Error('Printful ' + res.status + ': ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
  }
  return json.result;
}

module.exports = { createOrder };
