import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pushSoldAudit } from './lib/sold.js';
import { parseRawToListing, applyUpdatesAndGetChanges } from './lib/parse-listing.js';
import { determineTargetFile } from './lib/route-listing.js';
import { SOLD_FILES, soldArchiveFor, isManuallyMarkedKazali } from './lib/move-listing.js';
import { buildDumpIndex, readLiveDump } from './lib/dumps.js';
import { buildRootFingerprints, findTwin as findTwinFp, twinHint } from './lib/twin-fingerprint.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const CoupeWithSunroofPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF.json');
const CoupeWithoutSunroofPath = path.join(listingsDir, 'COUPE_GAS_WITHOUT_SUNROOF.json');
const dieselWithSunroofPath = path.join(listingsDir, 'COUPE_DIESEL_WITH_SUNROOF.json');
const granCoupePath = path.join(listingsDir, 'GRAN_COUPE.json');
const granCoupeKazaliPath = path.join(listingsDir, 'GRAN_COUPE_KAZALI.json');
const cabrioPath = path.join(listingsDir, 'CABRIO.json');
const cabrioKazaliPath = path.join(listingsDir, 'CABRIO_KAZALI.json');
const rwdGasWithSunroofPath = path.join(listingsDir, 'COUPE_GAS_RWD_WITH_SUNROOF.json');
const rwdGasWithoutSunroofPath = path.join(listingsDir, 'COUPE_GAS_RWD_WITHOUT_SUNROOF.json');
const soldPath = path.join(listingsDir, SOLD_FILES.xdrive);
const rwdSoldWithSunroofPath = path.join(listingsDir, SOLD_FILES.rwdSunroof);
const rwdSoldWithoutSunroofPath = path.join(listingsDir, SOLD_FILES.rwdNoSunroof);
const kazaliPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_KAZALI.json');
const cakalPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_CAKAL.json');
const deletedPath = path.join(listingsDir, 'DELETED_CARS.json');
const lithuaniaPath = path.join(listingsDir, 'LITHUANIA.json');

// Otomatik "kalkti -> SATILDI" yalnizca bu kaynak dosyalarda calisir (coupe ailesi).
const LISTING_FILES_META = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8'));
const AUTO_SOLD_SOURCE_FILES = LISTING_FILES_META.autoSoldSourceFiles;

function getNextListingId(existingListings) {
  let maxId = 0;
  existingListings.forEach(l => {
    const idMatch = l.listingId?.match(/C(\d+)/);
    if (idMatch) {
      const id = parseInt(idMatch[1]);
      if (id > maxId) maxId = id;
    }
  });
  return `C${maxId + 1}`;
}

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

  const CoupeWithSunroof = JSON.parse(fs.readFileSync(CoupeWithSunroofPath, 'utf-8'));
  const CoupeWithoutSunroof = JSON.parse(fs.readFileSync(CoupeWithoutSunroofPath, 'utf-8'));
  const dieselWithSunroof = JSON.parse(fs.readFileSync(dieselWithSunroofPath, 'utf-8'));
  const granCoupe = JSON.parse(fs.readFileSync(granCoupePath, 'utf-8'));
  const granCoupeKazali = fs.existsSync(granCoupeKazaliPath) ? JSON.parse(fs.readFileSync(granCoupeKazaliPath, 'utf-8')) : [];
  const cabrio = fs.existsSync(cabrioPath) ? JSON.parse(fs.readFileSync(cabrioPath, 'utf-8')) : [];
  const cabrioKazali = fs.existsSync(cabrioKazaliPath) ? JSON.parse(fs.readFileSync(cabrioKazaliPath, 'utf-8')) : [];
  const lithuania = fs.existsSync(lithuaniaPath) ? JSON.parse(fs.readFileSync(lithuaniaPath, 'utf-8')) : [];
  const rwdGasWithSunroof = fs.existsSync(rwdGasWithSunroofPath) ? JSON.parse(fs.readFileSync(rwdGasWithSunroofPath, 'utf-8')) : [];
  const rwdGasWithoutSunroof = fs.existsSync(rwdGasWithoutSunroofPath) ? JSON.parse(fs.readFileSync(rwdGasWithoutSunroofPath, 'utf-8')) : [];
  const sold = JSON.parse(fs.readFileSync(soldPath, 'utf-8'));
  const rwdSoldWithSunroof = fs.existsSync(rwdSoldWithSunroofPath) ? JSON.parse(fs.readFileSync(rwdSoldWithSunroofPath, 'utf-8')) : [];
  const rwdSoldWithoutSunroof = fs.existsSync(rwdSoldWithoutSunroofPath) ? JSON.parse(fs.readFileSync(rwdSoldWithoutSunroofPath, 'utf-8')) : [];
  const kazali = JSON.parse(fs.readFileSync(kazaliPath, 'utf-8'));
  const cakal = JSON.parse(fs.readFileSync(cakalPath, 'utf-8'));
  const deleted = JSON.parse(fs.readFileSync(deletedPath, 'utf-8'));

  // Taşınabilir (aktif) dosyalar — sold/cakal/deleted taşınmaz
  const activeFiles = [
    { name: 'COUPE_GAS_WITH_SUNROOF', data: CoupeWithSunroof },
    { name: 'COUPE_GAS_WITHOUT_SUNROOF', data: CoupeWithoutSunroof },
    { name: 'COUPE_DIESEL_WITH_SUNROOF', data: dieselWithSunroof },
    { name: 'COUPE_GAS_RWD_WITH_SUNROOF', data: rwdGasWithSunroof },
    { name: 'COUPE_GAS_RWD_WITHOUT_SUNROOF', data: rwdGasWithoutSunroof },
    { name: 'GRAN_COUPE', data: granCoupe },
    { name: 'GRAN_COUPE_KAZALI', data: granCoupeKazali },
    { name: 'CABRIO', data: cabrio },
    { name: 'CABRIO_KAZALI', data: cabrioKazali },
    { name: 'COUPE_GAS_WITH_SUNROOF_KAZALI', data: kazali },
    { name: 'LITHUANIA', data: lithuania },
  ];
  const frozenFiles = [
    { name: 'SOLD', data: sold },
    { name: 'RWD_SOLD_WITH_SUNROOF', data: rwdSoldWithSunroof },
    { name: 'RWD_SOLD_WITHOUT_SUNROOF', data: rwdSoldWithoutSunroof },
    { name: 'CAKAL', data: cakal },
    { name: 'DELETED', data: deleted },
  ];

  // Kalkmış (satılmış) ilan hangi SOLD dosyasına gider — merkezi soldArchiveFor ile.
  const soldArraysByFileName = {
    [SOLD_FILES.xdrive]: sold,
    [SOLD_FILES.rwdSunroof]: rwdSoldWithSunroof,
    [SOLD_FILES.rwdNoSunroof]: rwdSoldWithoutSunroof,
  };

  let currentAllListings = [...activeFiles, ...frozenFiles].flatMap(f => f.data);
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
        const nextId = getNextListingId(currentAllListings);
        const parsedCar = parseRawToListing(car, { listingId: nextId, mobileDeId });
        currentAllListings.push(parsedCar);

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
        // Yeni kayit da sonraki ilanlarin ikiz havuzuna girsin (ayni run icinde 3'lu re-list).
        rootFingerprints.push({
            listingId: nextId, mobileDeId: String(mobileDeId),
            reg: (parsedCar.firstRegistrationYearAndMonth || []).join('/'),
            km: parsedCar.mileageKm || 0, price: parsedCar.basePriceEuro,
            seller: parsedCar.sellerTypeOrName || '', file: null, rel: targetName
        });
        console.log(`✅ Yeni eklendi: ${nextId} (${targetName}.json)${reason ? ` — ${reason}` : ''}${twin ? ` — ⚠️ muhtemel ikiz: ${twin.listingId}` : ''}`);
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
    if (!AUTO_SOLD_SOURCE_FILES.includes(`${source.name}.json`)) continue;
    // Elle KAZALI işaretli ilan burada da sabit kalır — insan kararı korunur,
    // gerekiyorsa `npm run move:sell` ile elle taşınır.
    if (source.name.includes('KAZALI') && isManuallyMarkedKazali(existingCar)) {
      console.log(`📌 ${existingCar.listingId} (${deadId}) kalkmış ama elle KAZALI işaretli — ${source.name}'da bırakıldı.`);
      continue;
    }
    source.data.splice(source.data.indexOf(existingCar), 1);
    const soldArchive = soldArchiveFor(existingCar);
    pushSoldAudit(existingCar, `${source.name}.json`, "Apify taramasında ilan bulunamadı (mobile.de'den kalktı)");
    soldArraysByFileName[soldArchive.name].push(existingCar);
    console.log(`🏷️  ${existingCar.listingId} (${deadId}) SATILDI (mobile.de'den kalktı) — ${source.name} → ${soldArchive.name}`);
  }

  // Tüm değişiklikleri diske yaz
  fs.writeFileSync(CoupeWithSunroofPath, JSON.stringify(CoupeWithSunroof, null, 2));
  fs.writeFileSync(CoupeWithoutSunroofPath, JSON.stringify(CoupeWithoutSunroof, null, 2));
  fs.writeFileSync(dieselWithSunroofPath, JSON.stringify(dieselWithSunroof, null, 2));
  fs.writeFileSync(rwdGasWithSunroofPath, JSON.stringify(rwdGasWithSunroof, null, 2));
  fs.writeFileSync(rwdGasWithoutSunroofPath, JSON.stringify(rwdGasWithoutSunroof, null, 2));
  fs.writeFileSync(granCoupePath, JSON.stringify(granCoupe, null, 2));
  fs.writeFileSync(granCoupeKazaliPath, JSON.stringify(granCoupeKazali, null, 2));
  fs.writeFileSync(cabrioPath, JSON.stringify(cabrio, null, 2));
  fs.writeFileSync(cabrioKazaliPath, JSON.stringify(cabrioKazali, null, 2));
  fs.writeFileSync(kazaliPath, JSON.stringify(kazali, null, 2));
  fs.writeFileSync(soldPath, JSON.stringify(sold, null, 2));
  fs.writeFileSync(rwdSoldWithSunroofPath, JSON.stringify(rwdSoldWithSunroof, null, 2));
  fs.writeFileSync(rwdSoldWithoutSunroofPath, JSON.stringify(rwdSoldWithoutSunroof, null, 2));
  // CAKAL ve DELETED de yazılır: ikisi de yukarıda okunup applyUpdatesAndGetChanges ile
  // GÜNCELLENİYOR (audit kaydı dahil) ama eskiden diske yazılmıyordu — değişiklikler her
  // çalıştırmada yeniden hesaplanıp atılıyor, script "güncellendi" deyip hiçbir şey
  // kaydetmiyordu (idempotent değildi).
  fs.writeFileSync(cakalPath, JSON.stringify(cakal, null, 2));
  fs.writeFileSync(deletedPath, JSON.stringify(deleted, null, 2));
  fs.writeFileSync(lithuaniaPath, JSON.stringify(lithuania, null, 2));
}

run().catch(console.error);
