// Plugin reviews in Netlify Blobs (store "plugin-reviews").
//   pending/<plugin>/<id>   waiting for approval on /admin (never shown publicly)
//   approved/<plugin>/<id>  shown on the plugin's page
//   ratelimit/<day>/<who>   submissions per person per day
// A review's id is "<plugin>/<timestamp>-<random>", so the key is "<state>/<id>".
const { getStore } = require('@netlify/blobs');

const REVIEWABLE = { chorus505: 'JS-505', js2: 'JS-2' };
const ID_RE = /^(chorus505|js2)\/\d{13}-[a-z0-9]{6}$/;

function store() { return getStore('plugin-reviews'); }

async function listState(state, plugin) {
  const s = store();
  const prefix = plugin ? `${state}/${plugin}/` : `${state}/`;
  const { blobs } = await s.list({ prefix });
  const out = [];
  for (const b of blobs) {
    const r = await s.get(b.key, { type: 'json' });
    if (r) out.push({ ...r, id: b.key.slice(state.length + 1) });
  }
  return out.sort((a, b) => b.created - a.created);
}

// What the public page may see: no email, no internal fields.
function publicView(r) {
  return { name: r.name, rating: r.rating, text: r.text, created: r.created, verified: !!r.verified };
}

module.exports = { REVIEWABLE, ID_RE, store, listState, publicView };
