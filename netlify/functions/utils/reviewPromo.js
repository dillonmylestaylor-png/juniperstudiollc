// Review promo: someone reviews a plugin + posts about it on two socials -> 30% off one studio service.
// Each person gets a pair of one-time Stripe promotion codes (typed on the Stripe payment page, which already
// allows codes for services):
//   THANKS30-XXXXX       -> coupon REVIEW30: 30% off Mixing, Hip-Hop Mixing, Mastering, Mix & Master Bundle,
//                           Suno to Real Song, Re-amping (restricted to those products, so the card-fee line
//                           and album packages stay full price)
//   THANKS30-XXXXX-PROD  -> coupon REVIEW30PROD: 65% off Production only, i.e. the 50% production sale plus 30%
//                           ($750 -> $262.50). Stripe Checkout takes one code per purchase, so the stacked price
//                           needs its own coupon.
// Both coupons were created once in the Stripe dashboard's live account (see their names there).
const SERVICE_COUPON = 'REVIEW30';
const PRODUCTION_COUPON = 'REVIEW30PROD';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

function randomSuffix(n = 5) {
  const bytes = require('crypto').randomBytes(n);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

async function createReviewCodes(stripe, note) {
  const who = String(note || '').trim().slice(0, 100);
  for (let attempt = 0; attempt < 5; attempt++) {
    const base = 'THANKS30-' + randomSuffix();
    try {
      const metadata = { promo: 'review30', pair: base, note: who };
      const service = await stripe.promotionCodes.create({ coupon: SERVICE_COUPON, code: base, max_redemptions: 1, metadata });
      const production = await stripe.promotionCodes.create({ coupon: PRODUCTION_COUPON, code: base + '-PROD', max_redemptions: 1, metadata });
      return { service: service.code, production: production.code, note: who };
    } catch (err) {
      // A taken code is the only expected failure; anything else is real.
      if (!/already exists|already in use/i.test(String(err && err.message))) throw err;
    }
  }
  throw new Error('Could not find an unused code, try again.');
}

async function listReviewCodes(stripe) {
  const pairs = {};
  for (const coupon of [SERVICE_COUPON, PRODUCTION_COUPON]) {
    for await (const pc of stripe.promotionCodes.list({ coupon, limit: 100 })) {
      if (!pc.active && !pc.times_redeemed) continue; // switched off in Stripe without being used
      const key = (pc.metadata && pc.metadata.pair) || pc.code.replace(/-PROD$/, '');
      const p = pairs[key] || (pairs[key] = { code: key, note: (pc.metadata && pc.metadata.note) || '', created: pc.created * 1000, used: '' });
      if (pc.times_redeemed > 0) p.used = coupon === PRODUCTION_COUPON ? 'Production' : 'Service';
    }
  }
  return Object.values(pairs).sort((a, b) => b.created - a.created);
}

module.exports = { createReviewCodes, listReviewCodes };
