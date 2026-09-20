const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const SITE = 'https://juniperstudiollc.com/';

function normalise(email) {
  return String(email || '').trim().toLowerCase();
}

function emailKey(email) {
  return crypto.createHash('sha256').update(normalise(email)).digest('hex');
}

/**
 * Adds an address to the Netlify `email-list` form exactly once. Remembers who has been added, so a person
 * who signs up from the download popup and later buys the plugin produces ONE notification, not two.
 * The first source wins. If the memory store fails we still submit (a duplicate beats a lost signup).
 * The caller's function must have called connectLambda(event) first.
 */
async function addToListOnce(email, source) {
  const address = normalise(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 200) return { ok: false, reason: 'invalid_email' };

  let store = null;
  try {
    store = getStore('mailing-list');
    if (await store.get(emailKey(address))) return { ok: true, added: false };
  } catch (err) {
    console.error('mailing-list store read failed', err && err.message);
    store = null;
  }

  const res = await fetch(SITE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'form-name': 'email-list', email: address, source: source || '' }).toString(),
  });
  if (!res.ok) return { ok: false, reason: 'form_failed' };

  if (store) {
    try { await store.setJSON(emailKey(address), { source: source || '', added: Date.now() }); }
    catch (err) { console.error('mailing-list store write failed', err && err.message); }
  }
  return { ok: true, added: true };
}

module.exports = { addToListOnce };
