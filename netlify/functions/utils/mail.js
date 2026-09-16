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
    subject: `Your ${pluginName} license`,
    text:
      `Thanks for supporting Juniper Studio LLC.\n\n` +
      `Plugin: ${pluginName}\n` +
      `License key:\n${license}\n\n` +
      `Paste this key in the plugin. It works on up to 10 machines.\n\n` +
      `Questions: ${FROM}\n`,
  });
}

async function addToMailingList(email) {
  if (!email) return;
  await fetch('https://juniperstudiollc.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'form-name': 'email-list', email }).toString(),
  });
}

module.exports = { sendLicenseEmail, addToMailingList, FROM };
