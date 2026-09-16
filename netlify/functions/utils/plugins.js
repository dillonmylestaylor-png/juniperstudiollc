const PLUGINS = {
  chorus505: {
    id: 'chorus505',
    name: 'Chorus505',
    prefix: 'CH505',
    code: 'c505',
    stripeProductId: 'prod_VGguUq0fUI2knK',
    description: 'Analog-style chorus. Donation-based.',
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
