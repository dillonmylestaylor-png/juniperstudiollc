// Installer files that /download/<file> counts. Keys are the names in /downloads/.
const FILES = {
  'JS-505-Mac.pkg': { plugin: 'chorus505', os: 'Mac' },
  'JS-505-Windows.exe': { plugin: 'chorus505', os: 'Windows' },
  'JS-2-Mac.pkg': { plugin: 'js2', os: 'Mac' },
  'JS-2-Windows.exe': { plugin: 'js2', os: 'Windows' },
  'IR-Deconvolver-Mac.dmg': { plugin: 'irdeconvolver', os: 'Mac' },
  'IR-Deconvolver-Windows.exe': { plugin: 'irdeconvolver', os: 'Windows' },
};

// Days are counted in the studio's own time zone, so "today" on the admin page matches Arkansas.
function statsDay(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(date || new Date());
}

module.exports = { FILES, statsDay };
