const { connectLambda } = require('@netlify/blobs');
const { addToListOnce } = require('./utils/mailing');

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const ALLOWED_SOURCES = ['download', 'discount-popup'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ ok: false }) };
  connectLambda(event);
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  const source = ALLOWED_SOURCES.includes(body.source) ? body.source : 'website';
  const result = await addToListOnce(body.email, source);
  return { statusCode: result.ok ? 200 : 400, headers, body: JSON.stringify({ ok: result.ok }) };
};
