// Builds netlify/functions/data/catalog.json (the private song index) from the preview clips Dillon marked.
// Usage: node scripts/build-catalog-index.js [clip-dir]   (default: the SSD "Song Previews/previews_orig" folder)
const fs = require('fs');
const path = require('path');
const BASE = '/Volumes/Mac/Claude SSD/Song Previews';
const dir = process.argv[2] || path.join(BASE, 'previews_orig');
const marks = JSON.parse(fs.readFileSync(path.join(BASE, 'previews_orig.json'), 'utf8'));
const slug = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const songs = {};
for (const m of marks) {
  const file = m.file;
  const ext = file.split('.').pop().toLowerCase();
  const label = m.label; // "Colorado Run - V2", "Catches Fire (Troy)", "Lift Me Up (Matt)", "Lift Me Up"
  let title = label, ver = '';
  let x;
  if ((x = /^(.*) - (V\d)$/.exec(label))) { title = x[1]; ver = x[2]; }
  else if ((x = /^(.*) \(([^)]+)\)$/.exec(label))) { title = x[1]; ver = x[2]; }
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) throw new Error('missing clip ' + p);
  (songs[title] = songs[title] || []).push({ id: slug(label), label: ver, file, ext, bytes: fs.statSync(p).size });
}
const out = Object.keys(songs).sort((a, b) => a.localeCompare(b)).map((title) => {
  const versions = songs[title].sort((a, b) => a.label.localeCompare(b.label));
  if (versions.length > 1) versions.forEach((v) => { if (!v.label) v.label = 'Original'; });
  else versions[0].label = '';
  return { title, versions };
});
fs.writeFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'data', 'catalog.json'), JSON.stringify({ songs: out }, null, 1));
console.log(out.length + ' songs, ' + out.reduce((n, s) => n + s.versions.length, 0) + ' clips');
