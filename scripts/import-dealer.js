#!/usr/bin/env node
// Bayi sitesi crawl'inin toplu import'u.
//
// stdin : { "site": "WELLER", "records": [ <canonical raw record>, ... ] }
//         raw record = Apify sekli (bkz. lib/parse-listing.js bas yorumu)
//         + opsiyonel: vin, dealerListingUrl, mobileDeUrl (mobile.de ikizi linki)
// flags : --dry-run  (rapor uret, diske yazma)
// stdout: { site, added[], updated[], existing[], invalid[] }  (JSON, tek satirlik ozet stderr'e)
//
// Kayit basina akis:
//   1. lookup (mobileDeId -> vin -> dealerKey):
//      - eslesme KOK dosyadaysa (mobile.de kaydi) -> site dosyasina YAZILMAZ,
//        "existing" raporlanir. mobile.de kaydi kanoniktir; ayni arac UI'a iki kez girmez.
//      - eslesme kendi site klasorundeyse -> applyUpdatesAndGetChanges + audit.
//      - eslesme yoksa -> yeni: allocator.next() (site oneki) + parseRawToListing + route.
//   2. Ham kayit dump-dealer/<SITE>/<key>_<ts>.json'a arsivlenir (dump/ KIRLETILMEZ —
//      parse-car-json filtresiz calisinca dump/'taki her seyi mobile.de sanir).
//
// Sonrasinda: npm run format:data (enforce sema + siralama).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { siteConfig, dealerKeyFor, sellerMatches } from './lib/dealer-sites.js';
import { createIdAllocator, listingsDir } from './lib/listing-id.js';
import { readCategory, readCar, writeCar, writeCategory } from './lib/listings-store.js';
import { buildExistingIndex, lookupListing } from './lib/existing-index.js';
import { parseRawToListing, applyUpdatesAndGetChanges } from './lib/parse-listing.js';
import { determineTargetFile, detectDamageReason } from './lib/route-listing.js';
import { detectMarginVat, MARGIN_VAT_NOTE } from './lib/text-signals.js';
import { writeRunLog } from './lib/run-log.js';
import { mergeTwinIntoRoot } from './lib/merge-twin.js';
import { rerouteAfterMerge as rerouteAfterMergeRecord } from './lib/reroute-listing.js';
import { buildRootFingerprints, findTwin as findTwinFp, twinHint } from './lib/twin-fingerprint.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dumpDealerRoot = path.resolve(__dirname, '../dump-dealer');
const isDryRun = process.argv.includes('--dry-run');

// Bayi sayfasinin mobile.de'deki BOSLUKLARI doldurabilecegi alanlar. Fiyat/km/renk
// gibi kanonik alanlar burada YOK — mobile.de dolu oldugu surece kanonik kalir,
// bos oldugunda zaten bu listedeki alanlar gibi davranmaz (satis karari fiyata bagli).
// AHG/BMW.de CO2 ve HU verir, mobile.de cogu ilanda vermez — tipik kazanim budur.
const DEALER_FILLABLE = ['co2EmissionsGramPerKm', 'numberOfPreviousOwners', 'nextInspectionDate', 'interiorColorName', 'exteriorPaintLabel'];
const dealerFillableFields = (parsed) =>
  Object.fromEntries(DEALER_FILLABLE.map(k => [k, parsed[k]]));

const mobileDeIdFrom = (url) => {
  const m = String(url || '').match(/id=(\d+)/) || String(url || '').match(/\/(\d+)\.html/);
  return m ? m[1] : null;
};

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(raw); } catch (err) {
    console.error('Geçersiz JSON girdi:', err.message);
    process.exit(1);
  }
  const { site: siteName, records } = payload;
  if (!siteName || !Array.isArray(records)) {
    console.error('Beklenen girdi: { "site": "...", "records": [...] }');
    process.exit(1);
  }
  const site = siteConfig(siteName);
  const index = buildExistingIndex();
  const allocator = createIdAllocator(site.idPrefix);
  const ts = Date.now();

  const report = { site: siteName, added: [], updated: [], existing: [], invalid: [], possibleTwins: [], rerouted: [] };
  // Merge ile VIN/hasar/donanim gibi yeni bir karar sinyali gelebilir. Yalnizca
  // hasari degil tum hedef kategoriyi yeniden hesapla; C1101 gibi sonradan 61AT
  // VIN'i bulunan arac ayni import icinde Coupe'den Cabrio'ya tasinir.
  const rerouteAfterMerge = (sourceCategory, rootCar, rec) => {
    const moved = rerouteAfterMergeRecord({ sourceCategory, car: rootCar, rawCar: rec, dryRun: isDryRun });
    if (moved) report.rerouted.push(moved);
  };
  // Fuzzy ikiz tespiti icin kok kayitlarin (tescil, km, fiyat) parmak izleri.
  // VIN'siz mobile.de kaydi dealer crawl'inda 3 anahtarla YAKALANAMAZ; ayni fiziksel
  // arac cift kayit olmasin diye es-deger kombinasyon uyari uretir (import engellenmez).
  // Esik/eslestirme mantigi lib/twin-fingerprint.js'de — parse-car-json ile ORTAK.
  const rootFingerprints = buildRootFingerprints(listingsDir);
  const findTwin = (parsed) => findTwinFp(rootFingerprints, parsed);
  // Site kategorileri bellekte toplanir, sonda tek seferde yazilir.
  const fileCache = new Map(); // "COUPE_GAS_WITH_SUNROOF" -> array
  const loadSiteFile = (target) => {
    if (!fileCache.has(target)) {
      fileCache.set(target, readCategory(siteName + path.sep + target));
    }
    return fileCache.get(target);
  };

  for (const rec of records) {
    const label = rec.dealerListingUrl || rec.title || '?';
    if (!rec.title || !rec.price?.amount) {
      report.invalid.push({ record: label, reason: 'title veya price.amount eksik' });
      continue;
    }
    // Bayi kaydinda dealer.contry yoksa site varsayilani islenir (route ulke-dislamasi icin).
    rec.dealer = rec.dealer || {};
    if (!rec.dealer.contry) rec.dealer.contry = site.defaultCountry;

    const mobileDeId = mobileDeIdFrom(rec.mobileDeUrl);
    const vin = rec.vin ? String(rec.vin).toUpperCase() : null;
    const dealerKey = dealerKeyFor(site, rec.dealerListingUrl);
    const hit = lookupListing(index, { mobileDeId, vin, dealerKey });

    // Ham arsiv (dry-run'da da yazilmaz).
    const rawKey = (dealerKey ? dealerKey.split(':').pop() : 'x').replace(/[^A-Za-z0-9-]/g, '-').replace(/_/g, '-').slice(-60);
    if (!isDryRun) {
      fs.mkdirSync(path.join(dumpDealerRoot, siteName), { recursive: true });
      fs.writeFileSync(path.join(dumpDealerRoot, siteName, `${rawKey}_${ts}.json`), JSON.stringify(rec, null, 2));
    }

    if (hit && !hit.file.startsWith(siteName + path.sep)) {
      // Kok kategoride (veya baska kaynakta) zaten var — mobile.de kaydi kanonik.
      // Her taramada bayi verisi kokle SENKRONIZE edilir: unknown'lar cozulur,
      // zit celiskiler equipmentConflicts'e islenir (cozulen celiski kalkar).
      const rootCar = readCar(hit.file, hit.listingId);
      if (rootCar) {
        const freshParsed = parseRawToListing(rec, { listingId: hit.listingId, mobileDeId, source: siteName });
        const syncChanges = mergeTwinIntoRoot(rootCar, {
          dealerListingUrl: rec.dealerListingUrl, vin,
          freshEquipment: freshParsed.equipmentFeatures, source: siteName,
          fields: dealerFillableFields(freshParsed),
          damageReason: detectDamageReason(rec)
        });
        // --dry-run diske YAZMAZ (eskiden bu iki merge yolu bayrağı yok sayıyordu).
        if (!isDryRun && Object.keys(syncChanges).length) writeCar(hit.file, rootCar);
        rerouteAfterMerge(hit.file, rootCar, rec);
      }
      report.existing.push({ listingId: hit.listingId, file: hit.file, matchedBy: mobileDeId ? 'mobileDeId' : vin && hit === lookupListing(index, { vin }) ? 'vin' : 'dealerKey', record: label });
      continue;
    }

    if (hit) {
      // Kendi site dosyasinda — guncelle.
      const arr = loadSiteFile(path.basename(hit.file));
      const existingCar = arr.find(c => c.listingId === hit.listingId);
      if (!existingCar) { report.invalid.push({ record: label, reason: `index ${hit.listingId} dedi ama dosyada yok` }); continue; }
      const parsed = parseRawToListing(rec, { listingId: hit.listingId, mobileDeId, source: siteName });
      const { hasChanges, changes } = applyUpdatesAndGetChanges(existingCar, parsed);
      if (!existingCar.possibleTwinOf) {
        const twin = findTwin(parsed);
        if (twin) { existingCar.possibleTwinOf = twin.listingId; report.possibleTwins.push({ listingId: hit.listingId, twinOf: twin.listingId }); }
      }
      if (hasChanges) {
        existingCar.auditHistory = existingCar.auditHistory || [];
        existingCar.auditHistory.push({
          action: 'İlan Güncellemesi (Otomatik)',
          detail: `${siteName} taraması sonucu veriler eşitlendi`,
          changes,
          auditDate: new Date().toISOString()
        });
        report.updated.push({ listingId: hit.listingId, changes: Object.keys(changes) });
      } else {
        report.existing.push({ listingId: hit.listingId, file: hit.file, matchedBy: 'dealerKey', record: label, unchanged: true });
      }
      continue;
    }

    // Yeni arac.
    const listingId = allocator.next();
    const parsed = parseRawToListing(rec, { listingId, mobileDeId, source: siteName });
    const { target, reason } = determineTargetFile(parsed, rec);
    parsed.listingDescriptionNotes = parsed.listingDescriptionNotes || [];
    if (reason) {
      parsed.listingDescriptionNotes.push(`⚠️ ${target} olarak işaretlendi — ${reason}`);
    }
    // Marj araci (KDV indirilemez) notunu KOD dusurur — subagent'in elle not yazmasina
    // birakilmaz (kalip TEXT_SIGNALS.json → vat.marginWords). NL "BTW verrekenbaar: Nee".
    const marginHit = detectMarginVat(`${rec.description || ''} ${JSON.stringify(rec.properties || {})}`);
    if (marginHit && !parsed.listingDescriptionNotes.includes(MARGIN_VAT_NOTE)) {
      parsed.listingDescriptionNotes.push(MARGIN_VAT_NOTE);
    }
    const twin = findTwin(parsed);
    // Twin + AYNI SATICI = ayni fiziksel arac: yeni kayit ACILMAZ, mobile.de kaydi
    // kanonik kalir ve bayi sayfasi ona baglanir (bayi-linki modeliyle ayni).
    // Veri EZILMEZ — bayi listesi eksik olabilir (WELLER collapsed bolumleri);
    // yalnizca dealerListingUrl + (yoksa) vin yazilir ve equipment UNKNOWN'lari cozulur.
    if (twin && sellerMatches(rec.dealer?.name, twin.seller)) {
      // twin.rel = kok kategori adi (buildRootFingerprints doldurur).
      const rootCar = readCar(twin.rel, twin.listingId);
      if (rootCar) {
        const freshParsed = parseRawToListing(rec, { listingId: twin.listingId, mobileDeId, source: siteName });
        const mergeChanges = mergeTwinIntoRoot(rootCar, {
          dealerListingUrl: rec.dealerListingUrl, vin,
          freshEquipment: freshParsed.equipmentFeatures, source: siteName,
          // Bayide bilgi var + mobile.de'de yok => bayi ezer (bkz. merge-twin.js).
          fields: dealerFillableFields(freshParsed),
          damageReason: detectDamageReason(rec)
        });
        if (!isDryRun) writeCar(twin.rel, rootCar);
        rerouteAfterMerge(twin.rel, rootCar, rec);
        report.merged = report.merged || [];
        report.merged.push({ listingId: twin.listingId, site: siteName, key: dealerKey, resolved: Object.keys(mergeChanges).filter(k => k.startsWith('equipmentFeatures.')).length });
        continue;   // site dosyasina yeni kayit YOK
      }
    }
    if (twin) {
      report.possibleTwins.push({ listingId, twinOf: twin.listingId, hint: twinHint(twin, { seller: rec.dealer?.name }) });
      parsed.possibleTwinOf = twin.listingId;   // yapısal bağ — UI çelişki tablosu bundan beslenir
      parsed.listingDescriptionNotes.push(`⚠️ Muhtemel mobile.de ikizi: ${twin.listingId} (tescil+km+fiyat eşleşmesi, satıcı farklı) — teyit gerekli`);
    }
    loadSiteFile(target).push(parsed);
    report.added.push({ listingId, file: `${siteName}/${target}`, key: dealerKey, ...(vin ? { vin } : {}), ...(mobileDeId ? { mobileDeId } : {}), ...(twin ? { possibleTwin: twin.listingId } : {}) });
  }

  if (!isDryRun) {
    for (const [target, arr] of fileCache) {
      writeCategory(siteName + path.sep + target, arr);
    }
    writeRunLog('import-dealer', { site: siteName, dryRun: false,
      added: report.added.length, updated: report.updated.length,
      existing: report.existing.length, invalid: report.invalid.length,
      addedIds: report.added.map(a => a.listingId) });
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  console.error(`${isDryRun ? '(dry-run) ' : ''}${siteName}: +${report.added.length} yeni, ~${report.updated.length} güncel, =${report.existing.length} mevcut, !${report.invalid.length} geçersiz${isDryRun ? '' : ' — şimdi çalıştır: npm run format:data'}`);
});
