#!/usr/bin/env node
// stdin: { items: [{ id, title, subTitle?, sponsored? }, ...] }
// stdout: { kept: [...], skipped: [...] }
//
// kept[i].status: 'existing' (src/data/listings/*.json icinde mobileDeId esleti var)
//                 veya 'new' (henuz kayitli degil).
// kept[i].existingIn: hangi dosyada bulundu (existing ise).
// kept[i].existingListingId: lokal listingId (varsa).
//
// Sinifllandirma kurali tek kaynakta: scripts/lib/body-style.js
// Ayni kurali parse-car-json.js da kullanir.

import { classifyBodyStyle } from './lib/body-style.js';
// Mevcut-ilan dizini tek kaynak: lib/existing-index.js (alt klasorler dahil,
// mobileDeId + vin + dealerKey anahtarli). Buraya kopyalanmaz.
import { buildExistingIndex, lookupListing } from './lib/existing-index.js';
import { dealerKeyFor } from './lib/dealer-sites.js';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    console.error('Geçersiz JSON girdi:', err.message);
    process.exit(1);
  }
  const items = Array.isArray(payload) ? payload : (payload.items || []);
  const existing = buildExistingIndex();

  const kept = [];
  const skipped = [];
  for (const item of items) {
    if (item.sponsored) {
      skipped.push({ ...item, reason: 'Sponsorlu' });
      continue;
    }
    const bodyStyle = classifyBodyStyle(item);
    if (bodyStyle === 'GRAN_COUPE') {
      skipped.push({ ...item, reason: 'GranCoupe', bodyStyle });
      continue;
    }
    if (bodyStyle === 'CABRIO') {
      skipped.push({ ...item, reason: 'Cabrio', bodyStyle });
      continue;
    }
    // id = mobile.de numerik id; bayi taramasinda item.vin / item.url da gelebilir.
    const dealerKey = payload.site && item.url ? dealerKeyFor(payload.site, item.url) : null;
    const hit = lookupListing(existing, { mobileDeId: item.id, vin: item.vin, dealerKey });
    kept.push({
      ...item,
      bodyStyle,
      status: hit ? 'existing' : 'new',
      existingIn: hit?.file || null,
      existingListingId: hit?.listingId || null
    });
  }
  process.stdout.write(JSON.stringify({ kept, skipped }, null, 2));
});
