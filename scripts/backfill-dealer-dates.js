#!/usr/bin/env node
// Bayi ilanlarinin eksik createdTime alanlarini Git'teki ilk gorunume gore doldurur.
// Git'te henuz bulunmayan kayitlarda mevcut "Ilan Eklendi" audit zamani kullanilir.
// SOLD kayitlarinin "Ilan Satildi" audit zamani da SOLD dosyasina ilk girdigi
// commit zamanina cekilir.

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadDealerSites } from './lib/dealer-sites.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const listingsRoot = path.join(repoRoot, 'src/data/listings');

const gitFirstDate = (needle, paths) => {
  try {
    const output = execFileSync('git', [
      'log', '--all', '--reverse', '--format=%aI', '-S', needle, '--', ...paths,
    ], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const first = output.split('\n').find(Boolean);
    return first ? new Date(first).toISOString() : null;
  } catch {
    return null;
  }
};

let createdUpdated = 0;
let soldUpdated = 0;

for (const { site } of loadDealerSites()) {
  const siteDir = path.join(listingsRoot, site);
  if (!fs.existsSync(siteDir)) continue;

  for (const category of fs.readdirSync(siteDir)) {
    const categoryDir = path.join(siteDir, category);
    if (!fs.statSync(categoryDir).isDirectory()) continue;

    for (const filename of fs.readdirSync(categoryDir).filter(f => f.endsWith('.json'))) {
      const file = path.join(categoryDir, filename);
      const car = JSON.parse(fs.readFileSync(file, 'utf8'));
      const needle = `"listingId": "${car.listingId}"`;
      const addedAudit = car.auditHistory?.find(h => h.action === 'İlan Eklendi');
      const firstSeen = gitFirstDate(needle, ['src/data']) || addedAudit?.auditDate;

      if (!car.listingDates?.createdTime && firstSeen) {
        car.listingDates = car.listingDates || {};
        car.listingDates.createdTime = firstSeen;
        createdUpdated++;
      }

      if (category.includes('SOLD')) {
        const soldAudit = car.auditHistory?.find(h => h.action?.startsWith('İlan Satıldı'));
        const legacySoldFile = `src/data/listings/${site}/${category}.json`;
        const currentSoldFile = path.relative(repoRoot, file);
        const soldAt = gitFirstDate(needle, [legacySoldFile, currentSoldFile]);
        if (soldAudit && soldAt && soldAudit.auditDate !== soldAt) {
          soldAudit.auditDate = soldAt;
          soldUpdated++;
        }
      }

      fs.writeFileSync(file, JSON.stringify(car, null, 2) + '\n');
    }
  }
}

console.log(`Bayi tarih backfill: ${createdUpdated} createdTime, ${soldUpdated} satilma tarihi guncellendi.`);
