#!/usr/bin/env node
// dump-dealer/ arsivindeki ham bayi kayitlarini (her anahtar icin EN YENI dump)
// yeniden import-dealer akisindan gecirir. Kullanim alanlari:
//   - merge/celiski kurallari degistiginde mevcut veriyi yeni kurala hizalamak
//   - equipmentConflicts'in geriye donuk doldurulmasi
// Idempotent — degisiklik yoksa dosyalara dokunulmaz.
//
// Kullanim: npm run resync:dealer  (sonrasinda: npm run format:data)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dumpDealerRoot = path.resolve(__dirname, '../dump-dealer');

if (!fs.existsSync(dumpDealerRoot)) {
  console.log('dump-dealer/ yok — yeniden isleyecek bayi kaydi bulunamadi.');
  process.exit(0);
}

for (const site of fs.readdirSync(dumpDealerRoot)) {
  const dir = path.join(dumpDealerRoot, site);
  if (!fs.statSync(dir).isDirectory()) continue;

  // Anahtar basina en yeni dump (dosya adi: <key>_<ts>.json)
  const latest = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const m = f.replace(/\.json$/, '').match(/^(.*)_(\d+)$/);
    if (!m) continue;
    const [, key, ts] = m;
    if (!latest.has(key) || Number(ts) > latest.get(key).ts) latest.set(key, { ts: Number(ts), f });
  }
  if (latest.size === 0) continue;

  const records = [...latest.values()].map(({ f }) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  console.log(`\n=== ${site}: ${records.length} ham kayit yeniden isleniyor ===`);
  const out = execFileSync('node', [path.join(__dirname, 'import-dealer.js')], {
    input: JSON.stringify({ site, records }), encoding: 'utf8',
  });
  const report = JSON.parse(out);
  const line = (k) => (report[k]?.length ? `${k}:${report[k].length}` : null);
  console.log(['added', 'updated', 'existing', 'merged', 'possibleTwins', 'invalid'].map(line).filter(Boolean).join('  '));
}
console.log('\nBitti. Simdi calistir: npm run format:data');
