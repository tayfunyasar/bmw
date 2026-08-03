import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pushSoldAudit } from './lib/sold.js';
import { classifyBodyStyle, rawCarToTextObj, rawCarApifyCategory } from './lib/body-style.js';
import { matchEquipmentFeatures } from './lib/equipment-match.js';
import { determineDrivetrainFromRaw, RWD } from './lib/drivetrain.js';
import { SOLD_FILES, soldArchiveFor, isManuallyMarkedKazali } from './lib/move-listing.js';
import { buildDumpIndex, readLiveDump } from './lib/dumps.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const equipmentRulesPath = path.resolve(__dirname, '../src/data/metadata/EQUIPMENT_RULES.json');
const colorSourcePath = path.resolve(__dirname, '../src/data/metadata/COLOR_SOURCE.json');

// Rengi söylemeyen jenerik üretici boya etiketleri (ör. "BMW Individuallackierung").
// Bu durumda exteriorColorName gerçek renge (colour) düşer, etiket paintLabel'de korunur.
const COLOR_SOURCE = JSON.parse(fs.readFileSync(colorSourcePath, 'utf8'));
function resolveExteriorColor(props) {
  const manuf = (props.manufacturerColour || '').trim();
  const isGenericPaint = COLOR_SOURCE.genericManufacturerPaint.includes(manuf);
  return {
    exteriorColorName: isGenericPaint ? props.colour : (props.manufacturerColour || props.colour),
    // Ham üretici etiketi olduğu gibi korunur (ör. "BMW Individuallackierung") — kaybolmaz.
    exteriorPaintLabel: isGenericPaint ? manuf : undefined,
  };
}

const CoupeWithSunroofPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF.json');
const CoupeWithoutSunroofPath = path.join(listingsDir, 'COUPE_GAS_WITHOUT_SUNROOF.json');
const dieselWithSunroofPath = path.join(listingsDir, 'COUPE_DIESEL_WITH_SUNROOF.json');
const granCoupePath = path.join(listingsDir, 'GRAN_COUPE.json');
const granCoupeKazaliPath = path.join(listingsDir, 'GRAN_COUPE_KAZALI.json');
const cabrioPath = path.join(listingsDir, 'CABRIO.json');
const rwdGasWithSunroofPath = path.join(listingsDir, 'COUPE_GAS_RWD_WITH_SUNROOF.json');
const rwdGasWithoutSunroofPath = path.join(listingsDir, 'COUPE_GAS_RWD_WITHOUT_SUNROOF.json');
const soldPath = path.join(listingsDir, SOLD_FILES.xdrive);
const rwdSoldWithSunroofPath = path.join(listingsDir, SOLD_FILES.rwdSunroof);
const rwdSoldWithoutSunroofPath = path.join(listingsDir, SOLD_FILES.rwdNoSunroof);
const kazaliPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_KAZALI.json');
const cakalPath = path.join(listingsDir, 'COUPE_GAS_WITH_SUNROOF_CAKAL.json');
const deletedPath = path.join(listingsDir, 'DELETED_CARS.json');
const lithuaniaPath = path.join(listingsDir, 'LITHUANIA.json');

const equipmentRules = JSON.parse(fs.readFileSync(equipmentRulesPath, 'utf8'));
// Config veri JSON'dan (Node fs deseni) — ülke bayrakları.
const COUNTRY_FLAGS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/COUNTRY_FLAGS.json'), 'utf8'));
// Otomatik "kalkti -> SATILDI" yalnizca bu kaynak dosyalarda calisir (coupe ailesi).
const LISTING_FILES_META = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8'));
const AUTO_SOLD_SOURCE_FILES = LISTING_FILES_META.autoSoldSourceFiles;
// Dislanan ulke -> hedef dosya (or. LT -> LITHUANIA.json). UI'a hic girmezler.
const COUNTRY_EXCLUDED_FILES = LISTING_FILES_META.countryExcludedFiles;

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

// Tahrik mantigi scripts/lib/drivetrain.js icinde — tek kaynak.

function parseCar(car, nextId) {
  const features = car.features || [];
  const description = car.description || "";
  const props = car.properties || {};

  // Donanim eslestirme mantigi scripts/lib/equipment-match.js icinde — tek kaynak.
  const equipmentFeatures = matchEquipmentFeatures(
    { description, features, props },
    equipmentRules
  );

  const regMatch = (props.firstRegistration || "").match(/(\d+)\/(\d+)/);
  const firstRegistrationYearAndMonth = regMatch ? [parseInt(regMatch[2]), parseInt(regMatch[1])] : [null, null];

  // G22 LCI/Pre-LCI geçişi TESCİLDEN kesin ayrılamaz — geçiş döneminde iki nesil birlikte
  // tescil edilir (kanıt: 05/2023'te hem LCI hem Pre-LCI araçlar var). Bu yüzden:
  //   ≤2022/12        → kesin Pre-LCI
  //   2023/01–2023/05 → BELİRSİZ (certain=false) → UI ⚠️, foto teyidi gerek
  //   ≥2023/06        → kesin LCI
  // Foto ile teyit edilen araçlar bu varsayımı override eder (certain=true, elle).
  const [regY, regM] = firstRegistrationYearAndMonth;
  let modelGeneration = "Pre-LCI";
  let modelGenerationCertain = true;
  if (regY == null) {
    modelGenerationCertain = false;
  } else if (regY > 2023 || (regY === 2023 && regM >= 6)) {
    modelGeneration = "LCI";
  } else if (regY === 2023 && regM <= 5) {
    modelGenerationCertain = false; // geçiş dönemi — varsayım Pre-LCI ama belirsiz
  }

  const sellerName = car.dealer?.name || "Unknown Dealer";
  const sellerRating = car.dealer?.rating?.total ? ` ★${car.dealer.rating.total}` : "";

  const countryCode = car.dealer?.contry || "DE";
  const flag = COUNTRY_FLAGS[countryCode] || COUNTRY_FLAGS.fallback;
  
  // Ham adres satırı olduğu gibi korunur (ör. "DE-73730 Esslingen am Neckar") — şehir/posta kırpılmaz.
  // Sadece nbsp → normal boşluk (görünmez karakter temizliği; anlam değişmez).
  let rawAddressLine = "Unknown";
  if (car.dealer?.addesses && car.dealer.addesses.length > 0) {
    rawAddressLine = car.dealer.addesses[car.dealer.addesses.length - 1].replace(/ /g, ' ').trim();
  }

  const mobileDeIdMatch = car.url?.match(/id=(\d+)/) || car.url?.match(/\/(\d+)\.html/);
  const mobileDeId = mobileDeIdMatch ? mobileDeIdMatch[1] : null;

  const serviceType = description.includes("Scheckheftgepflegt") || features.includes("Full Service History") ? "yes" : "unknown";
  const hasWarranty = features.includes("Warranty") ? "yes" : "no";
  const drivetrain = determineDrivetrainFromRaw(car);
  const { exteriorColorName, exteriorPaintLabel } = resolveExteriorColor(props);

  return {
    listingId: nextId,
    listingUrl: car.url,
    mobileDeId: mobileDeId,
    exteriorColorName: exteriorColorName,
    ...(exteriorPaintLabel ? { exteriorPaintLabel } : {}),
    interiorColorName: props.upholstery,
    drivetrainType: drivetrain.type,
    drivetrainCertain: drivetrain.certain,
    drivetrainReason: drivetrain.reason,
    basePriceEuro: car.price?.amount,
    mileageKm: parseInt((props.milage || "0").replace(/[^0-9]/g, "")),
    firstRegistrationYearAndMonth: firstRegistrationYearAndMonth,
    numberOfPreviousOwners: props.numberOfOwners || "?",
    warranty: {
      exists: hasWarranty
    },
    service: {
      type: serviceType,
      history: []
    },
    nextInspectionDate: props.generalInspection || "?",
    sellerTypeOrName: `${sellerName}${sellerRating}`,
    modelGeneration: modelGeneration,
    modelGenerationCertain: modelGenerationCertain,
    co2EmissionsGramPerKm: parseInt(props.co2Emission) || 0,
    listingLocation: `${flag} ${rawAddressLine}`,
    curatorPickBadge: null,
    curatorPersonalNotes: [],
    listingDescriptionNotes: [],
    listingAdditionalFeatures: [],
    equipmentFeatures: equipmentFeatures,
    listingDates: {
      createdTime: car.createdTime || null,
      modifiedTime: car.modifiedTime || null,
      renewedTime: car.renewedTime || null
    },
    auditHistory: [
      ...(car.createdTime ? [{
        action: "İlan Yayınlandı (mobile.de)",
        detail: null,
        changes: null,
        auditDate: car.createdTime
      }] : []),
      {
        action: "İlan Eklendi",
        detail: "Sistem tarafından kayıt altına alındı",
        changes: null,
        auditDate: new Date().toISOString()
      },
      ...(car.renewedTime && car.renewedTime !== car.createdTime ? [{
        action: "İlan Yenilendi (mobile.de)",
        detail: null,
        changes: null,
        auditDate: car.renewedTime
      }] : [])
    ].sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate)),
    cardThemeColorHex: (props.manufacturerColour || "").includes("weiß") ? "#e2e8f0" : "#94a3b8",
    aiCommentary: !drivetrain.certain ? [drivetrain.note || "⚠️ Tahrik tipi (xDrive/RWD) ilan metninden kesin tespit edilemedi. xDrive olarak varsayıldı — satıcıdan teyit alınmalı."] : null
  };
}

// Diff and Apply modifications function
function applyUpdatesAndGetChanges(existingCar, newCar) {
  const changes = {};
  let hasChanges = false;
  
  // Ana alanlar kontrol ediliyor
  const fieldsToCheck = [
      'basePriceEuro', 'mileageKm', 'sellerTypeOrName',
      'listingLocation', 'exteriorColorName', 'interiorColorName',
      'numberOfPreviousOwners', 'warranty', 'service', 'nextInspectionDate', 'co2EmissionsGramPerKm',
      'drivetrainType', 'drivetrainCertain', 'drivetrainReason', 'aiCommentary'
  ];
  const overrides = existingCar.overrideFeatures || {};
  fieldsToCheck.forEach(key => {
      if (overrides[key]) return; // Manuel override korunuyor (obje veya değer varsa atla)
      // Tahrik override'lıysa turetilmis yan alanlari da dondur (celiski olmasin)
      if ((key === 'drivetrainCertain' || key === 'drivetrainReason') && overrides.drivetrainType) return;
      if (newCar[key] !== undefined && existingCar[key] !== newCar[key] && JSON.stringify(existingCar[key]) !== JSON.stringify(newCar[key])) {
          changes[key] = { old: existingCar[key], new: newCar[key] };
          existingCar[key] = newCar[key];
          hasChanges = true;
      }
  });

  // equipmentFeatures alanı detaylı kontrol ediliyor
  // overrideFeatures'da tanımlı olanlar ASLA otomatik güncellenmez
  if (newCar.equipmentFeatures && existingCar.equipmentFeatures) {
      Object.keys(newCar.equipmentFeatures).forEach(feat => {
          if (overrides[feat]) return; // Manuel override korunuyor
          if (existingCar.equipmentFeatures[feat] !== newCar.equipmentFeatures[feat]) {
              changes[`equipmentFeatures.${feat}`] = {
                  old: existingCar.equipmentFeatures[feat],
                  new: newCar.equipmentFeatures[feat]
              };
              existingCar.equipmentFeatures[feat] = newCar.equipmentFeatures[feat];
              hasChanges = true;
          }
      });
  }
  
  return { hasChanges, changes };
}

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

  function findCarAndSource(mobileDeId) {
    for (const file of [...activeFiles, ...frozenFiles]) {
      const car = file.data.find(c => c.mobileDeId === mobileDeId);
      if (car) return { car, source: file };
    }
    return { car: null, source: null };
  }

  function detectDamageReason(rawCar) {
    if (rawCar.isDamaged === true) return 'Apify isDamaged alanı true';
    if (typeof rawCar.isDamaged === 'string' && rawCar.isDamaged.includes('Unfallvorschaden')) return `Apify isDamaged metninde tespit edildi: "${rawCar.isDamaged}"`;
    if (!!rawCar.isDamaged && typeof rawCar.isDamaged !== 'string') return 'Apify isDamaged alanı truthy';
    const vehicleCondition = rawCar.attributes?.['Vehicle condition'] || '';
    if (vehicleCondition.includes('accident')) return `Apify 'Vehicle condition' alanı: "${vehicleCondition}"`;
    const description = rawCar.description || '';
    const vorschadenMatch = description.match(/[^.\n]*Vorschaden[^.\n]*/i);
    if (vorschadenMatch) return `İlan açıklamasında tespit edildi: "${vorschadenMatch[0].trim()}"`;
    return null;
  }

  function determineTargetFile(car, rawCar) {
    const overrides = car.overrideFeatures || {};
    const isSunroof = car.equipmentFeatures.S403A === "yes";
    const driveResult = determineDrivetrainFromRaw(rawCar);
    const driveOverride = overrides.drivetrainType?.value || overrides.drivetrainType;
    // RWD artik hep "certain" turetilir (checkbox veya metin); ek certain sarti yok.
    const isRWD = driveOverride === RWD || driveResult.type === RWD;
    const textObj = rawCarToTextObj(rawCar);
    const apifyCategory = rawCarApifyCategory(rawCar);
    const bodyStyle = classifyBodyStyle(textObj, { apifyCategory });
    const isDiesel = (rawCar.properties?.fuelType || "").toLowerCase().includes("diesel") || /m440d/i.test(rawCar.title || "");
    const damageReason = detectDamageReason(rawCar);

    // Ülke dışlaması HER ŞEYDEN ÖNCE gelir: dışlanan ülkeden gelen ilan gövde tipine,
    // hasarına, tahrikine bakılmaksızın kendi dosyasına gider ve UI'a hiç girmez
    // (src/data/index.js o dosyayı import etmez). Liste config'te: LISTING_FILES.json.
    const excludedTarget = COUNTRY_EXCLUDED_FILES[rawCar.dealer?.contry];
    if (excludedTarget) {
      return { target: excludedTarget.replace(/\.json$/, ''), reason: `${rawCar.dealer.contry} ülkesinden — kapsam dışı` };
    }

    if (bodyStyle === 'CABRIO') return { target: 'CABRIO' };
    if (bodyStyle === 'GRAN_COUPE') {
      return damageReason
        ? { target: 'GRAN_COUPE_KAZALI', reason: damageReason }
        : { target: 'GRAN_COUPE' };
    }
    if (damageReason) return { target: 'COUPE_GAS_WITH_SUNROOF_KAZALI', reason: damageReason };
    if (isDiesel) return { target: 'COUPE_DIESEL_WITH_SUNROOF' };
    if (isRWD) return { target: isSunroof ? 'COUPE_GAS_RWD_WITH_SUNROOF' : 'COUPE_GAS_RWD_WITHOUT_SUNROOF' };
    return { target: isSunroof ? 'COUPE_GAS_WITH_SUNROOF' : 'COUPE_GAS_WITHOUT_SUNROOF' };
  }

  // Kalkmış ilanların SOLD'a taşınması AŞAĞIDA, ana döngüden SONRA yapılır —
  // önce veriler tazelensin, sonra taşınsın (eskiden taşıma `continue` ile ana
  // döngüyü atladığı için bu ilanların verisi hiç güncellenmiyordu).
  for (const car of carData) {
    const mobileDeIdMatch = car.url?.match(/id=(\d+)/) || car.url?.match(/\/(\d+)\.html/);
    const mobileDeId = mobileDeIdMatch ? mobileDeIdMatch[1] : null;

    const { car: existingCar, source } = mobileDeId ? findCarAndSource(mobileDeId) : { car: null, source: null };

    if (existingCar) {
        const parsedCar = parseCar(car, existingCar.listingId);
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
        const parsedCar = parseCar(car, nextId);
        currentAllListings.push(parsedCar);

        const { target: targetName, reason } = determineTargetFile(parsedCar, car);
        const targetFile = activeFiles.find(f => f.name === targetName);
        if (reason) {
            parsedCar.listingDescriptionNotes = parsedCar.listingDescriptionNotes || [];
            parsedCar.listingDescriptionNotes.push(`⚠️ ${targetName} olarak işaretlendi — ${reason}`);
        }
        targetFile.data.push(parsedCar);
        console.log(`✅ Yeni eklendi: ${nextId} (${targetName}.json)${reason ? ` — ${reason}` : ''}`);
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
