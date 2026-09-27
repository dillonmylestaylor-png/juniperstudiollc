// Creates (or finds) the JS-2 product in Stripe with a pay-what-you-want price:
// $1 minimum, $10 suggested, $1,000 maximum (same as JS-505). Idempotent: re-running reuses the product and price.
// Usage: node scripts/create-js2.js   (reads STRIPE_SECRET_KEY from .env, never prints it)
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY. Put it in .env (not in chat).');
  process.exit(1);
}
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PLUGIN_ID = 'js2';
const NAME = 'JS-2';
const DESCRIPTION = 'Analog-style tremolo plugin from Juniper Studio LLC. Pay what you want ($1 minimum, $10 suggested). Includes a license key for up to 10 machines.';

(async () => {
  const [a, b] = await Promise.all([
    stripe.products.list({ limit: 100, active: true }),
    stripe.products.list({ limit: 100, active: false }),
  ]);
  let product = [...a.data, ...b.data].find((p) => p.metadata && p.metadata.plugin === PLUGIN_ID);
  if (product) {
    product = await stripe.products.update(product.id, { name: NAME, description: DESCRIPTION, active: true, metadata: { plugin: PLUGIN_ID } });
    console.log('Updated existing product', product.id);
  } else {
    product = await stripe.products.create({ name: NAME, description: DESCRIPTION, active: true, metadata: { plugin: PLUGIN_ID } });
    console.log('Created product', product.id);
  }

  const prices = await stripe.prices.list({ product: product.id, limit: 20, active: true });
  let price = prices.data.find((p) => p.custom_unit_amount && p.custom_unit_amount.minimum === 100);
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      custom_unit_amount: { enabled: true, minimum: 100, maximum: 100000, preset: 1000 },
      nickname: NAME + ' donation PWYW',
    });
    console.log('Created price', price.id, '($1 min, $10 suggested, $1,000 max, same as JS-505)');
  } else {
    console.log('Reusing price', price.id);
  }
  await stripe.products.update(product.id, { default_price: price.id, active: true });
  console.log('default_price set. PRODUCT_ID=' + product.id);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
