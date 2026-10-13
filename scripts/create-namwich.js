// Creates (or finds) the NAMwich product in Stripe with pay-what-you-want prices, one per owner tier:
// every tier is $15 suggested / $1,000 maximum; the MINIMUM drops $1 for each Juniper effect pedal the buyer
// owns ($5 -> $4 -> $3 -> $2 -> $1). Stripe refuses coupons on pay-what-you-want prices, so a lower minimum
// on its own price is how owners get a discount. Idempotent: re-running reuses the product and prices.
// Usage: node scripts/create-namwich.js   (reads STRIPE_SECRET_KEY from .env, never prints it)
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

const PLUGIN_ID = 'namwich';
const NAME = 'NAMwich';
const DESCRIPTION = 'NAMwich NAM player plugin from Juniper Studio LLC. Pay what you want ($5 minimum, $15 suggested; owners of our effect pedals get $1 off the minimum for each). Includes a license key for up to 10 machines.';
const BASE_MIN_CENTS = 500;
const PRESET_CENTS = 1500;
const MAX_TIERS = 4; // 0 effects owned = $5 minimum ... 4+ owned = $1 minimum

(async () => {
  const [a, b] = await Promise.all([
    stripe.products.list({ limit: 100, active: true }),
    stripe.products.list({ limit: 100, active: false }),
  ]);
  let product = [...a.data, ...b.data].find((p) => p.metadata && p.metadata.plugin === PLUGIN_ID);
  if (product) {
    product = await stripe.products.update(product.id, { name: NAME, description: DESCRIPTION, active: true, metadata: { plugin: PLUGIN_ID } });
    console.error('Updated existing product', product.id);
  } else {
    product = await stripe.products.create({ name: NAME, description: DESCRIPTION, active: true, metadata: { plugin: PLUGIN_ID } });
    console.error('Created product', product.id);
  }

  const existing = await stripe.prices.list({ product: product.id, limit: 100, active: true });
  const out = {};
  for (let owned = 0; owned <= MAX_TIERS; owned++) {
    const minimum = BASE_MIN_CENTS - owned * 100;
    let price = existing.data.find((p) => p.custom_unit_amount && p.custom_unit_amount.minimum === minimum && p.custom_unit_amount.preset === PRESET_CENTS);
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        custom_unit_amount: { enabled: true, minimum, maximum: 100000, preset: PRESET_CENTS },
        nickname: `${NAME} PWYW, $${minimum / 100} minimum (${owned} effect${owned === 1 ? '' : 's'} owned)`,
        metadata: { owned_effects: String(owned) },
      });
      console.error(`Created price ${price.id}: $${minimum / 100} min, $15 suggested, $1,000 max`);
    } else {
      console.error(`Reusing price ${price.id}: $${minimum / 100} min`);
    }
    out[owned] = price.id;
  }
  await stripe.products.update(product.id, { default_price: out[0], active: true });
  console.log(JSON.stringify({ productId: product.id, pricesByEffectsOwned: out }, null, 2));
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
