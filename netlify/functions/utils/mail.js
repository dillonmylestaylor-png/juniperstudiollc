const nodemailer = require('nodemailer');

const FROM = process.env.GMAIL_USER || 'Info@JuniperStudioLLC.com';

function transporter() {
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) throw new Error('Missing GMAIL_APP_PASSWORD');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: FROM, pass },
  });
}

async function sendLicenseEmail({ to, pluginName, license, noun = 'plugin' }) {
  const transport = transporter();
  await transport.sendMail({
    from: `Juniper Studio LLC <${FROM}>`,
    to,
    replyTo: FROM,
    subject: `You're in — here's your ${pluginName} key`,
    text:
      `Hey,\n\n` +
      `Thanks for grabbing ${pluginName}. Means a lot.\n\n` +
      `Here's your license key — paste it in the ${noun} and you're good:\n\n` +
      `${license}\n\n` +
      `It works on up to 10 machines, so studio / laptop / a spare is covered. ` +
      `To move it, open the ${noun}'s Settings and hit Deactivate on this computer first.\n\n` +
      `If anything's weird, just reply to this email. I actually read it.\n\n` +
      `— Dillon\n` +
      `Juniper Studio LLC\n` +
      `${FROM}\n`,
  });
}

async function addToMailingList(email) {
  // Once per address across the whole site (see utils/mailing.js); the webhook has already called connectLambda.
  const { addToListOnce } = require('./mailing');
  return addToListOnce(email, 'plugin-purchase');
}

async function sendShippingEmail({ to, name, itemName, trackingUrl, carrier, trackingNumber }) {
  const transport = transporter();
  const first = String(name || '').trim().split(/\s+/)[0];
  await transport.sendMail({
    from: `Juniper Studio LLC <${FROM}>`,
    to,
    replyTo: FROM,
    subject: `Shipped: ${itemName || 'your Juniper Studio shirt'}`,
    text:
      `Hey${first ? ' ' + first : ''},\n\n` +
      `Your order just shipped: ${itemName || 'your Juniper Studio shirt'}.\n\n` +
      (trackingUrl ? `Track it here: ${trackingUrl}\n` : '') +
      (carrier || trackingNumber ? `${carrier || 'Carrier'}${trackingNumber ? ' tracking number: ' + trackingNumber : ''}\n` : '') +
      `\nThanks for repping the studio. If anything's off with your order, just reply to this email.\n\n` +
      `— Dillon\n` +
      `Juniper Studio LLC\n` +
      `${FROM}\n`,
  });
}

module.exports = { sendLicenseEmail, sendShippingEmail, addToMailingList, FROM };
