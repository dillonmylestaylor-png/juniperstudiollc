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

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Missing STRIPE_SECRET_KEY. Put it in .env (not in chat) then run: node scripts/create-chorus505.js');
  process.exit(1);
}

const stripe = Stripe(key);

(async () => {
  const products = await stripe.products.list({ limit: 100, active: false });
  const active = await stripe.products.list({ limit: 100, active: true });
  const existing = [...products.data, ...active.data].find((p) => p.metadata && p.metadata.plugin === 'chorus505');

  if (existing) {
    const updated = await stripe.products.update(existing.id, {
      name: 'Chorus505',
      description: 'Donation-based chorus plugin from Juniper Studio LLC. Pay what you want. Not for public sale yet.',
      active: false,
      metadata: { plugin: 'chorus505', status: 'hidden' },
    });
    console.log('Updated existing product (inactive):', updated.id);
    return;
  }

  const product = await stripe.products.create({
    name: 'Chorus505',
    description: 'Donation-based chorus plugin from Juniper Studio LLC. Pay what you want. Not for public sale yet.',
    active: false,
    metadata: { plugin: 'chorus505', status: 'hidden' },
  });
  console.log('Created Chorus505 in Stripe (inactive / not live):', product.id);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
