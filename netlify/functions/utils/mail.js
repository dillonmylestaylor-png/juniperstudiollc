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

// Tells Dillon a new plugin review is waiting on /admin. Goes to our own inbox only.
async function sendReviewNotice({ pluginName, rating, name, text, verified }) {
  const transport = transporter();
  await transport.sendMail({
    from: `Juniper Studio LLC <${FROM}>`,
    to: FROM,
    subject: `New ${pluginName} review (${rating}★) waiting for approval`,
    text:
      `${name}${verified ? ' (verified owner)' : ''} gave ${pluginName} ${rating} out of 5:\n\n` +
      `${text}\n\n` +
      `Approve or delete it at https://juniperstudiollc.com/admin\n`,
  });
}

// "You made a sale" email to our own inbox (see utils/notify.js).
async function sendSaleNotice({ subject, text }) {
  const transport = transporter();
  await transport.sendMail({ from: `Juniper Studio LLC <${FROM}>`, to: FROM, subject, text });
}

// A Song Catalog inquiry ("Inquire for pricing") -> our own inbox; Reply goes straight to the artist.
async function sendSongInquiry({ name, artist, email, phone, songs, message }) {
  const transport = transporter();
  await transport.sendMail({
    from: `Juniper Studio LLC <${FROM}>`,
    to: FROM,
    replyTo: `${name} <${email}>`,
    subject: `Song catalog inquiry: ${songs.slice(0, 3).join(', ')}${songs.length > 3 ? ` +${songs.length - 3} more` : ''}`,
    text:
      `New pricing inquiry from the Song Catalog.\n\n` +
      `Name: ${name}\n` +
      `Artist / band: ${artist || '-'}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone || '-'}\n\n` +
      `Songs:\n${songs.map((s) => '  - ' + s).join('\n')}\n\n` +
      `Message:\n${message || '-'}\n`,
  });
}

module.exports = { sendSongInquiry, sendLicenseEmail, sendReviewNotice, sendSaleNotice, addToMailingList, FROM };
