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

async function sendLicenseEmail({ to, pluginName, license }) {
  const transport = transporter();
  await transport.sendMail({
    from: `Juniper Studio LLC <${FROM}>`,
    to,
    replyTo: FROM,
    subject: `You're in — here's your ${pluginName} key`,
    text:
      `Hey,\n\n` +
      `Thanks for grabbing ${pluginName}. Means a lot.\n\n` +
      `Here's your license key — paste it in the plugin and you're good:\n\n` +
      `${license}\n\n` +
      `It works on up to 10 machines, so studio / laptop / a spare is covered. ` +
      `To move it, open the plugin's Settings and hit Deactivate on this computer first.\n\n` +
      `If anything's weird, just reply to this email. I actually read it.\n\n` +
      `— Dillon\n` +
      `Juniper Studio LLC\n` +
      `${FROM}\n`,
  });
}

async function addToMailingList(email) {
  if (!email) return;
  await fetch('https://juniperstudiollc.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'form-name': 'email-list', email, source: 'plugin-purchase' }).toString(),
  });
}

module.exports = { sendLicenseEmail, addToMailingList, FROM };
