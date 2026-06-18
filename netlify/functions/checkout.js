const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const priceId = params.price;
    const customAmount = params.amount ? parseInt(params.amount, 10) : null;

    let price;
    let unitAmount;
    let isSubscription;

    if (priceId) {
      price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
      unitAmount = price.unit_amount;
      isSubscription = price.recurring !== null;
    } else if (customAmount) {
      unitAmount = customAmount;
      isSubscription = false;
    } else {
      return { statusCode: 400, body: 'Missing price or amount parameter' };
    }

    const feeAmount = Math.round(unitAmount * 0.029 + 30);

    const lineItems = [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Recording Session' },
              unit_amount: customAmount,
            },
            quantity: 1,
          },
    ];

    if (feeAmount > 0) {
      const feeItem = priceId && isSubscription
        ? {
            price_data: {
              currency: 'usd',
              product: 'prod_UivoufgNp1yyGp',
              unit_amount: feeAmount,
              recurring: { interval: price.recurring.interval, interval_count: price.recurring.interval_count },
            },
            quantity: 1,
          }
        : {
            price_data: {
              currency: 'usd',
              product: 'prod_UivoufgNp1yyGp',
              unit_amount: feeAmount,
            },
            quantity: 1,
          };
      lineItems.push(feeItem);
    }

    const mode = isSubscription ? 'subscription' : 'payment';

    const productName = price?.product?.name || 'Service';
    const baseAmount = unitAmount / 100;
    const feeDisplay = (feeAmount / 100).toFixed(2);

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode,
      success_url: 'https://juniperstudiollc.com/contact?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://juniperstudiollc.com/services.html',
      custom_text: {
        submit: {
          message: isSubscription
            ? 'Subscription automatically cancels after 16 weeks. Applicable taxes calculated based on your location.'
            : 'Applicable taxes will be calculated based on your location.',
        },
      },
    });

    return {
      statusCode: 302,
      headers: { Location: session.url },
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};