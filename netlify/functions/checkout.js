const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: 'price_1TjTiqRreoLOc5si9ucP4vv5', quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://juniperstudiollc.com/contact?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://juniperstudiollc.com/services.html',
    });

    return {
      statusCode: 302,
      headers: { Location: session.url },
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};