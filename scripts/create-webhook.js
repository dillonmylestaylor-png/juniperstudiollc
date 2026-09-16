const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const url = 'https://juniperstudiollc.com/.netlify/functions/stripe-webhook';

(async () => {
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const found = existing.data.find((w) => w.url === url);
  if (found) {
    console.log('Webhook already exists:', found.id);
    console.log('URL:', found.url);
    console.log('Secret is only shown when the endpoint is first created. If Netlify is missing STRIPE_WEBHOOK_SECRET, delete this endpoint in Stripe and rerun.');
    return;
  }
  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: ['checkout.session.completed'],
    description: 'Juniper Studio plugin licensing',
  });
  console.log('Created webhook:', endpoint.id);
  console.log('URL:', endpoint.url);
  console.log('Add this to Netlify env (and .env):');
  console.log('STRIPE_WEBHOOK_SECRET=' + endpoint.secret);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
