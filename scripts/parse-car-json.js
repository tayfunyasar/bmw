import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pushSoldAudit } from './lib/sold.js';
import { parseRawToListing, applyUpdatesAndGetChanges } from './lib/parse-listing.js';
import { determineTargetFile } from './lib/route-listing.js';
import { SOLD_CATEGORIES, soldArchiveFor, isManuallyMarkedKazali } from './lib/move-listing.js';
import { buildDumpIndex, readLiveDump } from './lib/dumps.js';
import { buildRootFingerprints, fingerprintOf, findTwin as findTwinFp, twinHint } from './lib/twin-fingerprint.js';
import { listingsDir, readCategory, writeCategory } from './lib/listings-store.js';
import { createIdAllocator } from './lib/listing-id.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Kategori listeleri config'ten (tek kaynak LISTING_FILES.json):
//   aktif  = allCategories − frozenCategories (tasinabilir)
//   frozen = SOLD arsivleri + CAKAL + DELETED (icinden tasinmaz)
// Otomatik "kalkti -> SATILDI" yalnizca autoSoldSourceCategories'te calisir (coupe ailesi).
const LISTING_FILES_META = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8'));
const AUTO_SOLD_SOURCE_CATEGORIES = LISTING_FILES_META.autoSoldSourceCategories;
const FROZEN_CATEGORIES = LISTING_FILES_META.frozenCategories;
const ACTIVE_CATEGORIES = LISTING_FILES_META.allCategories.filter(c => !FROZEN_CATEGORIES.includes(c));

// parseCar/applyUpdates mantigi scripts/lib/parse-listing.js icinde — tek kaynak.

async function run() {
  const dumpIndex = buildDumpIndex();

  if (Object.keys(dumpIndex).length === 0) {
      console.error('dump/ dizininde işlenecek JSON dosyası bulunamadı.');
      process.exit(0);
  }

  // Opsiyonel CLI filtresi: sadece belirtilen mobile.de ID'lerini işle
  const filterIds = process.argv.slice(2).map(s => s.trim()).filter(Boolean);
  if (filterIds.length > 0) {
      console.log(`🔎 Filtre aktif: sadece ${filterIds.length} ID işlenecek (${filterIds.join(', ')})`);
  }

  // Her mobileDeId için İKİ AYRI şey çıkarılır (bkz. lib/dumps.js):
  //   içerik       → en yeni CANLI dump. En yenisi ölüyse daha eski dolu dump'a
  //                  düşülür, böylece ilan yeniden türetilebilir kalır.
  //   piyasa durumu→ en yeni dump ölüyse ilan mobile.de'den kalkmış demektir.
  // Eskiden bu ikisi aynı şeymiş gibi ele alınıyordu: ölü dump görülünce ilan
  // SOLD'a taşınıyor ama verisi hiç tazelenmiyordu (69 ilan bu yüzden eski kaldı).
  const carData = [];
  const removedFromMarket = new Set();
  let recovered = 0, unrecoverable = 0;
  for (const id of Object.keys(dumpIndex)) {
      if (filterIds.length > 0 && !filterIds.includes(id)) continue;
      const { raw, staleFallback, newestIsDead } = readLiveDump(id, dumpIndex);
      if (newestIsDead) removedFromMarket.add(id);
      if (!raw) { unrecoverable++; continue; }
      if (staleFallback) recovered++;
      carData.push(raw);
  }
  if (recovered > 0) console.log(`♻️  ${recovered} ilan için en yeni dump ölüydü, veri daha eski dolu dump'tan tazelendi.`);
  if (unrecoverable > 0) console.log(`⏭️  ${unrecoverable} ilanın kullanılabilir dump'ı yok, atlandı.`);

  if (carData.length === 0) {
      console.error('İşlenecek geçerli araç verisi bulunamadı.');
      process.exit(1);
  }

  // Taşınabilir (aktif) kategoriler — sold/cakal/deleted taşınmaz (frozen).
  // Bos kategori = olmayan dizin; readCategory [] doner, writeCategory olusturur.
  const activeFiles = ACTIVE_CATEGORIES.map(name => ({ name, data: readCategory(name) }));
  const frozenFiles = FROZEN_CATEGORIES.map(name => ({ name, data: readCategory(name) }));
  const byName = new Map([...activeFiles, ...frozenFiles].map(f => [f.name, f.data]));

  // Kalkmış (satılmış) ilan hangi SOLD kategorisine gider — merkezi soldArchiveFor ile.
  const soldArraysByCategory = {
    [SOLD_CATEGORIES.xdrive]: byName.get(SOLD_CATEGORIES.xdrive),
    [SOLD_CATEGORIES.rwdSunroof]: byName.get(SOLD_CATEGORIES.rwdSunroof),
    [SOLD_CATEGORIES.rwdNoSunroof]: byName.get(SOLD_CATEGORIES.rwdNoSunroof),
  };

  // C-serisi tahsis: tum agacin dosya adlarindan max bulunur (site onekleri
  // ^C(\d+)$ ile eslesmez, cakisma yapisal olarak imkansiz).
  const allocator = createIdAllocator('C');
  // Re-list ikiz tespiti icin kok kayitlarin parmak izleri (import-dealer ile ORTAK modul).
  const rootFingerprints = buildRootFingerprints(listingsDir);

  function findCarAndSource(mobileDeId) {
    for (const file of [...activeFiles, ...frozenFiles]) {
      const car = file.data.find(c => c.mobileDeId === mobileDeId);
      if (car) return { car, source: file };
    }
    return { car: null, source: null };
  }


  // Kalkmış ilanların SOLD'a taşınması AŞAĞIDA, ana döngüden SONRA yapılır —
  // önce veriler tazelensin, sonra taşınsın (eskiden taşıma `continue` ile ana
  // döngüyü atladığı için bu ilanların verisi hiç güncellenmiyordu).
  for (const car of carData) {
    const mobileDeIdMatch = car.url?.match(/id=(\d+)/) || car.url?.match(/\/(\d+)\.html/);
    const mobileDeId = mobileDeIdMatch ? mobileDeIdMatch[1] : null;

    const { car: existingCar, source } = mobileDeId ? findCarAndSource(mobileDeId) : { car: null, source: null };

    if (existingCar) {
        const parsedCar = parseRawToListing(car, { listingId: existingCar.listingId, mobileDeId, vin: existingCar.vin });
        const { hasChanges, changes } = applyUpdatesAndGetChanges(existingCar, parsedCar);

        // listingDates güncelle
        existingCar.listingDates = existingCar.listingDates || {};
        if (car.createdTime) existingCar.listingDates.createdTime = car.createdTime;
        if (car.modifiedTime) existingCar.listingDates.modifiedTime = car.modifiedTime;
        if (car.renewedTime) existingCar.listingDates.renewedTime = car.renewedTime;

        existingCar.auditHistory = existingCar.auditHistory || [];
        if (car.renewedTime) {
            const alreadyHasRenewed = existingCar.auditHistory.some(a =>
                a.action === 'İlan Yenilendi (mobile.de)' && a.auditDate === car.renewedTime
            );
            if (!alreadyHasRenewed) {
                existingCar.auditHistory.push({
                    action: "İlan Yenilendi (mobile.de)",
                    detail: null,
                    changes: null,
                    auditDate: car.renewedTime
                });
            }
        }

        if (hasChanges) {
            existingCar.auditHistory.push({
                action: "İlan Güncellemesi (Otomatik)",
                detail: "Apify tekrar taraması sonucu veriler eşitlendi",
                changes: changes,
                auditDate: new Date().toISOString()
            });
            existingCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));
            console.log(`✅ ${existingCar.listingId} başarıyla güncellendi (Fiyat, km veya donanım değişti).`);
        } else {
            existingCar.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));
            console.log(`ℹ️ ${existingCar.listingId} tarandı ancak değişen bir veri bulunamadı.`);
        }

        // Dosya yerleşim kontrolü — sadece aktif dosyalardaki araçlar taşınabilir.
        // Elle KAZALI işaretlenmiş ilan sabitlenir: Apify metninde hasar kelimesi
        // geçmemesi, insanın verdiği kazalı kararını ezmez.
        const isFrozen = frozenFiles.some(f => f === source);
        const pinnedKazali = source.name.includes('KAZALI') && isManuallyMarkedKazali(existingCar);
        if (pinnedKazali) {
            console.log(`📌 ${existingCar.listingId} elle KAZALI işaretli — ${source.name}'da sabit tutuldu.`);
        }
        if (!isFrozen && !pinnedKazali) {
            const { target: targetName, reason } = determineTargetFile(existingCar, car);
            if (targetName !== source.name) {
                const idx = source.data.indexOf(existingCar);
                source.data.splice(idx, 1);
                const targetFile = activeFiles.find(f => f.name === targetName);
                targetFile.data.push(existingCar);
                existingCar.auditHistory.push({
                    action: `Dosya Taşıma: ${source.name} → ${targetName}`,
                    detail: reason ?? "Yeniden değerlendirme sonucu doğru dosyaya taşındı",
                    changes: null,
                    auditDate: new Date().toISOString()
                });
                if (reason) {
                    existingCar.listingDescriptionNotes = existingCar.listingDescriptionNotes || [];
                    const note = `⚠️ ${targetName} olarak işaretlendi — ${reason}`;
                    if (!existingCar.listingDescriptionNotes.includes(note)) {
                        existingCar.listingDescriptionNotes.push(note);
                    }
                }
                console.log(`🔀 ${existingCar.listingId} taşındı: ${source.name} → ${targetName}${reason ? ` (${reason})` : ''}`);
            }
        }
    } else {
        const nextId = allocator.next();
        const parsedCar = parseRawToListing(car, { listingId: nextId, mobileDeId });

        // RE-LIST IKIZI: ayni fiziksel arac satilmayip yeni mobileDeId ile tekrar
        // listelenmis olabilir (bayi ilani yeniler). Uc anahtar (mobileDeId/vin/
        // dealerKey) bunu YAKALAYAMAZ. Kayit yine acilir — hangi ilanin canli
        // oldugu bilinemez — ama possibleTwinOf ile eskisine baglanir.
        const twin = findTwinFp(rootFingerprints, parsedCar, { excludeMobileDeId: mobileDeId });
        if (twin) {
            parsedCar.possibleTwinOf = twin.listingId;
            parsedCar.listingDescriptionNotes = parsedCar.listingDescriptionNotes || [];
            parsedCar.listingDescriptionNotes.push(`⚠️ Muhtemel yeniden-listeleme ikizi: ${twin.listingId} — ${twinHint(twin, { seller: parsedCar.sellerTypeOrName })}`);
        }

        const { target: targetName, reason } = determineTargetFile(parsedCar, car);
        const targetFile = activeFiles.find(f => f.name === targetName);
        if (reason) {
            parsedCar.listingDescriptionNotes = parsedCar.listingDescriptionNotes || [];
            parsedCar.listingDescriptionNotes.push(`⚠️ ${targetName} olarak işaretlendi — ${reason}`);
        }
        targetFile.data.push(parsedCar);
        // Yeni kayit da sonraki ilanlarin ikiz havuzuna girsin (ayni run icinde 3'lu
        // re-list). Kural tek kaynakta: guvenilmez imzali (sifir) arac havuza GIRMEZ.
        const fp = fingerprintOf(parsedCar, { rel: targetName });
        if (fp) rootFingerprints.push(fp);
        console.log(`✅ Yeni eklendi: ${nextId} (${targetName})${reason ? ` — ${reason}` : ''}${twin ? ` — ⚠️ muhtemel ikiz: ${twin.listingId}` : ''}`);
    }
  }

  // --- Kalkmış ilanlar → SOLD (veriler yukarıda tazelendikten SONRA) ---
  // Sinyal: en yeni dump "Listing does not exists anymore". Bu, Apify'ın BAŞARILI
  // cevabıdır — mobile.de'ye ulaşılmış ve "ilan yok" denmiştir. 403/oturum hatasında
  // apify-fetch-car.js hiç dump YAZMAZ, dolayısıyla bu sinyal "çekemedik" ile karışmaz.
  for (const deadId of removedFromMarket) {
    const { car: existingCar, source } = findCarAndSource(deadId);
    if (!existingCar) continue;                                  // zaten listelerde yok
    if (frozenFiles.includes(source)) continue;                  // zaten SOLD/CAKAL/DELETED
    // soldArchiveFor yalnızca tahrike göre yönlendirir, gövde tipi bilmez — CABRIO /
    // GRAN_COUPE ilanları coupe SOLD arşivine düşer ve oradan uygulamanın karşılaştırma
    // havuzuna sızar (pricingCalculator: soldGasListings → allByTotalCost). Bu gövdeler
    // zaten alım hunisinin dışında; otomatik satış yalnızca coupe ailesinde çalışır.
    // Elle `npm run move:sell` hâlâ mümkün (insan kararı sınırlanmaz).
    if (!AUTO_SOLD_SOURCE_CATEGORIES.includes(source.name)) continue;
    // Elle KAZALI işaretli ilan burada da sabit kalır — insan kararı korunur,
    // gerekiyorsa `npm run move:sell` ile elle taşınır.
    if (source.name.includes('KAZALI') && isManuallyMarkedKazali(existingCar)) {
      console.log(`📌 ${existingCar.listingId} (${deadId}) kalkmış ama elle KAZALI işaretli — ${source.name}'da bırakıldı.`);
      continue;
    }
    source.data.splice(source.data.indexOf(existingCar), 1);
    const soldArchive = soldArchiveFor(existingCar);
    pushSoldAudit(existingCar, source.name, "Apify taramasında ilan bulunamadı (mobile.de'den kalktı)");
    soldArraysByCategory[soldArchive].push(existingCar);
    console.log(`🏷️  ${existingCar.listingId} (${deadId}) SATILDI (mobile.de'den kalktı) — ${source.name} → ${soldArchive}`);
  }

  // Tüm değişiklikleri diske yaz. writeCategory kategori değiştiren aracın eski
  // dosyasını da siler (splice = dosya silme), değişmeyen dosyaya dokunmaz.
  // CAKAL ve DELETED de dahil: ikisi de yukarıda applyUpdatesAndGetChanges ile
  // güncelleniyor (audit kaydı dahil) — frozen yalnızca "taşınmaz" demektir.
  for (const f of [...activeFiles, ...frozenFiles]) {
    writeCategory(f.name, f.data);
  }
}

run().catch(console.error);
