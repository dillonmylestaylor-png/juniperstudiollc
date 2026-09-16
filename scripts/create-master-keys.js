const fs = require('fs');
const path = require('path');
const { PLUGINS } = require('../netlify/functions/utils/plugins');
const { generateLicense } = require('../netlify/functions/utils/license');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const out = [];
for (const plugin of Object.values(PLUGINS)) {
  out.push('## ' + plugin.name);
  for (let n = 1; n <= 5; n++) {
    const key = generateLicense({
      pluginId: plugin.id,
      email: 'info@juniperstudiollc.com',
      amount: 0,
      sessionId: 'master-' + plugin.id + '-' + n,
      master: true,
      n,
    });
    out.push(n + '. ' + key);
  }
  out.push('');
}

const dest = path.join(__dirname, '..', 'master-keys.txt');
fs.writeFileSync(dest, out.join('\n'));
console.log('Wrote 5 master keys per plugin to master-keys.txt (gitignored). Keep that file private.');
