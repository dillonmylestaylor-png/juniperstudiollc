const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const sessionId = event.queryStringParameters?.session_id;
    if (!sessionId) return { statusCode: 400, body: 'Missing session_id' };

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const subscriptionId = session.subscription;
    if (!subscriptionId) return { statusCode: 400, body: 'No subscription found' };

    const cancelAt = Math.floor(Date.now() / 1000) + 16 * 7 * 24 * 60 * 60;
    await stripe.subscriptions.update(subscriptionId, { cancel_at: cancelAt });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, cancel_at: cancelAt }),
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};