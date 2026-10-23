const PLUGINS = {
  chorus505: {
    id: 'chorus505',
    name: 'JS-505',
    prefix: 'CH505',
    code: 'c505',
    stripeProductId: 'prod_VGguUq0fUI2knK',
    description: 'Analog-style chorus. Donation-based.',
    page: 'js505', // customer-facing page, used for checkout's cancel link
    noun: 'plugin', // what the customer is told to paste the key into
    live: true,
    effect: true, // counts toward the NAMwich owner discount
  },
  js2: {
    id: 'js2',
    name: 'JS-2',
    prefix: 'JS2',          // must match the plugin's LicenseClient ("js2", "JS2")
    code: 'js02',
    stripeProductId: 'prod_VKmMk9MEsoVAeN',
    description: 'Analog-style tremolo. Donation-based.',
    page: 'js2',
    noun: 'plugin',
    live: true,
    effect: true,
  },
  irdeconvolver: {
    id: 'irdeconvolver',
    name: 'IR Deconvolver',
    prefix: 'IRDEC',
    code: 'irdc',
    stripeProductId: 'prod_VIrCm6HTbDTrWg',
    description: 'Sine-sweep impulse response deconvolution app for Mac. Donation-based, $10 minimum.',
    page: 'irdeconvolver',
    noun: 'app',
    live: true,
  },
  namwich: {
    id: 'namwich',
    name: 'NAMwich',
    prefix: 'NAMW',   // the plugin's LicenseClient must use the same prefix and code
    code: 'namw',
    stripeProductId: 'prod_VR49ZQo0mlbgsu',
    // Pay-what-you-want can't take coupons, so owners of our effect pedals get a lower MINIMUM instead:
    // the key is the number of effects owned (1-4+), the value a price on the same product with that minimum.
    ownerPrices: {
      1: 'price_1UQC1QRreoLOc5siKJHs6kiV', // $4 minimum
      2: 'price_1UQC1QRreoLOc5sixSIJp59R', // $3
      3: 'price_1UQC1QRreoLOc5siu3M2KdQ8', // $2
      4: 'price_1UQC1QRreoLOc5si70X8gatD', // $1
    },
    description: 'NAM player with built-in effects. Donation-based, $5 minimum.',
    page: 'namwich',
    noun: 'plugin',
    live: false, // flip to true on launch day, after the installers are uploaded
  },
  js900: {
    id: 'js900',
    name: 'JS-900',
    prefix: 'JS900',   // matches LicenseClient { "js900", "JS900" } in the JS-900 plugin
    code: 'j900',
    stripeProductId: null, // create the Stripe product (like scripts/create-js2.js) at launch
    description: 'Analog-style phaser. Donation-based.',
    page: 'js900',
    noun: 'plugin',
    live: false, // flip to true on launch day
    effect: true,
  },
  js550a: {
    id: 'js550a',
    name: 'JS-550A',
    prefix: 'JS550A',  // matches LicenseClient { "js550a", "JS550A" } in the JS-550A plugin
    code: 'j55a',
    stripeProductId: 'prod_VUX84LVgmvSD2u', // scripts/create-js550a.js: $10 min, $20 suggested, $1,000 max
    description: '3-band program EQ. Donation-based, $10 minimum.',
    page: 'js550a',
    noun: 'plugin',
    live: true,
    effect: true,
  },
  jsdelay: {
    id: 'jsdelay',
    name: 'JS Delay',
    prefix: 'JSDLY',   // JS Delay has no LicenseClient yet; give it { "jsdelay", "JSDLY" } when licensing is ported
    code: 'jdly',
    stripeProductId: null, // create at launch
    description: 'Character delay. Donation-based.',
    page: 'jsdelay',
    noun: 'plugin',
    live: false,
    effect: true,
  },
  aurum8200: {
    id: 'aurum8200',
    name: 'Aurum 8200',
    prefix: 'AURUM',
    code: 'a820',
    stripeProductId: 'prod_VGh1bvpCczCMP4',
    description: 'Aurum 8200. Donation-based.',
  },
  ferrum550a: {
    id: 'ferrum550a',
    name: 'Ferrum 550A',
    prefix: 'FERRM',
    code: 'f550',
    stripeProductId: 'prod_VGh1ZfnYNSzYTI',
    description: 'Ferrum 550A. Donation-based.',
  },
  placeq: {
    id: 'placeq',
    name: 'PlacEQ',
    prefix: 'PLEQ',
    code: 'pleq',
    stripeProductId: 'prod_VGh1qPaIGH344i',
    description: 'PlacEQ. Donation-based.',
  },
};

function getPlugin(id) {
  return PLUGINS[id] || null;
}

function getPluginByPrefix(prefix) {
  return Object.values(PLUGINS).find((p) => p.prefix === prefix) || null;
}

function getPluginByCode(code) {
  return Object.values(PLUGINS).find((p) => p.code === code) || null;
}

module.exports = { PLUGINS, getPlugin, getPluginByPrefix, getPluginByCode };
