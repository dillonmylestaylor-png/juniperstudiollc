const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');
const { PLUGINS } = require('../netlify/functions/utils/plugins');

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

async function findByPluginId(id) {
  const lists = await Promise.all([
    stripe.products.list({ limit: 100, active: true }),
    stripe.products.list({ limit: 100, active: false }),
  ]);
  return [...lists[0].data, ...lists[1].data].find((p) => p.metadata && p.metadata.plugin === id);
}

(async () => {
  for (const plugin of Object.values(PLUGINS)) {
    let product = plugin.stripeProductId
      ? await stripe.products.retrieve(plugin.stripeProductId).catch(() => null)
      : null;
    if (!product) product = await findByPluginId(plugin.id);

    if (!product) {
      product = await stripe.products.create({
        name: plugin.name,
        description: plugin.description + ' Not for public sale yet.',
        active: false,
        metadata: { plugin: plugin.id, status: 'hidden' },
      });
      console.log('Created', plugin.name, product.id);
    } else {
      product = await stripe.products.update(product.id, {
        name: plugin.name,
        description: plugin.description + ' Not for public sale yet.',
        active: false,
        metadata: { plugin: plugin.id, status: 'hidden' },
      });
      console.log('Updated', plugin.name, product.id);
    }

    const prices = await stripe.prices.list({ product: product.id, limit: 10, active: true });
    const pwyw = prices.data.find((p) => p.custom_unit_amount);
    if (!pwyw) {
      const price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        custom_unit_amount: { enabled: true, minimum: 50, preset: 1000 },
        nickname: plugin.name + ' donation PWYW',
      });
      await stripe.products.update(product.id, { default_price: price.id, active: false });
      console.log('  price', price.id, 'min $0.50 preset $10');
    } else {
      console.log('  price', pwyw.id);
    }
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
