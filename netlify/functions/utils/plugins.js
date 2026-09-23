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
