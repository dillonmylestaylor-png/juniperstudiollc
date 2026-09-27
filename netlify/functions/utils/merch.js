// Print-on-demand shirts (Printful, Bella+Canvas 3001 unisex tee, catalog product 71).
// Print files are served from the site (/merch/print/<id>.png, 3600x4800 = Printful's 12x16 in front area);
// Printful downloads them when an order is created. Variant ids come from Printful's catalog (color + size).
const VARIANTS = {
  Black:        { XS: 9527, S: 4016, M: 4017, L: 4018, XL: 4019, '2XL': 4020, '3XL': 5295 },
  'Soft Cream': { XS: 9554, S: 4151, M: 4152, L: 4153, XL: 4154, '2XL': 4155, '3XL': 5305 },
};
const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const PRICE_CENTS = { XS: 2400, S: 2400, M: 2400, L: 2400, XL: 2400, '2XL': 2600, '3XL': 2800 };
const SHIPPING_CENTS = 495; // Printful's US flat rate for one shirt

const MERCH = {
  'your-drummer-sucks': { id: 'your-drummer-sucks', name: 'Your Drummer Sucks Tee', color: 'Black' },
  'your-intonation-sucks': { id: 'your-intonation-sucks', name: 'Your Intonation Sucks Tee', color: 'Black' },
  'talkback':           { id: 'talkback',           name: 'Talkback Tee',           color: 'Black' },
  'js505-pedal':        { id: 'js505-pedal',        name: 'JS-505 Pedal Tee',       color: 'Black' },
  'js2-pedal':          { id: 'js2-pedal',          name: 'JS-2 Pedal Tee',         color: 'Soft Cream' },
};

function getMerch(id) { return MERCH[id] || null; }
function variantId(item, size) { return (VARIANTS[item.color] || {})[size] || null; }
function printFileUrl(item) { return 'https://juniperstudiollc.com/merch/print/' + item.id + '.png'; }

module.exports = { MERCH, SIZES, PRICE_CENTS, SHIPPING_CENTS, getMerch, variantId, printFileUrl };
