// /download/<file> -> counts the download, then 302s to the real file in /downloads/.
// One count per person per file per day: the blob key ends in a salted hash of IP + user agent, so a
// double-click or a retry just rewrites the same key. No raw IPs are stored. Bots and HEAD requests
// (link previews) are sent to the file but not counted.
const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');
const { FILES, statsDay } = require('./utils/downloads');

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl|wget|python|httpclient|headless|monitor|scanner/i;

function clientIp(h) {
  return h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || '';
}

function country(h) {
  if (h['x-country']) return String(h['x-country']).toUpperCase().slice(0, 2);
  try {
    const geo = JSON.parse(Buffer.from(h['x-nf-geo'] || '', 'base64').toString('utf8'));
    if (geo && geo.country && geo.country.code) return String(geo.country.code).toUpperCase().slice(0, 2);
  } catch (e) {}
  return 'XX';
}

exports.handler = async (event) => {
  const file = decodeURIComponent(String(event.path || '').split('/').pop() || '');
  if (!FILES[file]) return { statusCode: 404, body: 'Not found' };
  const h = event.headers || {};
  const ua = h['user-agent'] || '';
  if (event.httpMethod === 'GET' && ua && !BOT.test(ua)) {
    try {
      connectLambda(event);
      const salt = process.env.LICENSE_SIGNING_SECRET || process.env.STRIPE_SECRET_KEY || '';
      const who = crypto.createHash('sha256').update(salt + '|' + clientIp(h) + '|' + ua).digest('hex').slice(0, 20);
      await getStore('plugin-downloads').setJSON(`${statsDay()}/${file}/${country(h)}/${who}`, { t: Date.now() });
    } catch (err) {
      console.error('download count failed:', err.message); // never block the download over a count
    }
  }
  return { statusCode: 302, headers: { Location: '/downloads/' + file, 'Cache-Control': 'no-store' }, body: '' };
};
